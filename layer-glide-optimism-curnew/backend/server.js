import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startSequencer } from './sequencer.js';
import { StateManager } from './StateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT             = parseInt(process.env.PORT || '5500');
const WS_PORT          = parseInt(process.env.WS_PORT || '5501');
const NETWORK          = process.env.NETWORK || 'localhost';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHALLENGE_PERIOD_MS = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeToWei(value) {
  if (!value) return '0';
  const v = value.toString().trim();
  if (v === '0' || v === '') return '0';
  if (!v.includes('.') && v.length >= 15) return v;
  try { return ethers.utils.parseEther(v).toString(); }
  catch { return v; }
}

function toUnixSeconds(ts) {
  if (!ts) return Math.floor(Date.now() / 1000);
  if (typeof ts === 'number') return ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return Math.floor(new Date(ts).getTime() / 1000);
}

function formatEther(wei) {
  try { return ethers.utils.formatEther(wei.toString()); }
  catch { return '0'; }
}

// ─── Prisma ───────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ─── State Manager ────────────────────────────────────────────────────────────
const stateManager = new StateManager(prisma, CONTRACT_ADDRESS);

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://localhost:8080',
    'http://localhost:3000', process.env.FRONTEND_URL,
  ].filter(Boolean)
}));
app.use(express.json({ limit: '1mb' }));

// ─── WebSocket ────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT });
const wsClients = new Set();
wss.on('connection', ws => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
  ws.send(JSON.stringify({ event: 'connected', ts: Date.now() }));
});
export function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}
console.log(`🔌 WebSocket on port ${WS_PORT}`);

// ─── Contract ABI (ethers v5) ─────────────────────────────────────────────────
const CONTRACT_ABI = [
  "function depositFunds() payable",
  "function withdrawFunds(uint256 _amount)",
  "function withdrawWithProof(bytes32 _withdrawalRoot, uint256 _amount, uint256 _nonce, bytes32[] calldata _proof)",
  "function submitBatch(bytes32 _txRoot, bytes32 _stateRoot, uint256 _txCount) returns (uint256)",
  "function finalizeBatch(uint256 _batchId)",
  "function publishWithdrawalRoot(uint256 _batchId, bytes32 _withdrawalRoot)",
  "function submitFraudProof(uint256 _batchId, bytes32 _fraudulentTxHash, bytes32[] calldata _txProof, bytes32 _correctStateRoot)",
  "function verifyL2Signature(address _from, address _to, uint256 _value, uint256 _nonce, uint256 _deadline, bytes calldata _sig) view returns (bool)",
  "function incrementNonce(address _user)",
  "function l1Balances(address) view returns (uint256)",
  "function l2Balances(address) view returns (uint256)",
  "function isOperator(address) view returns (bool)",
  "function operatorBonds(address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function admin() view returns (address)",
  "function nextBatchId() view returns (uint256)",
  "function challengePeriod() view returns (uint256)",
  "function currentStateRoot() view returns (bytes32)",
  "function isChallengeWindowOpen(uint256 _batchId) view returns (bool)",
  "function addOperator(address op)",
  "function removeOperator(address op)",
  "function depositOperatorBond() payable",
  "function isBatchFraudulent(uint256) view returns (bool)",
  "function batches(uint256) view returns (uint256 batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, uint256 submittedAt, address submitter, bool finalized, bool fraudulent, uint256 txCount)",
  "event BatchSubmitted(uint256 indexed batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, address submitter, uint256 txCount)",
  "event BatchFinalized(uint256 indexed batchId, bytes32 stateRoot)",
  "event FraudProofAccepted(uint256 indexed batchId, address challenger, uint256 reward)",
  "event FundsDeposited(address indexed user, uint256 amount)",
  "event FundsWithdrawn(address indexed user, uint256 amount)",
  "event OperatorSlashed(address indexed operator, uint256 amount, address challenger)",
  "event OperatorAdded(address indexed operator)",
  "event OperatorRemoved(address indexed operator)",
  "event WithdrawalRootPublished(uint256 indexed batchId, bytes32 withdrawalRoot)",
];

