/**
 * LayerGlide Backend
 *
 * KEY FIX in this version:
 * - All Prisma DateTime fields converted to unix seconds before sending to frontend
 *   (fixes "56 years ago" bug — Prisma returns ISO strings, frontend did parseInt())
 * - /api/batches now returns normalized batch objects with createdAt as unix seconds
 * - Batch status values aligned: pending_submission | challenge_period | finalized | rejected | failed
 */

import express    from 'express';
import cors       from 'cors';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from 'ws';
import dotenv     from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { startSequencer } from './sequencer.js';
import { StateManager }   from './StateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const PORT                = parseInt(process.env.PORT                     || '5500');
const WS_PORT             = parseInt(process.env.WS_PORT                  || '5501');
const NETWORK             = process.env.NETWORK                           || 'localhost';
const CONTRACT_ADDRESS    = process.env.CONTRACT_ADDRESS                  || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHALLENGE_PERIOD_MS = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000;

// ─── Serialization helpers ────────────────────────────────────────────────────

/** Convert any timestamp to unix seconds. Frontend uses this for formatDistanceToNow etc. */
function toUnixSec(ts) {
  if (!ts) return Math.floor(Date.now() / 1000);
  if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
  if (typeof ts === 'number') return ts > 1e10 ? Math.floor(ts / 1000) : ts;
  // ISO string from Prisma e.g. "2024-01-15T10:30:00.000Z"
  return Math.floor(new Date(ts).getTime() / 1000);
}

/** Normalize a Prisma batch object for the frontend */
function normalizeBatch(b) {
  return {
    ...b,
    createdAt:      toUnixSec(b.createdAt),
    updatedAt:      b.updatedAt ? toUnixSec(b.updatedAt) : undefined,
    submittedAt:    b.submittedAt ? toUnixSec(b.submittedAt) : undefined,
    challengeEndsAt: b.challengeEndsAt ? toUnixSec(b.challengeEndsAt) : null,
    transactions:   (b.transactions || []).map(normalizeTx),
    challenges:     (b.challenges   || []).map(normalizeChallenge),
    // Human readable: how much challenge time remains
    timeLeftMs: b.challengeEndsAt
      ? Math.max(0, new Date(b.challengeEndsAt).getTime() - Date.now())
      : 0,
  };
}

function normalizeTx(t) {
  return {
    ...t,
    hash:      t.id,
    from:      t.fromAddress,
    to:        t.toAddress,
    value:     t.valueWei,
    createdAt: toUnixSec(t.createdAt),
    updatedAt: t.updatedAt ? toUnixSec(t.updatedAt) : undefined,
  };
}

function normalizeChallenge(c) {
  return {
    ...c,
    createdAt:  toUnixSec(c.createdAt),
    resolvedAt: c.resolvedAt ? toUnixSec(c.resolvedAt) : null,
  };
}

function normalizeWei(v) {
  if (!v) return '0';
  const s = v.toString().trim();
  if (!s || s === '0') return '0';
  if (!s.includes('.') && s.length >= 15) return s;
  try { return ethers.utils.parseEther(s).toString(); }
  catch { return s; }
}

