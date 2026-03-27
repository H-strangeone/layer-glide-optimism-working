/**
 * StateManager – Execution Engine
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THE ROOT CAUSE OF "EVERY BATCH LOOKS FRAUDULENT"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EXECUTION ORDER IN THE SYSTEM:
 *
 *   1. User submits tx → POST /api/transactions
 *   2. applyPendingTransfer(from, to, value) runs IMMEDIATELY
 *      → DB is updated: from.pendingWei -= value, to.pendingWei += value
 *   3. Tx stored in PendingTransaction table with status='pending'
 *   4. 10 seconds later: sequencer picks up pending txs, calls executeBatch()
 *
 * THE BUG in executeBatch():
 *
 *   executeBatch() loaded the touched accounts from DB:
 *     findMany({ where: { userAddress: { in: [from, to, ...] } } })
 *
 *   At this point the DB already has the POST-transfer balances (step 2 ran).
 *   So state loaded = { from: 500-X, to: X }  (AFTER transfer)
 *
 *   Then it applied the transfers IN MEMORY again:
 *     from: 500-X - X = 500-2X
 *     to:   X + X     = 2X
 *
 *   postStateRoot = Merkle([from:500-2X, to:2X])  ← WRONG (double-counted)
 *
 *   This is what got submitted to the L1 contract as the stateRoot.
 *
 * THE FRAUD PROVER saw:
 *   _replayStateUpToBatch: undo batch → { from:500, to:0 }
 *   _executeBatchInMemory: re-apply → { from:500-X, to:X }
 *   correctStateRoot = Merkle([from:500-X, to:X])
 *
 *   claimedStateRoot = Merkle([from:500-2X, to:2X])  (what sequencer submitted)
 *   MISMATCH → isFraudulent: true — even though it was a valid transfer!
 *
 * THE FIX:
 *
 *   Since applyPendingTransfer already updated the DB before executeBatch runs,
 *   the current DB state IS already the correct post-batch state.
 *   So: postStateRoot = computeStateRoot() = read current DB = correct.
 *
 *   executeBatch() still needs to:
 *     - Compute txRoot = Merkle of transaction hashes (unchanged)
 *     - Return preStateRoot = state before this batch (for informational use)
 *     - Return postStateRoot = current DB state (NOT re-executing in memory)
 *
 *   The fraud prover (_replayStateUpToBatch + _executeBatchInMemory) correctly
 *   reconstructs the pre-batch state and re-applies transactions. For a valid
 *   batch this produces the same result as the current DB state.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * BALANCE MODEL
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   balanceWei (DB)        = PENDING — updated on every accepted L2 tx
 *   pendingBalanceWei (DB) = FINALIZED — updated only after BatchFinalized
 *
 * ════════════════════════════════════════════════════════════════════════════
 * HARDHAT QUESTIONS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Q: Does a deposit count as a block?
 * A: Yes. Every transaction on Hardhat (or any EVM) is mined into a block.
 *    depositFunds() is a contract call → 1 transaction → 1 block.
 *    Block #1 = contract deployment, Block #2 = deposit, Block #3 = submitBatch, etc.
 *
 * Q: Why "<unrecognized-selector>" + "Transaction reverted without a reason"?
 * A: These are eth_call probes from ethers.js trying to call functions that
 *    don't match any selector in the deployed contract. Usually caused by:
 *    - ABI mismatch: server.js ABI has a function the deployed contract doesn't
 *    - contract.getBatch() called when ABI only has batches(uint256)
 *    - computeStateRoot() trying to call a view that doesn't exist on-chain
 *    These are READ calls (eth_call), not writes — they don't cost gas or
 *    affect state, they just log an error. The "Contract call: <unrecognized>"
 *    entries are from ethers trying to auto-detect contract features.
 *    Fix: ensure the ABI in server.js exactly matches the deployed contract.
 */

import { ethers } from 'ethers';