// ─── Blockchain ───────────────────────────────────────────────────────────────
let provider = null;
let wallet   = null;
let contract = null;

async function initBlockchain() {
  try {
    const rpcUrl = NETWORK === 'sepolia'
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : 'http://localhost:8545';

    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    await provider.getNetwork();

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error('PRIVATE_KEY not set');

    wallet   = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === '0x') throw new Error(`No contract at ${CONTRACT_ADDRESS}`);

    console.log(`✅ Blockchain: ${NETWORK}, contract: ${CONTRACT_ADDRESS}, operator: ${wallet.address}`);
    setupEventListeners();
    return true;
  } catch (err) {
    console.warn(`⚠️  Blockchain unavailable: ${err.message} — DB-only mode`);
    return false;
  }
}

// ─── Contract Event Listeners ─────────────────────────────────────────────────
function setupEventListeners() {
  if (!contract) return;

  contract.on('BatchFinalized', async (batchId, stateRoot) => {
    try {
      const id = batchId.toString();
      await prisma.batch.updateMany({ where: { onChainId: id }, data: { status: 'finalized' } });
      await prisma.pendingTransaction.updateMany({
        where: { batch: { onChainId: id } }, data: { status: 'finalized' }
      });
      broadcast('batch_finalized', { onChainId: id, stateRoot });
      console.log(`📡 BatchFinalized onChainId=${id}`);
    } catch (e) { console.error('BatchFinalized handler:', e.message); }
  });

  contract.on('FraudProofAccepted', async (batchId, challenger, reward) => {
    try {
      const id = batchId.toString();
      await prisma.batch.updateMany({ where: { onChainId: id }, data: { status: 'rejected' } });
      await prisma.pendingTransaction.updateMany({
        where: { batch: { onChainId: id } }, data: { status: 'rejected' }
      });
      broadcast('fraud_proof_accepted', { onChainId: id, challenger, reward: reward.toString() });
      console.log(`🚨 FraudProofAccepted batchId=${id} challenger=${challenger}`);
    } catch (e) { console.error('FraudProofAccepted handler:', e.message); }
  });

  contract.on('FundsDeposited', async (user, amount) => {
    try {
      await stateManager.creditPending(user.toLowerCase(), amount.toString());
      broadcast('balance_updated', { address: user.toLowerCase() });
    } catch (e) { console.error('FundsDeposited handler:', e.message); }
  });

  contract.on('FundsWithdrawn', async (user, amount) => {
    try {
      broadcast('balance_updated', { address: user.toLowerCase() });
    } catch (e) { console.error('FundsWithdrawn handler:', e.message); }
  });

  contract.on('OperatorSlashed', async (operator, amount, challenger) => {
    broadcast('operator_slashed', { operator, amount: amount.toString(), challenger });
    console.log(`⚡ OperatorSlashed ${operator} amount=${ethers.utils.formatEther(amount)} ETH`);
  });

  console.log('📡 Contract event listeners active');
}

