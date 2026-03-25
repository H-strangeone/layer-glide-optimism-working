import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * StateManager
 * 
 * Manages the L2 state machine:
 * - Pending balances (optimistic — applied immediately on tx submit)
 * - Finalized balances (only after batch finalizes)
 * - State root computation
 * - Fraud proof generation
 * - Merkle tree construction
 */
export class StateManager {
  constructor(prisma, contractAddress) {
    this.prisma = prisma;
    this.contractAddress = contractAddress.toLowerCase();
  }

  // ─── Balance Management ───────────────────────────────────────────────────

  async getBalance(address) {
    const addr = address.toLowerCase();
    const rec  = await this.prisma.layer2Balance.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } }
    });
    return {
      pendingWei:   rec?.balanceWei   || '0',
      finalizedWei: rec?.balanceWei   || '0',
    };
  }

  async setBalance(address, balanceWei) {
    const addr = address.toLowerCase();
    await this.prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } },
      create: { userAddress: addr, contractAddress: this.contractAddress, balanceWei },
      update: { balanceWei }
    });
  }

  async creditPending(address, amountWei) {
    const addr = address.toLowerCase();
    const rec  = await this.prisma.layer2Balance.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } }
    });
    const current = BigInt(rec?.balanceWei || '0');
    const updated = (current + BigInt(amountWei)).toString();

    await this.prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: this.contractAddress } },
      create: { userAddress: addr, contractAddress: this.contractAddress, balanceWei: updated },
      update: { balanceWei: updated }
    });
  }

  async canSpend(address, amountWei) {
    const { pendingWei } = await this.getBalance(address);
    return BigInt(pendingWei) >= BigInt(amountWei);
  }

  async applyPendingTransfer(fromAddr, toAddr, valueWei) {
    const from = fromAddr.toLowerCase();
    const to   = toAddr.toLowerCase();
    const val  = BigInt(valueWei);

    const fromRec = await this.prisma.layer2Balance.findUnique({
      where: { userAddress_contractAddress: { userAddress: from, contractAddress: this.contractAddress } }
    });
    const toRec = await this.prisma.layer2Balance.findUnique({
      where: { userAddress_contractAddress: { userAddress: to, contractAddress: this.contractAddress } }
    });

    const fromBal = BigInt(fromRec?.balanceWei || '0');
    const toBal   = BigInt(toRec?.balanceWei   || '0');

    if (fromBal < val) throw new Error(`Insufficient balance: ${from} has ${fromBal}, needs ${val}`);

    await this.prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: from, contractAddress: this.contractAddress } },
      create: { userAddress: from, contractAddress: this.contractAddress, balanceWei: (fromBal - val).toString() },
      update: { balanceWei: (fromBal - val).toString() }
    });

    await this.prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: to, contractAddress: this.contractAddress } },
      create: { userAddress: to, contractAddress: this.contractAddress, balanceWei: (toBal + val).toString() },
      update: { balanceWei: (toBal + val).toString() }
    });
  }

  // ─── Merkle Tree ──────────────────────────────────────────────────────────

  /**
   * Build Merkle tree from array of leaf hex strings.
   * Returns { root, layers, leaves }
   */
  buildMerkleTree(leaves) {
    if (leaves.length === 0) return { root: ethers.constants.HashZero, layers: [], leaves: [] };

    let layer = [...leaves];
    const layers = [layer];

    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left  = layer[i];
        const right = i + 1 < layer.length ? layer[i + 1] : layer[i]; // duplicate last if odd
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

  /**
   * Get Merkle proof for leaf at index
   */
  getMerkleProof(layers, index) {
    const proof = [];
    let idx = index;

    for (let i = 0; i < layers.length - 1; i++) {
      const layer = layers[i];
      const isRight  = idx % 2 === 1;
      const sibIndex = isRight ? idx - 1 : idx + 1;

      if (sibIndex < layer.length) {
        proof.push(layer[sibIndex]);
      }
      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  /**
   * Verify a Merkle proof
   */
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

  /**
   * Compute a deterministic state root from all L2 balances.
   * In production this would be a Merkle root of all account states.
   */
  async computeStateRoot() {
    const balances = await this.prisma.layer2Balance.findMany({
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

  /**
   * Execute a batch of transactions and return the resulting state root.
   * This is the "optimistic" execution that happens off-chain.
   */
  async executeBatch(transactions) {
    // Snapshot pre-state
    const preStateRoot = await this.computeStateRoot();

    // Apply each transaction to a local copy
    const stateChanges = new Map(); // address -> balance bigint

    // Load all relevant balances
    const addresses = new Set();
    for (const tx of transactions) {
      addresses.add(tx.fromAddress.toLowerCase());
      addresses.add(tx.toAddress.toLowerCase());
    }

    const balanceRecs = await this.prisma.layer2Balance.findMany({
      where: {
        userAddress: { in: [...addresses] },
        contractAddress: this.contractAddress
      }
    });

    for (const rec of balanceRecs) {
      stateChanges.set(rec.userAddress, BigInt(rec.balanceWei));
    }

    // Execute
    const txLeaves = [];
    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to   = tx.toAddress.toLowerCase();
      const val  = BigInt(tx.valueWei);

      const fromBal = stateChanges.get(from) || 0n;
      if (fromBal < val) {
        console.warn(`Skipping tx: ${from} insufficient balance`);
        continue;
      }

      stateChanges.set(from, fromBal - val);
      stateChanges.set(to, (stateChanges.get(to) || 0n) + val);
      txLeaves.push(this.hashTransaction(tx));
    }

    // Compute tx root
    const { root: txRoot } = this.buildMerkleTree(txLeaves);

    // Compute post-state root
    const postStateRoot = await this._computeStateRootFromChanges(stateChanges);

    return { preStateRoot, txRoot, postStateRoot, txLeaves, stateChanges };
  }

  async _computeStateRootFromChanges(stateChanges) {
    // Merge with all existing balances
    const existing = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress },
      orderBy: { userAddress: 'asc' }
    });

    const merged = new Map();
    for (const b of existing) merged.set(b.userAddress, BigInt(b.balanceWei));
    for (const [addr, bal] of stateChanges) merged.set(addr, bal);

    const sorted  = [...merged.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const leaves  = sorted.map(([addr, bal]) =>
      ethers.utils.solidityKeccak256(['address', 'uint256'], [addr, bal])
    );

    if (leaves.length === 0) return ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));
    const { root } = this.buildMerkleTree(leaves);
    return root;
  }

  // ─── Fraud Proof Generation ───────────────────────────────────────────────

  /**
   * Generate a full fraud proof for a specific transaction in a batch.
   * 
   * Process:
   * 1. Reconstruct the tx Merkle tree from DB
   * 2. Get Merkle proof that the disputed tx is in the batch
   * 3. Compute what the state root SHOULD be
   * 4. Compare with claimed state root
   * 
   * Returns everything needed to call submitFraudProof() on the contract.
   */
  async generateFraudProof(batch, txIndex = 0) {
    const transactions = batch.transactions;
    if (!transactions || transactions.length === 0) {
      throw new Error('Batch has no transactions');
    }

    if (txIndex >= transactions.length) {
      txIndex = 0; // default to first tx
    }

    // Hash all transactions to build tx tree
    const txLeaves = transactions.map(tx => this.hashTransaction(tx));
    const { root: computedTxRoot, layers } = this.buildMerkleTree(txLeaves);

    // Get Merkle proof for the disputed transaction
    const txProof = this.getMerkleProof(layers, txIndex);
    const fraudulentTxHash = txLeaves[txIndex];

    // Verify our computed tx root matches what's on-chain
    const txRootMatch = computedTxRoot === batch.transactionsRoot;

    // Reconstruct what the correct state root should be
    // by re-executing all transactions from the PREVIOUS state
    const prevStateRoot = batch.prevStateRoot || ethers.utils.keccak256(ethers.utils.toUtf8Bytes('genesis'));

    // Re-execute all transactions
    const { postStateRoot: correctStateRoot } = await this.executeBatch(transactions);

    // Check if fraud exists (claimed state root != correct state root)
    const isFraudulent = batch.stateRoot && batch.stateRoot !== correctStateRoot;

    return {
      batchId: batch.id,
      onChainBatchId: batch.onChainId,
      txIndex,
      fraudulentTxHash,
      txProof,
      computedTxRoot,
      txRootMatch,
      claimedStateRoot: batch.stateRoot || '0x' + '0'.repeat(64),
      correctStateRoot,
      isFraudulent,
      disputedTransaction: transactions[txIndex],
      explanation: isFraudulent
        ? `Batch claims state root ${batch.stateRoot?.slice(0, 10)}... but correct execution yields ${correctStateRoot.slice(0, 10)}...`
        : `State roots match — batch appears valid`,
      // Ready to submit to contract:
      contractCallParams: {
        batchId:           batch.onChainId,
        fraudulentTxHash,
        txProof,
        correctStateRoot,
      }
    };
  }

  // ─── Withdrawal Merkle Tree ───────────────────────────────────────────────

  /**
   * Build withdrawal Merkle tree for a finalized batch.
   * Returns root to publish on-chain + proofs for each user.
   */
  async buildWithdrawalTree(batchId) {
    const balances = await this.prisma.layer2Balance.findMany({
      where: { contractAddress: this.contractAddress },
      orderBy: { userAddress: 'asc' }
    });

    let nonce = 0;
    const withdrawalEntries = balances
      .filter(b => BigInt(b.balanceWei) > 0n)
      .map(b => ({
        address: b.userAddress,
        amount:  b.balanceWei,
        nonce:   nonce++,
      }));

    const leaves = withdrawalEntries.map(e =>
      ethers.utils.solidityKeccak256(
        ['address', 'uint256', 'uint256'],
        [e.address, e.amount, e.nonce]
      )
    );

    const { root, layers } = this.buildMerkleTree(leaves);

    // Generate proofs for each entry
    const proofs = withdrawalEntries.map((e, i) => ({
      ...e,
      leaf:  leaves[i],
      proof: this.getMerkleProof(layers, i),
    }));

    return { withdrawalRoot: root, entries: proofs };
  }
}