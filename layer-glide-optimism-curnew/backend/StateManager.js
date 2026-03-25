/**
 * StateManager – Execution Engine
 *
 * This is the core of the L2 system. It maintains:
 *   pendingBalanceWei  – optimistic running balance (updated on every tx)
 *   finalizedBalanceWei – committed only after batch finalization
 *
 * No route handler should directly mutate the DB for balances.
 * All balance changes must go through StateManager methods.
 *
 * Backend uses ethers v5.
 */

import { ethers } from 'ethers';

export class StateManager {
  constructor(prisma, contractAddress) {
    this.prisma          = prisma;
    this.contractAddress = contractAddress.toLowerCase();
  }

  // ─── Balance Read ──────────────────────────────────────────────────────────

  async getBalance(address) {
    const addr = address.toLowerCase();
    const rec  = await this.prisma.layer2Balance.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } }
    });
    return {
      pendingWei:   rec?.balanceWei         || '0',
      finalizedWei: rec?.pendingBalanceWei  || '0',
      // Note: we reuse existing schema fields:
      //   balanceWei        = pendingBalance (spendable, updated on every tx)
      //   pendingBalanceWei = finalizedBalance (only after batch finalization)
    };
  }

  // ─── Balance Write (internal only) ─────────────────────────────────────────

  async _upsertBalance(addr, pendingWei, finalizedWei) {
    await this.prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } },
      create: {
        userAddress:     addr,
        contractAddress: this.contractAddress,
        balanceWei:      pendingWei,
        pendingBalanceWei: finalizedWei,
      },
      update: {
        balanceWei:        pendingWei,
        pendingBalanceWei: finalizedWei,
      }
    });
  }

  async setBalance(address, balanceWei) {
    const addr = address.toLowerCase();
    const cur  = await this.getBalance(addr);
    await this._upsertBalance(addr, balanceWei, cur.finalizedWei);
  }

  // Credit pending balance (on deposit from L1)
  async creditPending(address, amountWei) {
    const addr = address.toLowerCase();
    const cur  = await this.getBalance(addr);
    const newPending    = (BigInt(cur.pendingWei)   + BigInt(amountWei)).toString();
    // Deposits also immediately go to finalized (they came from L1)
    const newFinalized  = (BigInt(cur.finalizedWei) + BigInt(amountWei)).toString();
    await this._upsertBalance(addr, newPending, newFinalized);
  }

  async canSpend(address, amountWei) {
    const { pendingWei } = await this.getBalance(address.toLowerCase());
    return BigInt(pendingWei) >= BigInt(amountWei);
  }

  // ─── Pending Transfer (L2 off-chain tx) ──────────────────────────────────
  // Deducts from pending state. Does NOT touch finalized state.
  // Finalized state only updates on batch finalization.
  async applyPendingTransfer(fromAddr, toAddr, valueWei) {
    const from = fromAddr.toLowerCase();
    const to   = toAddr.toLowerCase();
    const val  = BigInt(valueWei);

    const [fromBal, toBal] = await Promise.all([
      this.getBalance(from),
      this.getBalance(to),
    ]);

    if (BigInt(fromBal.pendingWei) < val)
      throw new Error(`Insufficient pending balance: ${from} has ${fromBal.pendingWei}, needs ${valueWei}`);

    await this._upsertBalance(from,
      (BigInt(fromBal.pendingWei)   - val).toString(),
      fromBal.finalizedWei                             // finalized unchanged
    );
    await this._upsertBalance(to,
      (BigInt(toBal.pendingWei)     + val).toString(),
      toBal.finalizedWei                               // finalized unchanged
    );
  }

  // ─── Finalization ─────────────────────────────────────────────────────────
  // Called ONLY when BatchFinalized event fires or auto-finalize triggers.
  // Commits pending state to finalized state for the transactions in this batch.
  async applyFinalizedBatch(batch) {
    if (!batch.transactions || batch.transactions.length === 0) return;

    console.log(`🔒 Finalizing batch ${batch.id} — committing ${batch.transactions.length} txs`);

    for (const tx of batch.transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);

      const [fromBal, toBal] = await Promise.all([
        this.getBalance(from),
        this.getBalance(to),
      ]);

      // Commit: adjust finalized balance
      const newFromFinalized = (BigInt(fromBal.finalizedWei) - val);
      const newToFinalized   = (BigInt(toBal.finalizedWei)   + val);

      await this._upsertBalance(from,
        fromBal.pendingWei,
        newFromFinalized < 0n ? '0' : newFromFinalized.toString()
      );
      await this._upsertBalance(to,
        toBal.pendingWei,
        newToFinalized.toString()
      );
    }

    console.log(`✅ Finalization committed for batch ${batch.id}`);
  }

  // ─── Reversion ────────────────────────────────────────────────────────────
  // Called on FraudProofAccepted — undo the pending state changes
  async revertBatch(batch) {
    if (!batch.transactions || batch.transactions.length === 0) return;

    console.log(`🔄 Reverting batch ${batch.id} — rolling back ${batch.transactions.length} txs`);

    for (const tx of batch.transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);

      const [fromBal, toBal] = await Promise.all([
        this.getBalance(from),
        this.getBalance(to),
      ]);

      // Restore pending state
      await this._upsertBalance(from,
        (BigInt(fromBal.pendingWei) + val).toString(),
        fromBal.finalizedWei
      );
      await this._upsertBalance(to,
        (BigInt(toBal.pendingWei) > val ? BigInt(toBal.pendingWei) - val : 0n).toString(),
        toBal.finalizedWei
      );
    }

    console.log(`✅ Reversion complete for batch ${batch.id}`);
  }

  // ─── Merkle Tree ──────────────────────────────────────────────────────────

  buildMerkleTree(leaves) {
    if (leaves.length === 0) {
      return { root: '0x' + '0'.repeat(64), layers: [], leaves: [] };
    }

    let layer = [...leaves];
    const layers = [layer];

    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left  = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
        const combined = left <= right
          ? ethers.utils.keccak256(ethers.utils.concat([left, right]))
          : ethers.utils.keccak256(ethers.utils.concat([right, left]));
        next.push(combined);
      }
      layers.push(next);
      layer = next;
    }

    return { root: layer[0], layers, leaves };
  }

  getMerkleProof(layers, index) {
    const proof = [];
    let idx = index;
    for (let i = 0; i < layers.length - 1; i++) {
      const layer    = layers[i];
      const sibling  = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (sibling < layer.length) proof.push(layer[sibling]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  verifyMerkleProof(leaf, proof, root) {
    let h = leaf;
    for (const p of proof) {
      h = h <= p
        ? ethers.utils.keccak256(ethers.utils.concat([h, p]))
        : ethers.utils.keccak256(ethers.utils.concat([p, h]));
    }
    return h === root;
  }

  // ─── Transaction Hashing ──────────────────────────────────────────────────

  hashTransaction(tx) {
    return ethers.utils.solidityKeccak256(
      ['address', 'address', 'uint256', 'uint256'],
      [tx.fromAddress, tx.toAddress, tx.valueWei, tx.nonce || 0]
    );
  }

  // ─── State Root Computation ───────────────────────────────────────────────
  // Computes a Merkle root of all account balances — this is what goes on-chain.
  async computeStateRoot() {
    const balances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress },
      orderBy: { userAddress: 'asc' }
    });

    if (balances.length === 0) {
      return ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));
    }

    const leaves = balances.map(b =>
      ethers.utils.solidityKeccak256(
        ['address', 'uint256'],
        [b.userAddress, ethers.BigNumber.from(b.balanceWei)]
      )
    );

    const { root } = this.buildMerkleTree(leaves);
    return root;
  }

  // ─── Batch Execution (off-chain simulation) ──────────────────────────────
  // This is the "parallel execution engine" — it simulates all txs and produces
  // a new state root without touching the DB finalState.
  async executeBatch(transactions) {
    const preStateRoot = await this.computeStateRoot();

    // Load all relevant balances into memory
    const addresses = new Set();
    for (const tx of transactions) {
      addresses.add(tx.fromAddress.toLowerCase());
      addresses.add(tx.toAddress.toLowerCase());
    }

    const balanceRecs = await this.prisma.layer2Balance.findMany({
      where: { userAddress: { in: [...addresses] }, contractAddress: this.contractAddress }
    });

    const state = new Map();
    for (const rec of balanceRecs) state.set(rec.userAddress, BigInt(rec.balanceWei));

    // Execute in-memory (no DB write — pure function)
    const txLeaves   = [];
    const txResults  = [];
    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);
      const bal  = state.get(from) ?? 0n;

      if (bal < val) {
        console.warn(`Skipping tx: ${from} insufficient (${bal} < ${val})`);
        txResults.push({ tx, success: false, reason: 'insufficient' });
        continue;
      }

      state.set(from, bal - val);
      state.set(to, (state.get(to) ?? 0n) + val);
      txLeaves.push(this.hashTransaction(tx));
      txResults.push({ tx, success: true });
    }

    const { root: txRoot } = this.buildMerkleTree(txLeaves);

    // Compute what the post-state root SHOULD be
    const postStateRoot = await this._computeStateRootFromMap(state);

    return { preStateRoot, txRoot, postStateRoot, txLeaves, txResults };
  }

  async _computeStateRootFromMap(stateMap) {
    const existing = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress }, orderBy: { userAddress: 'asc' }
    });

    const merged = new Map();
    for (const b of existing) merged.set(b.userAddress, BigInt(b.balanceWei));
    for (const [addr, bal] of stateMap) merged.set(addr, bal);

    const sorted = [...merged.entries()].sort(([a], [b]) => a.localeCompare(b));
    const leaves = sorted.map(([addr, bal]) =>
      ethers.utils.solidityKeccak256(['address', 'uint256'], [addr, bal])
    );

    if (!leaves.length) return ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));
    const { root } = this.buildMerkleTree(leaves);
    return root;
  }

  // ─── Fraud Proof Generation ───────────────────────────────────────────────
  // Real fraud proof: proves state transition is invalid.
  // "Given prevStateRoot + transactions, the resulting stateRoot is WRONG"
  async generateFraudProof(batch, txIndex = 0) {
    const txs = batch.transactions;
    if (!txs || txs.length === 0) throw new Error('Batch has no transactions');
    if (txIndex >= txs.length) txIndex = 0;

    // Build tx Merkle tree
    const txLeaves = txs.map(tx => this.hashTransaction(tx));
    const { root: computedTxRoot, layers } = this.buildMerkleTree(txLeaves);
    const txProof          = this.getMerkleProof(layers, txIndex);
    const fraudulentTxHash = txLeaves[txIndex];

    // Verify tx inclusion
    const txInBatch = this.verifyMerkleProof(fraudulentTxHash, txProof, computedTxRoot);

    // Re-execute batch to find what the CORRECT state root should be
    const { preStateRoot, txRoot, postStateRoot: correctStateRoot, txResults } = await this.executeBatch(txs);

    // Fraud check: claimed stateRoot vs. computed
    const claimedStateRoot = batch.stateRoot || '0x' + '0'.repeat(64);
    const isFraudulent     = !!batch.stateRoot && batch.stateRoot !== correctStateRoot;

    // Check if this specific tx caused the fraud
    const disputedTx  = txs[txIndex];
    const txSucceeded = txResults[txIndex]?.success ?? false;

    let explanation;
    if (!batch.stateRoot) {
      explanation = 'Batch has no state root submitted — cannot verify';
    } else if (isFraudulent) {
      explanation = `Invalid state transition: claimed ${claimedStateRoot.slice(0, 14)}... but correct execution yields ${correctStateRoot.slice(0, 14)}...`;
    } else {
      explanation = 'State roots match — this batch appears valid';
    }

    return {
      batchId:          batch.id,
      onChainBatchId:   batch.onChainId,
      txIndex,
      fraudulentTxHash,
      txProof,
      computedTxRoot,
      txRootMatch:      computedTxRoot === batch.transactionsRoot,
      claimedStateRoot,
      correctStateRoot,
      isFraudulent,
      disputedTransaction: disputedTx,
      explanation,
      // Params ready for contract call
      contractCallParams: {
        batchId:         batch.onChainId,
        fraudulentTxHash,
        txProof,
        correctStateRoot,
      }
    };
  }

  // ─── Withdrawal Merkle Tree ───────────────────────────────────────────────
  // Build tree from FINALIZED balances only
  async buildWithdrawalTree(_batchId) {
    const balances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress },
      orderBy: { userAddress: 'asc' }
    });

    let nonce = 0;
    const entries = balances
      .filter(b => BigInt(b.pendingBalanceWei || '0') > 0n) // only finalized balances
      .map(b => ({
        address: b.userAddress,
        amount:  b.pendingBalanceWei || '0', // finalized amount
        nonce:   nonce++,
      }));

    const leaves = entries.map(e =>
      ethers.utils.solidityKeccak256(
        ['address', 'uint256', 'uint256'],
        [e.address, e.amount, e.nonce]
      )
    );

    const { root: withdrawalRoot, layers } = this.buildMerkleTree(leaves);
    const proofs = entries.map((e, i) => ({
      ...e,
      leaf:  leaves[i],
      proof: this.getMerkleProof(layers, i),
    }));

    return { withdrawalRoot, entries: proofs };
  }
}