function fmtEth(wei) {
  try {
    const b = BigInt(wei);
    if (b < 0n) return `-${ethers.utils.formatEther((-b).toString())}`;
    return ethers.utils.formatEther(b.toString());
  } catch { return String(wei || '0'); }
}

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
      pendingWei:   rec?.balanceWei        || '0',
      finalizedWei: rec?.pendingBalanceWei || '0',
    };
  }

  // ─── Balance Write ─────────────────────────────────────────────────────────

  async _upsertBalance(addr, pendingWei, finalizedWei) {
    let finalClamped = finalizedWei;
    try { if (BigInt(finalizedWei) < 0n) finalClamped = '0'; } catch { finalClamped = '0'; }
    await this.prisma.layer2Balance.upsert({
      where:  { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } },
      create: { userAddress: addr, contractAddress: this.contractAddress, balanceWei: pendingWei, pendingBalanceWei: finalClamped },
      update: { balanceWei: pendingWei, pendingBalanceWei: finalClamped }
    });
  }

  async setBalance(address, balanceWei) {
    const addr = address.toLowerCase();
    const cur  = await this.getBalance(addr);
    await this._upsertBalance(addr, balanceWei, cur.finalizedWei);
  }

  // ─── L1 Deposit ───────────────────────────────────────────────────────────

  async creditPending(address, amountWei) {
    const addr = address.toLowerCase();
    const cur  = await this.getBalance(addr);
    const amt  = BigInt(amountWei);
    const newPending   = (BigInt(cur.pendingWei)   + amt).toString();
    const newFinalized = (BigInt(cur.finalizedWei) + amt).toString();
    await this._upsertBalance(addr, newPending, newFinalized);
    console.log(`💰 Deposit: ${addr} +${fmtEth(amountWei)} ETH`);
  }

  async canSpend(address, amountWei) {
    const { pendingWei } = await this.getBalance(address.toLowerCase());
    try { return BigInt(pendingWei) >= BigInt(amountWei); } catch { return false; }
  }

  // ─── L2 Transfer ──────────────────────────────────────────────────────────

  async applyPendingTransfer(fromAddr, toAddr, valueWei) {
    const from = fromAddr.toLowerCase();
    const to   = toAddr.toLowerCase();
    if (from === to) throw new Error('Self-transfer not allowed');
    const val = BigInt(valueWei);
    const [fromBal, toBal] = await Promise.all([this.getBalance(from), this.getBalance(to)]);
    if (BigInt(fromBal.pendingWei) < val)
      throw new Error(`Insufficient pending balance: ${from} has ${fromBal.pendingWei}, needs ${valueWei}`);
    await this._upsertBalance(from, (BigInt(fromBal.pendingWei) - val).toString(), fromBal.finalizedWei);
    await this._upsertBalance(to,   (BigInt(toBal.pendingWei)   + val).toString(), toBal.finalizedWei);
  }

  // ─── Batch Finalization ───────────────────────────────────────────────────

  async applyFinalizedBatch(batch) {
    if (!batch.transactions?.length) return;
    console.log(`🔒 Finalizing batch ${batch.id.slice(0, 8)} — ${batch.transactions.length} txs`);
    for (const tx of batch.transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      if (from === to) continue;
      const val = BigInt(tx.valueWei);
      const [fromBal, toBal] = await Promise.all([this.getBalance(from), this.getBalance(to)]);
      const newFromFin = BigInt(fromBal.finalizedWei) - val;
      await this._upsertBalance(from, fromBal.pendingWei, newFromFin < 0n ? '0' : newFromFin.toString());
      await this._upsertBalance(to,   toBal.pendingWei,   (BigInt(toBal.finalizedWei) + val).toString());
    }
    console.log(`✅ Finalization committed for batch ${batch.id.slice(0, 8)}`);
  }

  // ─── Batch Reversion ─────────────────────────────────────────────────────

  async revertBatch(batch) {
    if (!batch.transactions?.length) return;
    console.log(`🔄 Reverting batch ${batch.id.slice(0, 8)} — ${batch.transactions.length} txs`);
    for (const tx of batch.transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      if (from === to) continue;
      const val = BigInt(tx.valueWei);
      const [fromBal, toBal] = await Promise.all([this.getBalance(from), this.getBalance(to)]);
      await this._upsertBalance(from, (BigInt(fromBal.pendingWei) + val).toString(), fromBal.finalizedWei);
      const newToPending = BigInt(toBal.pendingWei) - val;
      await this._upsertBalance(to, newToPending.toString(), toBal.finalizedWei);
      if (newToPending < 0n)
        console.warn(`⚠️  Debt: ${to} owes ${fmtEth((-newToPending).toString())} ETH`);
    }
    console.log(`✅ Reversion complete for batch ${batch.id.slice(0, 8)}`);
  }

  // ─── Withdrawal ───────────────────────────────────────────────────────────

  async debitWithdrawal(address, amountWei) {
    const addr = address.toLowerCase();
    const cur  = await this.getBalance(addr);
    const amt  = BigInt(amountWei);
    if (BigInt(cur.finalizedWei) < amt)
      throw new Error(
        `Insufficient finalized balance. Finalized: ${fmtEth(cur.finalizedWei)} ETH, ` +
        `requested: ${fmtEth(amountWei)} ETH. ` +
        `Pending funds cannot be withdrawn until the challenge period passes.`
      );
    const newPending   = BigInt(cur.pendingWei) >= amt ? (BigInt(cur.pendingWei) - amt).toString() : '0';
    const newFinalized = (BigInt(cur.finalizedWei) - amt).toString();
    await this._upsertBalance(addr, newPending, newFinalized);
    console.log(`💸 Withdrawal: ${addr} -${fmtEth(amountWei)} ETH`);
  }

  // ─── Merkle Helpers ───────────────────────────────────────────────────────

  buildMerkleTree(leaves) {
    if (!leaves.length) return { root: '0x' + '0'.repeat(64), layers: [], leaves: [] };
    let layer  = [...leaves];
    const layers = [layer];
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const l = layer[i], r = i + 1 < layer.length ? layer[i + 1] : layer[i];
        next.push(l <= r
          ? ethers.utils.keccak256(ethers.utils.concat([l, r]))
          : ethers.utils.keccak256(ethers.utils.concat([r, l])));
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
      const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (sib < layers[i].length) proof.push(layers[i][sib]);
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

  hashTransaction(tx) {
    return ethers.utils.solidityKeccak256(
      ['address', 'address', 'uint256', 'uint256'],
      [tx.fromAddress, tx.toAddress, tx.valueWei, tx.nonce || 0]
    );
  }

  // ─── State Root from live DB ──────────────────────────────────────────────
  // Covers ALL accounts with pendingWei > 0, sorted by address.
  // This is the canonical state root — used both by the sequencer and as
  // the reference for fraud proof verification.

  async computeStateRoot() {
    const balances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress }, orderBy: { userAddress: 'asc' }
    });
    const positive = balances.filter(b => { try { return BigInt(b.balanceWei) > 0n; } catch { return false; } });
    if (!positive.length) return ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));
    const leaves = positive.map(b =>
      ethers.utils.solidityKeccak256(['address', 'uint256'], [b.userAddress, ethers.BigNumber.from(b.balanceWei)])
    );
    return this.buildMerkleTree(leaves).root;
  }

  // ─── State Root from in-memory Map ────────────────────────────────────────
  // Identical filter to computeStateRoot: only accounts with balance > 0.

  _computeStateRootFromMap(stateMap) {
    const sorted = [...stateMap.entries()]
      .filter(([, b]) => b > 0n)
      .sort(([a], [b]) => a.localeCompare(b));
    if (!sorted.length) return ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));
    const leaves = sorted.map(([addr, bal]) =>
      ethers.utils.solidityKeccak256(['address', 'uint256'], [addr, bal])
    );
    return this.buildMerkleTree(leaves).root;
  }

  // ─── Batch Execution for sequencer ────────────────────────────────────────
  //
  // THE KEY FIX HERE:
  //
  // applyPendingTransfer() already updated the DB before this runs.
  // So the current DB state IS the correct post-batch state.
  //
  // OLD (wrong): load touched accounts, re-apply transfers in memory
  //   → double-counts the transfers → wrong postStateRoot
  //
  // NEW (correct): postStateRoot = computeStateRoot() = read current DB
  //   The DB already reflects all the transfers. No re-execution needed.
  //   We still compute txRoot from the transaction hashes (unchanged).
  //
  // For preStateRoot (informational, not submitted on-chain):
  //   We reconstruct it by undoing the batch's transfers from current state.

  async executeBatch(transactions) {
    // Compute txRoot from the hashes of successful transactions
    // We need to figure out which txs are valid (have sufficient balance
    // pre-transfer). Since DB is already post-transfer, we reconstruct:
    const txLeaves  = [];
    const txResults = [];

    // To determine which txs succeeded, undo and redo in memory
    // purely to track the txLeaves — NOT to compute stateRoot
    const addresses = new Set(transactions.flatMap(tx => [tx.fromAddress.toLowerCase(), tx.toAddress.toLowerCase()]));
    const recs = await this.prisma.layer2Balance.findMany({
      where: { userAddress: { in: [...addresses] }, contractAddress: this.contractAddress }
    });

    // Reconstruct pre-transfer balances for these accounts only
    // (just to validate which txs were successful for txRoot)
    const preBalances = new Map();
    for (const r of recs) {
      try { preBalances.set(r.userAddress.toLowerCase(), BigInt(r.balanceWei)); }
      catch { preBalances.set(r.userAddress.toLowerCase(), 0n); }
    }
    // Undo this batch's transfers to get pre-batch balances for touched accounts
    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      if (from === to) continue;
      const val = BigInt(tx.valueWei);
      preBalances.set(from, (preBalances.get(from) ?? 0n) + val);  // restore
      preBalances.set(to,   (preBalances.get(to)   ?? 0n) - val);  // remove
    }

    // Now simulate execution against pre-balances to determine which txs succeed
    const simState = new Map(preBalances);
    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);

      if (from === to) {
        txLeaves.push(this.hashTransaction(tx));
        txResults.push({ tx, success: false, reason: 'self-transfer' });
        continue;
      }

      const bal = simState.get(from) ?? 0n;
      if (bal < val) {
        console.warn(`Skipping tx: ${from} insufficient (${bal} < ${val})`);
        txResults.push({ tx, success: false, reason: 'insufficient' });
        continue;
      }

      simState.set(from, bal - val);
      simState.set(to, (simState.get(to) ?? 0n) + val);
      txLeaves.push(this.hashTransaction(tx));
      txResults.push({ tx, success: true });
    }

    const { root: txRoot } = this.buildMerkleTree(txLeaves);

    // preStateRoot = state before these txs (informational)
    const preStateRoot = this._computeStateRootFromMap(preBalances);

    // postStateRoot = current DB state = correct result of applying these txs
    // This is what the sequencer submits to the L1 contract.
    // The fraud prover will reconstruct the same value via _replayStateUpToBatch
    // + _executeBatchInMemory for any valid batch.
    const postStateRoot = await this.computeStateRoot();

    return { preStateRoot, txRoot, postStateRoot, txLeaves, txResults };
  }

  // ─── Reconstruct pre-batch state for fraud proof ──────────────────────────
  //
  // Loads current DB (all accounts, post-all-batches state),
  // then undoes all batches from the target batch onward (including target).
  // Result: full global state as it existed just before the target batch ran.
  //
  // Uses GTE (>=) on createdAt: undo the target AND everything after it.
  // _executeBatchInMemory then re-applies just the target's transactions,
  // giving us the expected post-state to compare against claimedStateRoot.

  async _replayStateUpToBatch(targetBatch) {
    // Full global state
    const allBalances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress }
    });
    const state = new Map();
    for (const rec of allBalances) {
      try { state.set(rec.userAddress.toLowerCase(), BigInt(rec.balanceWei)); }
      catch { state.set(rec.userAddress.toLowerCase(), 0n); }
    }

    // Undo all batches at or after the target (newest first)
    const toUndo = await this.prisma.batch.findMany({
      where: {
        status:    { in: ['challenge_period', 'finalized', 'rejected'] },
        createdAt: { gte: targetBatch.createdAt },
      },
      orderBy:  { createdAt: 'desc' },
      include:  { transactions: true },
    });

    for (const batch of toUndo) {
      for (const tx of (batch.transactions || [])) {
        const from = tx.fromAddress.toLowerCase();
        const to   = tx.toAddress.toLowerCase();
        if (from === to) continue;
        const val = BigInt(tx.valueWei);
        state.set(from, (state.get(from) ?? 0n) + val);
        state.set(to,   (state.get(to)   ?? 0n) - val);
      }
    }

    return state;
  }

  // ─── Execute batch in memory (pure) ───────────────────────────────────────
  //
  // Takes a full global pre-state Map, applies the batch's transactions,
  // returns postStateRoot from the full resulting state.
  // Since executeBatch now submits postStateRoot = computeStateRoot() (current DB),
  // and _replayStateUpToBatch gives us the pre-batch global state,
  // re-applying the transactions here produces the same current DB state
  // → correctStateRoot matches claimedStateRoot for valid batches.

  _executeBatchInMemory(transactions, preState) {
    const state    = new Map(preState);
    const txLeaves = [];
    const txResults = [];

    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);

      if (from === to) {
        txLeaves.push(this.hashTransaction(tx));
        txResults.push({ tx, success: false, reason: 'self-transfer' });
        continue;
      }

      const bal = state.get(from) ?? 0n;
      if (bal < val) {
        txResults.push({ tx, success: false, reason: 'insufficient' });
        continue;
      }

      state.set(from, bal - val);
      state.set(to, (state.get(to) ?? 0n) + val);
      txLeaves.push(this.hashTransaction(tx));
      txResults.push({ tx, success: true });
    }

    const { root: txRoot } = this.buildMerkleTree(txLeaves);
    const postStateRoot = this._computeStateRootFromMap(state);
    return { txRoot, postStateRoot, txLeaves, txResults };
  }

  // ─── Fraud Proof Generation ───────────────────────────────────────────────

  async generateFraudProof(batch, txIndex = 0) {
    const txs = batch.transactions;
    if (!txs?.length) throw new Error('Batch has no transactions');
    if (txIndex >= txs.length) txIndex = 0;

    const preState     = await this._replayStateUpToBatch(batch);
    const preStateRoot = this._computeStateRootFromMap(preState);

    const { txRoot: computedTxRoot, postStateRoot: correctStateRoot, txLeaves, txResults } =
      this._executeBatchInMemory(txs, preState);

    const safeIdx    = Math.min(txIndex, Math.max(0, txLeaves.length - 1));
    const { layers } = this.buildMerkleTree(txLeaves);
    const txProof    = txLeaves.length ? this.getMerkleProof(layers, safeIdx) : [];
    const fraudTxHash = txLeaves.length ? txLeaves[safeIdx] : '0x' + '0'.repeat(64);

    const claimedStateRoot = batch.stateRoot || '0x' + '0'.repeat(64);

    const selfTransferTx = txs.find(tx =>
      tx.fromAddress.toLowerCase() === tx.toAddress.toLowerCase()
    );

    const stateRootMismatch = !!batch.stateRoot && batch.stateRoot !== correctStateRoot;
    const isFraudulent      = stateRootMismatch || !!selfTransferTx;

    let explanation;
    if (!batch.stateRoot) {
      explanation = 'Batch has no state root — cannot verify';
    } else if (selfTransferTx) {
      explanation =
        `Self-transfer fraud: ${selfTransferTx.fromAddress.slice(0, 10)}... sent to themselves. ` +
        `Claimed: ${claimedStateRoot.slice(0, 14)}... Correct: ${correctStateRoot.slice(0, 14)}...`;
    } else if (stateRootMismatch) {
      explanation =
        `Invalid state transition on batch #${batch.onChainId || batch.id.slice(0, 8)}: ` +
        `claimed ${claimedStateRoot.slice(0, 14)}... but correct is ${correctStateRoot.slice(0, 14)}...`;
    } else {
      explanation = `Batch #${batch.onChainId || batch.id.slice(0, 8)} is valid — state roots match`;
    }

    console.log(
      `🔍 Fraud check batch #${batch.onChainId || batch.id.slice(0, 8)}: ` +
      `pre=${preStateRoot.slice(0, 14)}... ` +
      `claimed=${claimedStateRoot.slice(0, 14)}... ` +
      `correct=${correctStateRoot.slice(0, 14)}... ` +
      `fraud=${isFraudulent}`
    );

    return {
      batchId: batch.id, onChainBatchId: batch.onChainId, txIndex: safeIdx,
      fraudulentTxHash: fraudTxHash, txProof, computedTxRoot,
      txRootMatch: computedTxRoot === batch.transactionsRoot,
      claimedStateRoot, correctStateRoot, preStateRoot,
      isFraudulent, selfTransferDetected: !!selfTransferTx,
      disputedTransaction: txs[txIndex], explanation,
      contractCallParams: {
        batchId: batch.onChainId,
        fraudulentTxHash: fraudTxHash,
        txProof,
        correctStateRoot,
      }
    };
  }

  // ─── Withdrawal Tree ──────────────────────────────────────────────────────

  async buildWithdrawalTree(_batchId) {
    const balances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress }, orderBy: { userAddress: 'asc' }
    });
    let nonce = 0;
    const entries = balances
      .filter(b => { try { return BigInt(b.pendingBalanceWei || '0') > 0n; } catch { return false; } })
      .map(b => ({ address: b.userAddress, amount: b.pendingBalanceWei || '0', nonce: nonce++ }));
    const leaves = entries.map(e =>
      ethers.utils.solidityKeccak256(['address', 'uint256', 'uint256'], [e.address, e.amount, e.nonce])
    );
    const { root: withdrawalRoot, layers } = this.buildMerkleTree(leaves);
    return {
      withdrawalRoot,
      entries: entries.map((e, i) => ({ ...e, leaf: leaves[i], proof: this.getMerkleProof(layers, i) }))
    };
  }
}