// ─── Admin Middleware ─────────────────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  try {
    const addr = req.headers['x-admin-address'];
    if (!addr) return res.status(401).json({ error: 'x-admin-address header required' });
    if (!contract) return res.status(503).json({ error: 'Contract not available' });

    const [adminAddr, isOp] = await Promise.all([contract.admin(), contract.isOperator(addr)]);
    if (adminAddr.toLowerCase() !== addr.toLowerCase() && !isOp)
      return res.status(403).json({ error: 'Not authorized' });

    req.callerAddress = addr;
    next();
  } catch (e) {
    console.error('Admin auth:', e.message);
    res.status(500).json({ error: 'Auth failed' });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health
app.get('/health', async (req, res) => {
  let chainConnected = false;
  let blockNumber = null;
  if (provider) {
    try { blockNumber = await provider.getBlockNumber(); chainConnected = true; } catch {}
  }
  const pendingCount = await prisma.pendingTransaction.count({ where: { status: 'pending' } }).catch(() => 0);
  const batchCount   = await prisma.batch.count().catch(() => 0);

  res.json({
    status: 'ok', chainConnected, network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    blockNumber, pendingTxCount: pendingCount,
    totalBatches: batchCount,
    ts: Date.now()
  });
});

// Admin check
app.get('/api/admin/check', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    if (!contract) return res.json({ success: true, isAdmin: false, isOperator: false });

    const [adminAddr, isOp] = await Promise.all([contract.admin(), contract.isOperator(address)]);
    res.json({
      success: true,
      isAdmin: adminAddr.toLowerCase() === address.toLowerCase(),
      isOperator: isOp,
    });
  } catch (e) {
    console.error('Admin check:', e.message);
    res.status(500).json({ error: 'Admin check failed' });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

// Submit L2 transactions (signed by user)
app.post('/api/transactions', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0)
      return res.status(400).json({ error: 'transactions array required' });

    const results = [];

    for (const tx of transactions) {
      const fromAddr = (tx.from || tx.fromAddress || '').toLowerCase();
      const toAddr   = (tx.to   || tx.toAddress   || '').toLowerCase();
      const valueWei = normalizeToWei(tx.amount || tx.value || tx.valueWei || '0');
      const nonce    = tx.nonce ?? 0;
      const sig      = tx.signature;
      const deadline = tx.deadline || Math.floor(Date.now() / 1000) + 3600;

      if (!ethers.utils.isAddress(fromAddr)) return res.status(400).json({ error: `Invalid from: ${fromAddr}` });
      if (!ethers.utils.isAddress(toAddr))   return res.status(400).json({ error: `Invalid to: ${toAddr}` });
      if (BigInt(valueWei) <= 0n)            return res.status(400).json({ error: 'Value must be > 0' });

      // Verify signature
      if (!sig) return res.status(400).json({ error: 'Signature required' });

      const msgHash = ethers.utils.solidityKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [fromAddr, toAddr, valueWei, nonce, deadline]
      );
      const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(msgHash), sig).toLowerCase();
      if (recovered !== fromAddr) return res.status(400).json({ error: `Signature mismatch: recovered ${recovered}` });

      // Nonce check
      const nonceRecord = await prisma.nonce.findUnique({
        where: { userAddress_contractAddress: { userAddress: fromAddr, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
      });
      const expectedNonce = nonceRecord ? nonceRecord.currentNonce : 0;
      if (nonce !== expectedNonce) return res.status(400).json({ error: `Invalid nonce: expected ${expectedNonce}, got ${nonce}` });

      // Balance check (pending L2 balance)
      const canSpend = await stateManager.canSpend(fromAddr, valueWei);
      if (!canSpend) return res.status(400).json({ error: `Insufficient L2 balance for ${fromAddr}` });

      // Apply optimistic balance update
      await stateManager.applyPendingTransfer(fromAddr, toAddr, valueWei);

      // Store in pool
      const stored = await prisma.pendingTransaction.create({
        data: {
          fromAddress: fromAddr,
          toAddress:   toAddr,
          valueWei,
          nonce,
          signature:   sig,
          status:      'pending',
        }
      });

      // Increment nonce
      await prisma.nonce.upsert({
        where: { userAddress_contractAddress: { userAddress: fromAddr, contractAddress: CONTRACT_ADDRESS.toLowerCase() } },
        create: { userAddress: fromAddr, contractAddress: CONTRACT_ADDRESS.toLowerCase(), currentNonce: 1 },
        update: { currentNonce: { increment: 1 } }
      });

      broadcast('tx_added', { id: stored.id, from: fromAddr, to: toAddr, valueWei });
      results.push({ id: stored.id, status: 'pending' });
    }

    return res.status(201).json({ success: true, count: results.length, transactions: results });
  } catch (e) {
    console.error('POST /api/transactions:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/transactions/pending', async (req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({
      where: { status: 'pending' }, orderBy: { createdAt: 'asc' }
    });
    res.json(txs.map(t => ({ ...t, createdAt: toUnixSeconds(t.createdAt) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/live', async (req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({
      orderBy: { createdAt: 'desc' }, take: 20, include: { batch: true }
    });
    res.json(txs.map(t => ({
      hash: t.id, from: t.fromAddress, to: t.toAddress, value: t.valueWei,
      status: t.status, createdAt: toUnixSeconds(t.createdAt),
      batchId: t.batch?.onChainId || null,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/network', async (req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({
      orderBy: { createdAt: 'desc' }, include: { batch: true }
    });
    res.json(txs.map(t => ({
      hash: t.id, from: t.fromAddress, to: t.toAddress, value: t.valueWei,
      status: t.batch?.status || t.status, createdAt: toUnixSeconds(t.createdAt),
      batchId: t.batch?.onChainId || null, type: 'transfer', isInBatch: !!t.batch,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/user/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    const txs  = await prisma.pendingTransaction.findMany({
      where: { OR: [{ fromAddress: addr }, { toAddress: addr }] },
      include: { batch: true }, orderBy: { createdAt: 'desc' }
    });
    res.json({
      transactions: txs.map(t => ({
        hash: t.id, from: t.fromAddress, to: t.toAddress, value: t.valueWei,
        status: t.batch?.status || t.status, createdAt: toUnixSeconds(t.createdAt),
        batchId: t.batch?.onChainId || null, type: 'transfer', isInBatch: !!t.batch,
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Batches ──────────────────────────────────────────────────────────────────

app.get('/api/batches', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: 'desc' }, include: { transactions: true }
    });
    res.json(batches);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches/user/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    const batches = await prisma.batch.findMany({
      where: { transactions: { some: { OR: [{ fromAddress: addr }, { toAddress: addr }] } } },
      include: { transactions: true }, orderBy: { createdAt: 'desc' }
    });
    res.json(batches);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id }, include: { transactions: true, challenges: true }
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    res.json(batch);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Fraud Proof Marketplace ──────────────────────────────────────────────────

// Get all challengeable batches (in challenge window)
app.get('/api/fraud-proof/challengeable', async (req, res) => {
  try {
    const now = new Date();
    const batches = await prisma.batch.findMany({
      where: {
        status: 'challenge_period',
        challengeEndsAt: { gt: now },
        onChainId: { not: null },
      },
      include: { transactions: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(batches.map(b => ({
      ...b,
      timeLeftMs: b.challengeEndsAt ? b.challengeEndsAt.getTime() - Date.now() : 0,
      txCount: b.transactions.length,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generate fraud proof for a batch
app.post('/api/fraud-proof/generate', async (req, res) => {
  try {
    const { batchId, txIndex } = req.body;
    if (!batchId) return res.status(400).json({ error: 'batchId required' });

    const batch = await prisma.batch.findUnique({
      where: { id: batchId }, include: { transactions: true }
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const proof = await stateManager.generateFraudProof(batch, txIndex || 0);
    res.json(proof);
  } catch (e) {
    console.error('Generate fraud proof:', e);
    res.status(500).json({ error: e.message });
  }
});

// Submit fraud proof (via smart contract)
app.post('/api/fraud-proof/submit', async (req, res) => {
  try {
    const { batchId, fraudulentTxHash, txProof, correctStateRoot, challengerAddress } = req.body;

    if (!batchId || !fraudulentTxHash || !txProof || !correctStateRoot)
      return res.status(400).json({ error: 'batchId, fraudulentTxHash, txProof, correctStateRoot required' });

    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'challenge_period') return res.status(400).json({ error: 'Not in challenge period' });
    if (!batch.onChainId) return res.status(400).json({ error: 'Batch not on-chain' });

    // Record challenge in DB
    const challenge = await prisma.challenge.create({
      data: {
        batchId: batch.id,
        challengerAddress: (challengerAddress || '0x0000000000000000000000000000000000000000').toLowerCase(),
        fraudProofHash: fraudulentTxHash,
        merkleProof: JSON.stringify(txProof),
        status: 'pending',
      }
    });

    // Submit to contract
    if (contract) {
      try {
        const txRes = await contract.submitFraudProof(
          ethers.BigNumber.from(batch.onChainId),
          fraudulentTxHash,
          txProof,
          correctStateRoot
        );
        const receipt = await txRes.wait();

        await prisma.challenge.update({
          where: { id: challenge.id },
          data: { status: 'accepted', onChainTxHash: receipt.transactionHash }
        });

        broadcast('fraud_proof_submitted', { batchId: batch.id, onChainId: batch.onChainId, txHash: receipt.transactionHash });
        return res.json({ success: true, txHash: receipt.transactionHash, challenge });
      } catch (err) {
        await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'rejected' } });
        return res.status(400).json({ error: `Contract rejected proof: ${err.message}`, challenge });
      }
    }

    // DB-only mode
    res.json({ success: true, message: 'Challenge stored (DB-only mode)', challenge });
  } catch (e) {
    console.error('Submit fraud proof:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get all challenges
app.get('/api/fraud-proof/challenges', async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      orderBy: { createdAt: 'desc' },
      include: { batch: true }
    });
    res.json(challenges);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Old fraud proof endpoint for backward compat
app.post('/api/rollup/fraud-proof', async (req, res) => {
  const { batchId, fraudProof, merkleProof } = req.body;
  res.json({ isValid: true, message: 'Use /api/fraud-proof/submit for production', batchId, fraudProof: !!fraudProof });
});

// ─── Balance ──────────────────────────────────────────────────────────────────

app.get('/api/balance/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();

    // L1 from chain
    let layer1Wei = '0';
    if (provider) {
      try { layer1Wei = (await provider.getBalance(addr)).toString(); } catch {}
    }

    // L2 from state manager (pending + finalized)
    const { pendingWei, finalizedWei } = await stateManager.getBalance(addr);

    res.json({
      layer1Balance: formatEther(layer1Wei),
      layer2Balance: formatEther(pendingWei),    // Total spendable
      finalizedBalance: formatEther(finalizedWei),
      pendingBalance: formatEther(pendingWei),
      layer1BalanceWei: layer1Wei,
      layer2BalanceWei: pendingWei,
      finalizedWei,
      pendingWei,
    });
  } catch (e) {
    console.error('Balance:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/balance/update', async (req, res) => {
  try {
    const { userAddress, contractAddress, balance } = req.body;
    if (!userAddress) return res.status(400).json({ error: 'userAddress required' });

    await stateManager.setBalance(
      userAddress.toLowerCase(),
      normalizeToWei(balance)
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Nonce ────────────────────────────────────────────────────────────────────

app.get('/api/nonce/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    const rec  = await prisma.nonce.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
    });
    res.json({ nonce: rec?.currentNonce || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Metrics Dashboard ────────────────────────────────────────────────────────

app.get('/api/metrics', async (req, res) => {
  try {
    const [totalTxs, pendingTxs, totalBatches, finalizedBatches, rejectedBatches, challenges] = await Promise.all([
      prisma.pendingTransaction.count(),
      prisma.pendingTransaction.count({ where: { status: 'pending' } }),
      prisma.batch.count(),
      prisma.batch.count({ where: { status: 'finalized' } }),
      prisma.batch.count({ where: { status: 'rejected' } }),
      prisma.challenge.count(),
    ]);

    // Gas savings: estimate L1 cost vs L2 batch
    const avgTxsPerBatch = totalBatches > 0 ? totalTxs / totalBatches : 0;
    const estimatedL1GasPerTx = 21000;
    const batchOverhead = 500000; // Gas for one L1 batch submission
    const gasSavingPct = avgTxsPerBatch > 0
      ? Math.round((1 - batchOverhead / (avgTxsPerBatch * estimatedL1GasPerTx)) * 100)
      : 95;

    res.json({
      totalTransactions: totalTxs,
      pendingTransactions: pendingTxs,
      totalBatches,
      finalizedBatches,
      rejectedBatches,
      activeChallenges: challenges,
      avgTxsPerBatch: Math.round(avgTxsPerBatch),
      estimatedGasSaving: `~${Math.max(0, gasSavingPct)}%`,
      compressionRatio: avgTxsPerBatch > 0 ? `${Math.round(avgTxsPerBatch)}:1` : 'N/A',
      networkHealth: pendingTxs < 100 ? 'healthy' : 'congested',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Operators ────────────────────────────────────────────────────────────────

app.get('/api/operators', async (req, res) => {
  try {
    const ops = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    if (contract) {
      const enriched = await Promise.all(ops.map(async op => {
        try {
          const [active, bond] = await Promise.all([
            contract.isOperator(op.address),
            contract.operatorBonds(op.address),
          ]);
          return { ...op, isActive: active, bondEth: formatEther(bond) };
        } catch { return op; }
      }));
      return res.json(enriched);
    }
    res.json(ops);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/operators', async (req, res) => {
  try {
    const ops = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(ops);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/operators', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });

    if (contract) {
      const tx = await contract.addOperator(address);
      await tx.wait();
    }
    const op = await prisma.operator.upsert({
      where: { address: address.toLowerCase() },
      create: { address: address.toLowerCase(), isActive: true },
      update: { isActive: true }
    });
    res.json({ success: true, operator: op });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/operators/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (contract) { const tx = await contract.removeOperator(address); await tx.wait(); }
    await prisma.operator.update({ where: { address: address.toLowerCase() }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/contracts', async (req, res) => {
  try {
    const d = await prisma.contractDeployment.findMany();
    res.json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Gas Prices ───────────────────────────────────────────────────────────────

app.get('/api/gas-prices', async (req, res) => {
  try {
    if (!provider) return res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' });
    const fee = await provider.getFeeData();
    const gwei = Math.round(parseFloat(ethers.utils.formatUnits(fee.gasPrice || '0', 'gwei')));
    res.json({
      slow: (gwei * 0.8).toFixed(0), standard: gwei.toFixed(0),
      fast: (gwei * 1.2).toFixed(0), rapid: (gwei * 1.5).toFixed(0),
    });
  } catch { res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' }); }
});

// ─── State Root ───────────────────────────────────────────────────────────────

app.get('/api/state-root', async (req, res) => {
  try {
    const root = contract ? await contract.currentStateRoot() : '0x' + '0'.repeat(64);
    const latestBatch = await prisma.batch.findFirst({
      orderBy: { createdAt: 'desc' }, where: { status: { not: 'rejected' } }
    });
    res.json({
      currentStateRoot: root,
      latestBatchId: latestBatch?.onChainId || null,
      latestBatchStatus: latestBatch?.status || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Auto-Finalize Cron ───────────────────────────────────────────────────────
setInterval(async () => {
  if (!contract) return;
  try {
    const now = new Date();
    const eligible = await prisma.batch.findMany({
      where: { status: 'challenge_period', challengeEndsAt: { lt: now }, onChainId: { not: null } }
    });
    for (const batch of eligible) {
      try {
        console.log(`⏰ Auto-finalizing batch onChainId=${batch.onChainId}`);
        const tx = await contract.finalizeBatch(ethers.BigNumber.from(batch.onChainId));
        await tx.wait();
        // DB updated by event listener
      } catch (e) {
        console.error(`Auto-finalize failed for ${batch.onChainId}:`, e.message);
        // If challenge period hasn't passed on-chain, mark as error so we retry
      }
    }
  } catch (e) { console.error('Auto-finalize cron:', e.message); }
}, 30_000);

// ─── Start ────────────────────────────────────────────────────────────────────
initBlockchain().then((connected) => {
  startSequencer({ contract, wallet, broadcast, stateManager, prisma });
  app.listen(PORT, () => {
    console.log(`🚀 LayerGlide backend on http://localhost:${PORT}`);
    console.log(`   Blockchain: ${connected ? '✅ connected' : '⚠️  DB-only mode'}`);
  });
});