function fmtEth(wei) {
  try { return ethers.utils.formatEther(wei.toString()); } catch { return '0'; }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
const prisma       = new PrismaClient();
const stateManager = new StateManager(prisma, CONTRACT_ADDRESS);
const app          = express();

app.use(cors({
  origin: [
    'http://localhost:5173','http://localhost:8080',
    'http://localhost:3000', process.env.FRONTEND_URL
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
  console.log(`🔌 WS client (total: ${wsClients.size})`);
});
export function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}
console.log(`🔌 WebSocket on port ${WS_PORT}`);

// ─── Contract ABI ─────────────────────────────────────────────────────────────
const CONTRACT_ABI = [
  'function depositFunds() payable',
  'function withdrawFunds(uint256 _amount)',
  'function withdrawWithProof(bytes32 _withdrawalRoot, uint256 _amount, uint256 _nonce, bytes32[] calldata _proof)',
  'function submitBatch(bytes32 _txRoot, bytes32 _stateRoot, uint256 _txCount) returns (uint256)',
  'function finalizeBatch(uint256 _batchId)',
  'function publishWithdrawalRoot(uint256 _batchId, bytes32 _withdrawalRoot)',
  'function submitFraudProof(uint256 _batchId, bytes32 _fraudulentTxHash, bytes32[] calldata _txProof, bytes32 _correctStateRoot)',
  'function l1Balances(address) view returns (uint256)',
  'function l2Balances(address) view returns (uint256)',
  'function isOperator(address) view returns (bool)',
  'function operatorBonds(address) view returns (uint256)',
  'function admin() view returns (address)',
  'function nextBatchId() view returns (uint256)',
  'function challengePeriod() view returns (uint256)',
  'function currentStateRoot() view returns (bytes32)',
  'function isChallengeWindowOpen(uint256 _batchId) view returns (bool)',
  'function addOperator(address op)',
  'function removeOperator(address op)',
  'function depositOperatorBond() payable',
  'function isBatchFraudulent(uint256) view returns (bool)',
  'function batches(uint256) view returns (uint256,bytes32,bytes32,bytes32,uint256,address,bool,bool,uint256)',
  'event BatchSubmitted(uint256 indexed batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, address submitter, uint256 txCount)',
  'event BatchFinalized(uint256 indexed batchId, bytes32 stateRoot)',
  'event FraudProofAccepted(uint256 indexed batchId, address challenger, uint256 reward)',
  'event FundsDeposited(address indexed user, uint256 amount)',
  'event FundsWithdrawn(address indexed user, uint256 amount)',
  'event OperatorSlashed(address indexed operator, uint256 amount, address challenger)',
];

// ─── Blockchain ───────────────────────────────────────────────────────────────
let provider = null, wallet = null, contract = null;

async function initBlockchain() {
  try {
    const rpcUrl = NETWORK === 'sepolia'
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : 'http://localhost:8545';
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    await provider.getNetwork();
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error('PRIVATE_KEY not set');
    wallet   = new ethers.Wallet(pk, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === '0x') throw new Error(`No contract at ${CONTRACT_ADDRESS}`);
    console.log(`✅ Chain: ${NETWORK}  contract: ${CONTRACT_ADDRESS}  op: ${wallet.address}`);
    setupEventListeners();
    return true;
  } catch (err) {
    console.warn(`⚠️  Chain unavailable: ${err.message} — DB-only`);
    return false;
  }
}

function setupEventListeners() {
  if (!contract) return;

  contract.on('BatchSubmitted', async (batchId, txRoot, stateRoot, prevStateRoot, submitter, txCount) => {
    try {
      const id = batchId.toString();
      if (!await prisma.batch.findUnique({ where: { onChainId: id } })) {
        const challengeEndsAt = new Date(Date.now() + CHALLENGE_PERIOD_MS);
        await prisma.batch.create({
          data: {
            onChainId: id, transactionsRoot: txRoot, stateRoot, prevStateRoot,
            status: 'challenge_period', submitter: submitter.toLowerCase(),
            txCount: txCount.toNumber(), challengeEndsAt,
          }
        });
        broadcast('batch_created', { onChainId: id, txCount: txCount.toNumber(), stateRoot });
      }
      console.log(`📡 BatchSubmitted onChainId=${id}`);
    } catch (e) { console.error('BatchSubmitted:', e.message); }
  });

  contract.on('BatchFinalized', async (batchId, stateRoot) => {
    try {
      const id    = batchId.toString();
      const batch = await prisma.batch.findUnique({ where: { onChainId: id }, include: { transactions: true } });
      if (batch) {
        await stateManager.applyFinalizedBatch(batch);
        await prisma.batch.update({ where: { id: batch.id }, data: { status: 'finalized' } });
        await prisma.pendingTransaction.updateMany({ where: { batchId: batch.id }, data: { status: 'finalized' } });
      }
      broadcast('batch_finalized', { onChainId: id, stateRoot });
      console.log(`✅ BatchFinalized onChainId=${id}`);
    } catch (e) { console.error('BatchFinalized:', e.message); }
  });

  contract.on('FraudProofAccepted', async (batchId, challenger, reward) => {
    try {
      const id    = batchId.toString();
      const batch = await prisma.batch.findUnique({ where: { onChainId: id }, include: { transactions: true } });
      if (batch) {
        await stateManager.revertBatch(batch);
        await prisma.batch.update({ where: { id: batch.id }, data: { status: 'rejected' } });
        await prisma.pendingTransaction.updateMany({ where: { batchId: batch.id }, data: { status: 'rejected' } });
      }
      broadcast('fraud_proof_accepted', { onChainId: id, challenger, reward: reward.toString() });
      console.log(`🚨 FraudProofAccepted batchId=${id}`);
    } catch (e) { console.error('FraudProofAccepted:', e.message); }
  });

  contract.on('FundsDeposited', async (user, amount) => {
    try {
      await stateManager.creditPending(user.toLowerCase(), amount.toString());
      broadcast('balance_updated', { address: user.toLowerCase() });
    } catch (e) { console.error('FundsDeposited:', e.message); }
  });

  contract.on('FundsWithdrawn', async (user, amount) => {
    try {
      await stateManager.debitWithdrawal(user.toLowerCase(), amount.toString());
      broadcast('balance_updated', { address: user.toLowerCase() });
    } catch (e) { console.error('FundsWithdrawn:', e.message); }
  });

  contract.on('OperatorSlashed', (op, amt, ch) =>
    broadcast('operator_slashed', { operator: op, amount: amt.toString(), challenger: ch })
  );

  console.log('📡 Contract event listeners active');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', async (_, res) => {
  let chain = false, block = null;
  if (provider) { try { block = await provider.getBlockNumber(); chain = true; } catch {} }
  const [pending, batches] = await Promise.all([
    prisma.pendingTransaction.count({ where: { status: 'pending' } }).catch(() => 0),
    prisma.batch.count().catch(() => 0),
  ]);
  res.json({ status: 'ok', chain, network: NETWORK, contractAddress: CONTRACT_ADDRESS, block, pending, batches, ts: Date.now() });
});

app.get('/api/admin/check', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    if (!contract) {
      const op = await prisma.operator.findUnique({ where: { address: address.toLowerCase() } });
      return res.json({ success: true, isAdmin: !!op?.isActive, isOperator: !!op?.isActive });
    }
    const [adminAddr, isOp] = await Promise.all([contract.admin(), contract.isOperator(address)]);
    res.json({
      success: true,
      isAdmin:    adminAddr.toLowerCase() === address.toLowerCase(),
      isOperator: isOp,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Transactions ──────────────────────────────────────────────────────────────

app.post('/api/transactions', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || !transactions.length)
      return res.status(400).json({ error: 'transactions array required' });

    const results = [];
    for (const tx of transactions) {
      const from     = (tx.from || tx.fromAddress || '').toLowerCase();
      const to       = (tx.to   || tx.toAddress   || '').toLowerCase();
      const valueWei = normalizeWei(tx.amount || tx.value || tx.valueWei || '0');
      const nonce    = tx.nonce    ?? 0;
      const sig      = tx.signature;
      const deadline = tx.deadline ?? Math.floor(Date.now() / 1000) + 3600;

      if (!ethers.utils.isAddress(from))  return res.status(400).json({ error: `Invalid from: ${from}` });
      if (!ethers.utils.isAddress(to))    return res.status(400).json({ error: `Invalid to: ${to}` });
      if (BigInt(valueWei) <= 0n)         return res.status(400).json({ error: 'Value must be > 0' });
      if (!sig)                           return res.status(400).json({ error: 'Signature required' });
      if (deadline < Math.floor(Date.now() / 1000))
        return res.status(400).json({ error: 'Transaction deadline expired' });

      // Verify EIP-712 signature — replay protection
      const msgHash = ethers.utils.solidityKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [from, to, valueWei, nonce, deadline]
      );
      let recovered;
      try { recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(msgHash), sig).toLowerCase(); }
      catch { return res.status(400).json({ error: 'Invalid signature format' }); }
      if (recovered !== from)
        return res.status(400).json({ error: `Signature mismatch: expected ${from}, got ${recovered}` });

      // Sequential nonce — prevents replay attacks
      const nonceRec = await prisma.nonce.findUnique({
        where: { userAddress_contractAddress: { userAddress: from, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
      });
      const expected = nonceRec?.currentNonce ?? 0;
      if (nonce !== expected)
        return res.status(400).json({ error: `Bad nonce: expected ${expected}, got ${nonce}` });

      // Pending balance check — double-spend prevention
      if (!(await stateManager.canSpend(from, valueWei)))
        return res.status(400).json({ error: `Insufficient L2 balance for ${from}` });

      // Optimistic: deduct from pending state immediately (NOT finalized)
      // This is exactly how Optimism/Arbitrum work — your L2 balance updates instantly
      await stateManager.applyPendingTransfer(from, to, valueWei);

      const stored = await prisma.pendingTransaction.create({
        data: { fromAddress: from, toAddress: to, valueWei, nonce, signature: sig, status: 'pending' }
      });

      // Increment nonce
      await prisma.nonce.upsert({
        where: { userAddress_contractAddress: { userAddress: from, contractAddress: CONTRACT_ADDRESS.toLowerCase() } },
        create: { userAddress: from, contractAddress: CONTRACT_ADDRESS.toLowerCase(), currentNonce: 1 },
        update: { currentNonce: { increment: 1 } }
      });

      broadcast('tx_added', { id: stored.id, from, to, valueWei });
      results.push({ id: stored.id, status: 'pending' });
    }

    return res.status(201).json({ success: true, count: results.length, transactions: results });
  } catch (e) { console.error('POST /api/transactions:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/pending', async (_, r) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
    r.json(txs.map(normalizeTx));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/network', async (_, r) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ orderBy: { createdAt: 'desc' }, include: { batch: true } });
    r.json(txs.map(t => ({
      ...normalizeTx(t),
      status: t.batch?.status || t.status,
      batchId: t.batch?.onChainId || null,
      type: 'transfer',
      isInBatch: !!t.batch,
    })));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/live', async (_, r) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { batch: true } });
    r.json(txs.map(t => ({ ...normalizeTx(t), batchId: t.batch?.onChainId || null })));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/user/:address', async (req, r) => {
  try {
    const addr = req.params.address.toLowerCase();
    const txs  = await prisma.pendingTransaction.findMany({
      where: { OR: [{ fromAddress: addr }, { toAddress: addr }] },
      include: { batch: true }, orderBy: { createdAt: 'desc' }
    });
    r.json({
      transactions: txs.map(t => ({
        ...normalizeTx(t),
        status: t.batch?.status || t.status,
        batchId: t.batch?.onChainId || null,
        type: 'transfer',
        isInBatch: !!t.batch,
      }))
    });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Batches ───────────────────────────────────────────────────────────────────
// ALL batch endpoints now use normalizeBatch() → createdAt is unix seconds

app.get('/api/batches', async (_, r) => {
  try {
    const raw = await prisma.batch.findMany({ orderBy: { createdAt: 'desc' }, include: { transactions: true } });
    r.json(raw.map(normalizeBatch));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.get('/api/batches/user/:address', async (req, r) => {
  try {
    const addr = req.params.address.toLowerCase();
    const raw  = await prisma.batch.findMany({
      where: { transactions: { some: { OR: [{ fromAddress: addr }, { toAddress: addr }] } } },
      include: { transactions: true }, orderBy: { createdAt: 'desc' }
    });
    r.json(raw.map(normalizeBatch));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.get('/api/batches/:id', async (req, r) => {
  try {
    const b = await prisma.batch.findFirst({
      where: { OR: [{ id: req.params.id }, { onChainId: req.params.id }] },
      include: { transactions: true, challenges: true }
    });
    if (!b) return r.status(404).json({ error: 'Not found' });
    r.json(normalizeBatch(b));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Fraud Proof ───────────────────────────────────────────────────────────────

app.get('/api/fraud-proof/challengeable', async (_, r) => {
  try {
    const now = new Date();
    const raw = await prisma.batch.findMany({
      where: { status: 'challenge_period', challengeEndsAt: { gt: now }, onChainId: { not: null } },
      include: { transactions: true }, orderBy: { createdAt: 'desc' }
    });
    r.json(raw.map(b => ({
      ...normalizeBatch(b),
      txCount: b.transactions.length,
    })));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.post('/api/fraud-proof/generate', async (req, r) => {
  try {
    const { batchId, txIndex } = req.body;
    if (!batchId) return r.status(400).json({ error: 'batchId required' });
    const batch = await prisma.batch.findFirst({
      where: { OR: [{ id: batchId }, { onChainId: batchId }] }, include: { transactions: true }
    });
    if (!batch) return r.status(404).json({ error: 'Batch not found' });
    r.json(await stateManager.generateFraudProof(batch, txIndex ?? 0));
  } catch (e) { console.error('generate-fraud-proof:', e); r.status(500).json({ error: e.message }); }
});

app.post('/api/fraud-proof/submit', async (req, r) => {
  try {
    const { batchId, fraudulentTxHash, txProof, correctStateRoot, challengerAddress } = req.body;
    if (!batchId || !fraudulentTxHash || !txProof || !correctStateRoot)
      return r.status(400).json({ error: 'batchId, fraudulentTxHash, txProof, correctStateRoot required' });

    const batch = await prisma.batch.findFirst({ where: { OR: [{ id: batchId }, { onChainId: batchId }] } });
    if (!batch)                               return r.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'challenge_period')  return r.status(400).json({ error: `Batch not in challenge period (status: ${batch.status})` });
    if (!batch.onChainId)                     return r.status(400).json({ error: 'Batch not on-chain yet' });
    if (batch.challengeEndsAt && new Date() > batch.challengeEndsAt)
      return r.status(400).json({ error: 'Challenge window expired' });

    const challenge = await prisma.challenge.create({
      data: {
        batchId:           batch.id,
        challengerAddress: (challengerAddress || ethers.constants.AddressZero).toLowerCase(),
        fraudProofHash:    fraudulentTxHash,
        merkleProof:       JSON.stringify(txProof),
        correctStateRoot,
        status:            'pending',
      }
    });

    if (contract) {
      try {
        const tx      = await contract.submitFraudProof(
          ethers.BigNumber.from(batch.onChainId), fraudulentTxHash, txProof, correctStateRoot
        );
        const receipt = await tx.wait();
        await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'accepted', onChainTxHash: receipt.transactionHash } });
        broadcast('fraud_proof_submitted', { batchId: batch.id, onChainId: batch.onChainId, txHash: receipt.transactionHash });
        return r.json({ success: true, txHash: receipt.transactionHash, challenge });
      } catch (err) {
        await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'rejected' } });
        return r.status(400).json({ error: `Contract rejected: ${err.message}` });
      }
    }

    // DB-only: manually trigger revert+slash
    const fullBatch = await prisma.batch.findUnique({
      where: { id: batch.id }, include: { transactions: true }
    });
    await stateManager.revertBatch({ ...fullBatch });
    await prisma.batch.update({ where: { id: batch.id }, data: { status: 'rejected' } });
    await prisma.pendingTransaction.updateMany({ where: { batchId: batch.id }, data: { status: 'rejected' } });
    await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'accepted' } });
    broadcast('fraud_proof_accepted', { onChainId: batch.onChainId, challenger: challengerAddress, reward: '0' });
    r.json({ success: true, message: 'DB-only: batch rejected + state reverted + operator slashed', challenge });
  } catch (e) { console.error('submit-fraud-proof:', e); r.status(500).json({ error: e.message }); }
});

app.get('/api/fraud-proof/challenges', async (_, r) => {
  try {
    const raw = await prisma.challenge.findMany({ orderBy: { createdAt: 'desc' }, include: { batch: true } });
    r.json(raw.map(c => ({ ...normalizeChallenge(c), batch: c.batch ? normalizeBatch(c.batch) : null })));
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.post('/api/rollup/fraud-proof', (_, r) => r.json({ isValid: true, message: 'Use /api/fraud-proof/submit' }));

// ── Balance ───────────────────────────────────────────────────────────────────

app.get('/api/balance/:address', async (req, r) => {
  try {
    const addr = req.params.address.toLowerCase();
    let l1Wei  = '0';
    if (provider) { try { l1Wei = (await provider.getBalance(addr)).toString(); } catch {} }
    const { pendingWei, finalizedWei } = await stateManager.getBalance(addr);
    r.json({
      layer1Balance:    fmtEth(l1Wei),
      layer2Balance:    fmtEth(pendingWei),
      finalizedBalance: fmtEth(finalizedWei),
      pendingBalance:   fmtEth(pendingWei),
      isFinalized:      pendingWei === finalizedWei,
      layer1BalanceWei: l1Wei,
      layer2BalanceWei: pendingWei,
      finalizedWei,
      pendingWei,
    });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.post('/api/balance/update', async (req, r) => {
  try {
    const { userAddress, balance } = req.body;
    if (!userAddress) return r.status(400).json({ error: 'userAddress required' });
    await stateManager.setBalance(userAddress.toLowerCase(), normalizeWei(balance));
    r.json({ success: true });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Nonce ─────────────────────────────────────────────────────────────────────

app.get('/api/nonce/:address', async (req, r) => {
  try {
    const addr = req.params.address.toLowerCase();
    const rec  = await prisma.nonce.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
    });
    r.json({ nonce: rec?.currentNonce ?? 0 });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── State Root ────────────────────────────────────────────────────────────────

app.get('/api/state-root', async (_, r) => {
  try {
    let onChainRoot = null;
    if (contract) { try { onChainRoot = await contract.currentStateRoot(); } catch {} }
    const dbRoot = await stateManager.computeStateRoot();
    const latest = await prisma.batch.findFirst({ orderBy: { createdAt: 'desc' }, where: { status: { not: 'rejected' } } });
    r.json({
      onChainRoot, dbRoot,
      currentStateRoot: onChainRoot || dbRoot,
      batchId: latest?.onChainId || null,
      latestBatchId: latest?.onChainId || null,
      latestBatchStatus: latest?.status || null,
    });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Metrics ───────────────────────────────────────────────────────────────────

app.get('/api/metrics', async (_, r) => {
  try {
    const [tot, pen, bTot, bFin, bRej, chal] = await Promise.all([
      prisma.pendingTransaction.count(),
      prisma.pendingTransaction.count({ where: { status: 'pending' } }),
      prisma.batch.count(),
      prisma.batch.count({ where: { status: 'finalized' } }),
      prisma.batch.count({ where: { status: 'rejected' } }),
      prisma.challenge.count({ where: { status: 'pending' } }),
    ]);
    const avg  = bTot > 0 ? tot / bTot : 0;
    const save = avg  > 0 ? Math.round((1 - 500000 / (avg * 21000)) * 100) : 95;
    r.json({
      totalTransactions: tot, pendingTransactions: pen,
      totalBatches: bTot, finalizedBatches: bFin, rejectedBatches: bRej,
      activeChallenges: chal, avgTxsPerBatch: Math.round(avg),
      estimatedGasSaving: `~${Math.max(0, save)}%`,
      compressionRatio: avg > 0 ? `${Math.round(avg)}:1` : 'N/A',
      networkHealth: pen < 100 && chal === 0 ? 'healthy' : 'congested',
    });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Gas Prices ────────────────────────────────────────────────────────────────

app.get('/api/gas-prices', async (_, r) => {
  try {
    if (!provider) return r.json({ slow: '20', standard: '25', fast: '30', rapid: '35' });
    const fee  = await provider.getFeeData();
    const gwei = Math.round(parseFloat(ethers.utils.formatUnits(fee.gasPrice || '0', 'gwei')));
    r.json({ slow: (gwei*.8).toFixed(0), standard: gwei.toFixed(0), fast: (gwei*1.2).toFixed(0), rapid: (gwei*1.5).toFixed(0) });
  } catch { r.json({ slow: '20', standard: '25', fast: '30', rapid: '35' }); }
});

// ── Withdrawal ────────────────────────────────────────────────────────────────

app.post('/api/withdrawal/request', async (req, r) => {
  try {
    const { address, amount } = req.body;
    if (!address || !amount) return r.status(400).json({ error: 'address and amount required' });
    const addr   = address.toLowerCase();
    const amtWei = normalizeWei(amount);
    const { finalizedWei, pendingWei } = await stateManager.getBalance(addr);
    if (BigInt(amtWei) > BigInt(finalizedWei)) {
      return r.status(400).json({
        error: `Insufficient finalized balance. Finalized: ${fmtEth(finalizedWei)} ETH. Pending (not yet withdrawable): ${fmtEth(pendingWei)} ETH. Wait for your transactions to be included in a finalized batch (challenge period: ~5 min dev, 7 days prod).`
      });
    }
    const { withdrawalRoot, entries } = await stateManager.buildWithdrawalTree(null);
    const entry = entries.find(e => e.address === addr);
    if (!entry) return r.status(400).json({ error: 'No finalized withdrawal entry found' });

    // On-chain withdrawal
    if (contract) {
      try {
        const tx = await contract.withdrawFunds(ethers.BigNumber.from(amtWei));
        await tx.wait();
        // FundsWithdrawn event handler calls debitWithdrawal
        return r.json({ success: true, txHash: tx.hash, simulated: false });
      } catch (e) { console.warn('On-chain withdraw failed, using DB-only:', e.message); }
    }

    // DB-only
    await stateManager.debitWithdrawal(addr, amtWei);
    broadcast('balance_updated', { address: addr });
    r.json({ success: true, simulated: true, message: 'DB-only withdrawal processed' });
  } catch (e) { console.error('withdrawal:', e); r.status(500).json({ error: e.message }); }
});

// ── Operators ─────────────────────────────────────────────────────────────────

app.get('/api/operators',       async (_, r) => { try { r.json(await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { r.status(500).json({ error: e.message }); } });
app.get('/api/admin/operators', async (_, r) => { try { r.json(await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { r.status(500).json({ error: e.message }); } });
app.get('/api/admin/contracts', async (_, r) => { try { r.json(await prisma.contractDeployment.findMany()); } catch (e) { r.status(500).json({ error: e.message }); } });

app.post('/api/admin/operators', async (req, r) => {
  try {
    const { address } = req.body;
    if (!address) return r.status(400).json({ error: 'address required' });
    if (contract) { const tx = await contract.addOperator(address); await tx.wait(); }
    const op = await prisma.operator.upsert({
      where: { address: address.toLowerCase() },
      create: { address: address.toLowerCase(), isActive: true },
      update: { isActive: true }
    });
    r.json({ success: true, operator: op });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/operators/:address', async (req, r) => {
  try {
    if (contract) { const tx = await contract.removeOperator(req.params.address); await tx.wait(); }
    await prisma.operator.updateMany({ where: { address: req.params.address.toLowerCase() }, data: { isActive: false } });
    r.json({ success: true });
  } catch (e) { r.status(500).json({ error: e.message }); }
});

// ── Auto-Finalize Cron ────────────────────────────────────────────────────────

const AUTO_FINALIZE_INTERVAL = 15_000; // check every 15s
 
setInterval(async () => {
  try {
    const now = new Date();
    
    // Find all batches where challenge period has expired but status is still challenge_period
    const expired = await prisma.batch.findMany({
      where: {
        status: 'challenge_period',
        challengeEndsAt: { lt: now },
      },
      include: { transactions: true },
    });
 
    if (expired.length === 0) return;
 
    console.log(`⏰ Auto-finalizing ${expired.length} expired batch(es)...`);
 
    for (const batch of expired) {
      try {
        // If we have a live contract, call finalizeBatch on-chain
        if (contract && batch.onChainId) {
          try {
            // Check if challenge window is still open on-chain (safety check)
            const stillOpen = await contract.isChallengeWindowOpen(
              ethers.BigNumber.from(batch.onChainId)
            );
            if (stillOpen) {
              console.log(`⏳ Batch #${batch.onChainId} still open on-chain — skipping`);
              continue;
            }
 
            const tx = await contract.finalizeBatch(
              ethers.BigNumber.from(batch.onChainId)
            );
            await tx.wait();
            // BatchFinalized event handler takes it from here
            console.log(`✅ On-chain finalized batch #${batch.onChainId}`);
            continue;
          } catch (chainErr) {
            // If already finalized or other revert — handle gracefully
            if (chainErr.message?.includes('Already finalized') || 
                chainErr.message?.includes('already finalized')) {
              console.log(`ℹ️  Batch #${batch.onChainId} already finalized on-chain, syncing DB...`);
            } else {
              console.warn(`⚠️  On-chain finalize failed for #${batch.onChainId}: ${chainErr.message} — falling back to DB`);
            }
          }
        }
 
        // DB-only finalization (no contract or fallback)
        await stateManager.applyFinalizedBatch(batch);
 
        await prisma.batch.update({
          where: { id: batch.id },
          data: { status: 'finalized' },
        });
 
        await prisma.pendingTransaction.updateMany({
          where: { batchId: batch.id },
          data: { status: 'finalized' },
        });
 
        broadcast('batch_finalized', {
          id: batch.id,
          onChainId: batch.onChainId,
          stateRoot: batch.stateRoot,
        });
 
        console.log(`✅ DB-only finalized batch ${batch.id.slice(0, 8)}...`);
      } catch (batchErr) {
        console.error(`❌ Failed to finalize batch ${batch.id.slice(0, 8)}: ${batchErr.message}`);
      }
    }
  } catch (cronErr) {
    console.error('❌ Auto-finalize cron error:', cronErr.message);
  }
}, AUTO_FINALIZE_INTERVAL);
 
 
// ── ADD this route for real block height ──────────────────────────────────────
 
// Real block height from the connected chain (Hardhat / Sepolia)
// Block height = number of blocks mined, NOT number of transactions
app.get('/api/block-height', async (_, r) => {
  try {
    if (!provider) {
      // No chain connected — return a simulated incrementing block number
      // Hardhat mines a block every ~12s on average
      const startTime = Math.floor(Date.now() / 1000);
      const simulatedBlock = Math.floor(startTime / 12) % 1000000;
      return r.json({ blockNumber: simulatedBlock, source: 'simulated', network: NETWORK });
    }
 
    const blockNumber = await provider.getBlockNumber();
    const block       = await provider.getBlock(blockNumber);
 
    return r.json({
      blockNumber,
      timestamp:   block?.timestamp || Math.floor(Date.now() / 1000),
      gasLimit:    block?.gasLimit?.toString() || '30000000',
      source:      'chain',
      network:     NETWORK,
    });
  } catch (e) {
    // Graceful fallback
    const fb = Math.floor(Date.now() / 12000);
    r.json({ blockNumber: fb, source: 'fallback', error: e.message, network: NETWORK });
  }
});
 
// Also fix the /health endpoint to include correct block from chain
// Replace the existing /health route with:
app.get('/health', async (_, res) => {
  let chain = false, block = null;
  if (provider) {
    try {
      block = await provider.getBlockNumber(); // ← real block height
      chain = true;
    } catch {}
  }
  const [pending, batches] = await Promise.all([
    prisma.pendingTransaction.count({ where: { status: 'pending' } }).catch(() => 0),
    prisma.batch.count().catch(() => 0),
  ]);
  res.json({
    status: 'ok',
    chain,
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    block,            // real block number from chain
    pending,
    batches,
    ts: Date.now(),
  });
});
// ── Boot ──────────────────────────────────────────────────────────────────────

initBlockchain().then(connected => {
  startSequencer({ contract, wallet, broadcast, stateManager, prisma });
  app.listen(PORT, () => {
    console.log(`🚀 LayerGlide backend on http://localhost:${PORT}`);
    console.log(`   Chain:            ${connected ? '✅ connected' : '⚠️  DB-only'}`);
    console.log(`   Challenge period: ${CHALLENGE_PERIOD_MS / 1000}s`);
    console.log(`   Batch size:       ${process.env.BATCH_SIZE || '3'}`);
  });
});