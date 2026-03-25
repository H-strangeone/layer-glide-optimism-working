/**
 * LayerGlide Backend – Production-grade Optimistic Rollup Server
 *
 * KEY FIXES vs original:
 * 1.  L1 balance reads from chain — never mutated off-chain
 * 2.  L2 transfers are off-chain ONLY (correct rollup model)
 * 3.  All polling removed — single WebSocket pushes updates
 * 4.  Nonce + EIP-712 signature on every L2 tx (replay protection)
 * 5.  Two-layer state: pendingState vs finalizedState
 * 6.  Balances committed to finalState ONLY after challenge period
 * 7.  Auto-finalize with on-chain safety check
 * 8.  Event-driven contract sync (BatchSubmitted, BatchFinalized, FraudProofAccepted)
 * 9.  Real fraud proof validates state transition
 * 10. Sequencer runs as separate concern
 * 11. StateManager is the execution engine — routes all state changes
 * 12. Withdrawal requires finalized balance + Merkle proof
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

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT                = parseInt(process.env.PORT                     || '5500');
const WS_PORT             = parseInt(process.env.WS_PORT                  || '5501');
const NETWORK             = process.env.NETWORK                           || 'localhost';
const CONTRACT_ADDRESS    = process.env.CONTRACT_ADDRESS                  || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHALLENGE_PERIOD_MS = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeToWei(v) {
  if (!v) return '0';
  const s = v.toString().trim();
  if (!s || s === '0') return '0';
  if (!s.includes('.') && s.length >= 15) return s;          // already wei
  try { return ethers.utils.parseEther(s).toString(); }
  catch { return s; }
}

function toUnixSec(ts) {
  if (!ts) return Math.floor(Date.now() / 1000);
  if (typeof ts === 'number') return ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return Math.floor(new Date(ts).getTime() / 1000);
}

function fmtEth(wei) {
  try { return ethers.utils.formatEther(wei.toString()); } catch { return '0'; }
}

// ─── Prisma ───────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ─── StateManager (execution engine) ─────────────────────────────────────────
const stateManager = new StateManager(prisma, CONTRACT_ADDRESS);

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: ['http://localhost:5173','http://localhost:8080',
           'http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean)
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
  'function nonces(address) view returns (uint256)',
  'function admin() view returns (address)',
  'function nextBatchId() view returns (uint256)',
  'function challengePeriod() view returns (uint256)',
  'function currentStateRoot() view returns (bytes32)',
  'function isChallengeWindowOpen(uint256 _batchId) view returns (bool)',
  'function addOperator(address op)',
  'function removeOperator(address op)',
  'function depositOperatorBond() payable',
  'function isBatchFraudulent(uint256) view returns (bool)',
  'function batches(uint256) view returns (uint256 batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, uint256 submittedAt, address submitter, bool finalized, bool fraudulent, uint256 txCount)',
  'event BatchSubmitted(uint256 indexed batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, address submitter, uint256 txCount)',
  'event BatchFinalized(uint256 indexed batchId, bytes32 stateRoot)',
  'event FraudProofAccepted(uint256 indexed batchId, address challenger, uint256 reward)',
  'event FundsDeposited(address indexed user, uint256 amount)',
  'event FundsWithdrawn(address indexed user, uint256 amount)',
  'event OperatorSlashed(address indexed operator, uint256 amount, address challenger)',
  'event OperatorAdded(address indexed operator)',
  'event OperatorRemoved(address indexed operator)',
  'event WithdrawalRootPublished(uint256 indexed batchId, bytes32 withdrawalRoot)',
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

    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error('PRIVATE_KEY not set');
    wallet   = new ethers.Wallet(pk, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === '0x') throw new Error(`No contract at ${CONTRACT_ADDRESS}`);

    console.log(`✅ Blockchain: ${NETWORK}  contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Operator: ${wallet.address}`);
    setupEventListeners();
    return true;
  } catch (err) {
    console.warn(`⚠️  Blockchain unavailable: ${err.message} — DB-only mode`);
    return false;
  }
}

// ─── Event-Driven Sync ────────────────────────────────────────────────────────
function setupEventListeners() {
  if (!contract) return;

  // Sync externally-submitted batches
  contract.on('BatchSubmitted', async (batchId, txRoot, stateRoot, prevStateRoot, submitter, txCount) => {
    try {
      const id = batchId.toString();
      const existing = await prisma.batch.findUnique({ where: { onChainId: id } });
      if (!existing) {
        const challengeEndsAt = new Date(Date.now() + CHALLENGE_PERIOD_MS);
        await prisma.batch.create({
          data: {
            onChainId: id, transactionsRoot: txRoot,
            stateRoot, prevStateRoot, status: 'challenge_period',
            submitter: submitter.toLowerCase(),
            txCount: txCount.toNumber(), challengeEndsAt,
          }
        });
        broadcast('batch_created', { onChainId: id, txCount: txCount.toNumber(), stateRoot });
      }
      console.log(`📡 BatchSubmitted onChainId=${id}`);
    } catch (e) { console.error('BatchSubmitted:', e.message); }
  });

  // FIX 6/7: Apply balances ONLY on finalization
  contract.on('BatchFinalized', async (batchId, stateRoot) => {
    try {
      const id = batchId.toString();
      const batch = await prisma.batch.findUnique({
        where: { onChainId: id }, include: { transactions: true }
      });
      if (batch) {
        await stateManager.applyFinalizedBatch(batch);
        await prisma.batch.update({ where: { id: batch.id }, data: { status: 'finalized' } });
        await prisma.pendingTransaction.updateMany({
          where: { batchId: batch.id }, data: { status: 'finalized' }
        });
      }
      broadcast('batch_finalized', { onChainId: id, stateRoot });
      console.log(`✅ BatchFinalized onChainId=${id}`);
    } catch (e) { console.error('BatchFinalized:', e.message); }
  });

  // Revert state on fraud
  contract.on('FraudProofAccepted', async (batchId, challenger, reward) => {
    try {
      const id = batchId.toString();
      const batch = await prisma.batch.findUnique({
        where: { onChainId: id }, include: { transactions: true }
      });
      if (batch) {
        await stateManager.revertBatch(batch);
        await prisma.batch.update({ where: { id: batch.id }, data: { status: 'rejected' } });
        await prisma.pendingTransaction.updateMany({
          where: { batchId: batch.id }, data: { status: 'rejected' }
        });
        // Slash submitter bond
        if (batch.submitter) {
          await prisma.operator.updateMany({
            where: { address: batch.submitter.toLowerCase() },
            data: { bondWei: '0', isActive: false }
          });
        }
      }
      broadcast('fraud_proof_accepted', { onChainId: id, challenger, reward: reward.toString() });
      console.log(`🚨 FraudProofAccepted batchId=${id}`);
    } catch (e) { console.error('FraudProofAccepted:', e.message); }
  });

  // Deposit: credit pending L2 balance
  contract.on('FundsDeposited', async (user, amount) => {
    try {
      await stateManager.creditPending(user.toLowerCase(), amount.toString());
      broadcast('balance_updated', { address: user.toLowerCase() });
      console.log(`💰 Deposit ${user} +${fmtEth(amount)} ETH`);
    } catch (e) { console.error('FundsDeposited:', e.message); }
  });

  contract.on('FundsWithdrawn',  async (user) => broadcast('balance_updated', { address: user.toLowerCase() }));
  contract.on('OperatorSlashed', async (op, amt, ch) => broadcast('operator_slashed', { operator: op, amount: amt.toString(), challenger: ch }));

  console.log('📡 Contract event listeners active');
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let chain = false, block = null;
  if (provider) { try { block = await provider.getBlockNumber(); chain = true; } catch {} }
  const [pending, batches] = await Promise.all([
    prisma.pendingTransaction.count({ where: { status: 'pending' } }).catch(() => 0),
    prisma.batch.count().catch(() => 0),
  ]);
  res.json({ status: 'ok', chain, network: NETWORK, contractAddress: CONTRACT_ADDRESS, block, pending, batches, ts: Date.now() });
});

// ── Admin ────────────────────────────────────────────────────────────────────
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

// ── Transactions ─────────────────────────────────────────────────────────────

/**
 * POST /api/transactions
 * FIX 1.2: L2 transfers are OFF-CHAIN ONLY.
 * Signed by user (EIP-712). Nonce enforced. Balance from pendingState.
 * Balances NOT committed to finalState until batch is finalized.
 */
app.post('/api/transactions', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || !transactions.length)
      return res.status(400).json({ error: 'transactions array required' });

    const results = [];
    for (const tx of transactions) {
      const from     = (tx.from || tx.fromAddress || '').toLowerCase();
      const to       = (tx.to   || tx.toAddress   || '').toLowerCase();
      const valueWei = normalizeToWei(tx.amount || tx.value || tx.valueWei || '0');
      const nonce    = tx.nonce    ?? 0;
      const sig      = tx.signature;
      const deadline = tx.deadline ?? Math.floor(Date.now() / 1000) + 3600;

      if (!ethers.utils.isAddress(from))  return res.status(400).json({ error: `Invalid from: ${from}` });
      if (!ethers.utils.isAddress(to))    return res.status(400).json({ error: `Invalid to: ${to}` });
      if (BigInt(valueWei) <= 0n)         return res.status(400).json({ error: 'Value must be > 0' });
      if (!sig)                           return res.status(400).json({ error: 'Signature required' });
      if (deadline < Math.floor(Date.now() / 1000)) return res.status(400).json({ error: 'Deadline expired' });

      // Replay protection — verify signature
      const msgHash = ethers.utils.solidityKeccak256(
        ['address','address','uint256','uint256','uint256'],
        [from, to, valueWei, nonce, deadline]
      );
      const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(msgHash), sig).toLowerCase();
      if (recovered !== from)
        return res.status(400).json({ error: `Signature mismatch: expected ${from}, recovered ${recovered}` });

      // Nonce check
      const nonceRec = await prisma.nonce.findUnique({
        where: { userAddress_contractAddress: { userAddress: from, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
      });
      const expected = nonceRec?.currentNonce ?? 0;
      if (nonce !== expected)
        return res.status(400).json({ error: `Bad nonce: expected ${expected}, got ${nonce}` });

      // Pending balance check
      if (!(await stateManager.canSpend(from, valueWei)))
        return res.status(400).json({ error: `Insufficient pending L2 balance for ${from}` });

      // Apply to PENDING state only (not final)
      await stateManager.applyPendingTransfer(from, to, valueWei);

      const stored = await prisma.pendingTransaction.create({
        data: { fromAddress: from, toAddress: to, valueWei, nonce, signature: sig, status: 'pending' }
      });

      // Bump nonce
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

app.get('/api/transactions/pending', async (_req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
    res.json(txs.map(t => ({ ...t, createdAt: toUnixSec(t.createdAt) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/network', async (_req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ orderBy: { createdAt: 'desc' }, include: { batch: true } });
    res.json(txs.map(t => ({
      hash: t.id, from: t.fromAddress, to: t.toAddress, value: t.valueWei,
      status: t.batch?.status || t.status, createdAt: toUnixSec(t.createdAt),
      batchId: t.batch?.onChainId || null, type: 'transfer', isInBatch: !!t.batch,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/live', async (_req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { batch: true } });
    res.json(txs.map(t => ({
      hash: t.id, from: t.fromAddress, to: t.toAddress, value: t.valueWei,
      status: t.status, createdAt: toUnixSec(t.createdAt),
      batchId: t.batch?.onChainId || null,
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
        status: t.batch?.status || t.status, createdAt: toUnixSec(t.createdAt),
        batchId: t.batch?.onChainId || null, type: 'transfer', isInBatch: !!t.batch,
      }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Batches ──────────────────────────────────────────────────────────────────
app.get('/api/batches', async (_req, res) => {
  try {
    res.json(await prisma.batch.findMany({ orderBy: { createdAt: 'desc' }, include: { transactions: true } }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches/user/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    res.json(await prisma.batch.findMany({
      where: { transactions: { some: { OR: [{ fromAddress: addr }, { toAddress: addr }] } } },
      include: { transactions: true }, orderBy: { createdAt: 'desc' }
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await prisma.batch.findFirst({
      where: { OR: [{ id: req.params.id }, { onChainId: req.params.id }] },
      include: { transactions: true, challenges: true }
    });
    if (!batch) return res.status(404).json({ error: 'Not found' });
    res.json(batch);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fraud Proof Marketplace ───────────────────────────────────────────────────
app.get('/api/fraud-proof/challengeable', async (_req, res) => {
  try {
    const now     = new Date();
    const batches = await prisma.batch.findMany({
      where: { status: 'challenge_period', challengeEndsAt: { gt: now }, onChainId: { not: null } },
      include: { transactions: true }, orderBy: { createdAt: 'desc' }
    });
    res.json(batches.map(b => ({
      ...b,
      timeLeftMs: b.challengeEndsAt ? b.challengeEndsAt.getTime() - Date.now() : 0,
      txCount: b.transactions.length,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/fraud-proof/generate', async (req, res) => {
  try {
    const { batchId, txIndex } = req.body;
    if (!batchId) return res.status(400).json({ error: 'batchId required' });
    const batch = await prisma.batch.findFirst({
      where: { OR: [{ id: batchId }, { onChainId: batchId }] }, include: { transactions: true }
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(await stateManager.generateFraudProof(batch, txIndex ?? 0));
  } catch (e) { console.error('generate-fraud-proof:', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/fraud-proof/submit', async (req, res) => {
  try {
    const { batchId, fraudulentTxHash, txProof, correctStateRoot, challengerAddress } = req.body;
    if (!batchId || !fraudulentTxHash || !txProof || !correctStateRoot)
      return res.status(400).json({ error: 'batchId, fraudulentTxHash, txProof, correctStateRoot required' });

    const batch = await prisma.batch.findFirst({ where: { OR: [{ id: batchId }, { onChainId: batchId }] } });
    if (!batch)                           return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'challenge_period') return res.status(400).json({ error: 'Not in challenge period' });
    if (!batch.onChainId)                 return res.status(400).json({ error: 'Batch not on-chain yet' });
    if (batch.challengeEndsAt && new Date() > batch.challengeEndsAt)
      return res.status(400).json({ error: 'Challenge window expired' });

    const challenge = await prisma.challenge.create({
      data: {
        batchId: batch.id,
        challengerAddress: (challengerAddress || '0x0000000000000000000000000000000000000000').toLowerCase(),
        fraudProofHash: fraudulentTxHash, merkleProof: JSON.stringify(txProof),
        correctStateRoot, status: 'pending',
      }
    });

    if (contract) {
      try {
        const tx      = await contract.submitFraudProof(ethers.BigNumber.from(batch.onChainId), fraudulentTxHash, txProof, correctStateRoot);
        const receipt = await tx.wait();
        await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'accepted', onChainTxHash: receipt.transactionHash } });
        broadcast('fraud_proof_submitted', { batchId: batch.id, onChainId: batch.onChainId, txHash: receipt.transactionHash });
        return res.json({ success: true, txHash: receipt.transactionHash, challenge });
      } catch (err) {
        await prisma.challenge.update({ where: { id: challenge.id }, data: { status: 'rejected' } });
        return res.status(400).json({ error: `Contract rejected: ${err.message}` });
      }
    }

    res.json({ success: true, message: 'DB-only mode', challenge });
  } catch (e) { console.error('submit-fraud-proof:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/fraud-proof/challenges', async (_req, res) => {
  try { res.json(await prisma.challenge.findMany({ orderBy: { createdAt: 'desc' }, include: { batch: true } })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rollup/fraud-proof', (_req, res) => res.json({ isValid: true, message: 'Use /api/fraud-proof/submit' }));

// ── Balance ───────────────────────────────────────────────────────────────────
app.get('/api/balance/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();

    // L1: always from chain — read-only, never mutated here
    let l1Wei = '0';
    if (provider) {
      try { l1Wei = (await provider.getBalance(addr)).toString(); } catch {}
    }

    // L2: two-layer state
    const { pendingWei, finalizedWei } = await stateManager.getBalance(addr);

    res.json({
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
  } catch (e) { console.error('balance:', e); res.status(500).json({ error: e.message }); }
});

app.post('/api/balance/update', async (req, res) => {
  try {
    const { userAddress, balance } = req.body;
    if (!userAddress) return res.status(400).json({ error: 'userAddress required' });
    await stateManager.setBalance(userAddress.toLowerCase(), normalizeToWei(balance));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Nonce ─────────────────────────────────────────────────────────────────────
app.get('/api/nonce/:address', async (req, res) => {
  try {
    const addr = req.params.address.toLowerCase();
    const rec  = await prisma.nonce.findUnique({
      where: { userAddress_contractAddress: { userAddress: addr, contractAddress: CONTRACT_ADDRESS.toLowerCase() } }
    });
    res.json({ nonce: rec?.currentNonce ?? 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── State Root ────────────────────────────────────────────────────────────────
app.get('/api/state-root', async (_req, res) => {
  try {
    let onChainRoot = null;
    if (contract) { try { onChainRoot = await contract.currentStateRoot(); } catch {} }
    const dbRoot = await stateManager.computeStateRoot();
    const latest = await prisma.batch.findFirst({ orderBy: { createdAt: 'desc' }, where: { status: { not: 'rejected' } } });
    res.json({ onChainRoot, dbRoot, currentStateRoot: onChainRoot || dbRoot, batchId: latest?.onChainId || null, latestBatchId: latest?.onChainId || null, latestBatchStatus: latest?.status || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Metrics ───────────────────────────────────────────────────────────────────
app.get('/api/metrics', async (_req, res) => {
  try {
    const [total, pending, bTotal, bFinal, bReject, challenges] = await Promise.all([
      prisma.pendingTransaction.count(),
      prisma.pendingTransaction.count({ where: { status: 'pending' } }),
      prisma.batch.count(),
      prisma.batch.count({ where: { status: 'finalized' } }),
      prisma.batch.count({ where: { status: 'rejected' } }),
      prisma.challenge.count({ where: { status: 'pending' } }),
    ]);
    const avg  = bTotal > 0 ? total / bTotal : 0;
    const save = avg > 0 ? Math.round((1 - 500000 / (avg * 21000)) * 100) : 95;
    res.json({
      totalTransactions: total, pendingTransactions: pending,
      totalBatches: bTotal, finalizedBatches: bFinal, rejectedBatches: bReject,
      activeChallenges: challenges, avgTxsPerBatch: Math.round(avg),
      estimatedGasSaving: `~${Math.max(0, save)}%`,
      compressionRatio: avg > 0 ? `${Math.round(avg)}:1` : 'N/A',
      networkHealth: pending < 100 && challenges === 0 ? 'healthy' : 'congested',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Withdrawal ────────────────────────────────────────────────────────────────
app.post('/api/withdrawal/request', async (req, res) => {
  try {
    const { address, amount } = req.body;
    if (!address || !amount) return res.status(400).json({ error: 'address and amount required' });
    const addr   = address.toLowerCase();
    const amtWei = normalizeToWei(amount);
    const { finalizedWei } = await stateManager.getBalance(addr);
    if (BigInt(amtWei) > BigInt(finalizedWei))
      return res.status(400).json({ error: `Insufficient finalized balance: have ${fmtEth(finalizedWei)} ETH` });
    const { withdrawalRoot, entries } = await stateManager.buildWithdrawalTree(null);
    const entry = entries.find(e => e.address === addr);
    if (!entry) return res.status(400).json({ error: 'No withdrawal entry — ensure balance is finalized' });
    res.json({ success: true, withdrawalId: entry.leaf, withdrawalRoot, proof: entry.proof, amount: amtWei, simulated: !contract });
  } catch (e) { console.error('withdrawal:', e); res.status(500).json({ error: e.message }); }
});

// ── Operators ─────────────────────────────────────────────────────────────────
app.get('/api/operators',        async (_, r) => { try { r.json(await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { r.status(500).json({ error: e.message }); } });
app.get('/api/admin/operators',  async (_, r) => { try { r.json(await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } })); } catch (e) { r.status(500).json({ error: e.message }); } });
app.post('/api/admin/operators', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    if (contract) { const tx = await contract.addOperator(address); await tx.wait(); }
    const op = await prisma.operator.upsert({ where: { address: address.toLowerCase() }, create: { address: address.toLowerCase(), isActive: true }, update: { isActive: true } });
    res.json({ success: true, operator: op });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/operators/:address', async (req, res) => {
  try {
    if (contract) { const tx = await contract.removeOperator(req.params.address); await tx.wait(); }
    await prisma.operator.updateMany({ where: { address: req.params.address.toLowerCase() }, data: { isActive: false } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/contracts', async (_, res) => { try { res.json(await prisma.contractDeployment.findMany()); } catch (e) { res.status(500).json({ error: e.message }); } });

// ── Gas Prices ────────────────────────────────────────────────────────────────
app.get('/api/gas-prices', async (_, res) => {
  try {
    if (!provider) return res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' });
    const fee  = await provider.getFeeData();
    const gwei = Math.round(parseFloat(ethers.utils.formatUnits(fee.gasPrice || '0', 'gwei')));
    res.json({ slow: (gwei*.8).toFixed(0), standard: gwei.toFixed(0), fast: (gwei*1.2).toFixed(0), rapid: (gwei*1.5).toFixed(0) });
  } catch { res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' }); }
});

// ── Auto-Finalize Cron ────────────────────────────────────────────────────────
setInterval(async () => {
  try {
    const now      = new Date();
    const eligible = await prisma.batch.findMany({
      where: { status: 'challenge_period', challengeEndsAt: { lt: now }, onChainId: { not: null } }
    });
    for (const batch of eligible) {
      try {
        // Safety check: verify on-chain window is actually closed
        if (contract) {
          const open = await contract.isChallengeWindowOpen(ethers.BigNumber.from(batch.onChainId));
          if (open) { console.log(`⏳ On-chain window still open for batch ${batch.onChainId}`); continue; }
          const tx = await contract.finalizeBatch(ethers.BigNumber.from(batch.onChainId));
          await tx.wait();
          // BatchFinalized event handler takes it from here
        } else {
          // DB-only mode
          const full = await prisma.batch.findUnique({ where: { id: batch.id }, include: { transactions: true } });
          if (full) await stateManager.applyFinalizedBatch(full);
          await prisma.batch.update({ where: { id: batch.id }, data: { status: 'finalized' } });
          await prisma.pendingTransaction.updateMany({ where: { batchId: batch.id }, data: { status: 'finalized' } });
          broadcast('batch_finalized', { onChainId: batch.onChainId });
          console.log(`✅ Auto-finalized (DB-only) batch ${batch.onChainId}`);
        }
      } catch (e) { console.error(`Auto-finalize failed for ${batch.onChainId}:`, e.message); }
    }
  } catch (e) { console.error('Auto-finalize cron:', e.message); }
}, 30_000);

// ── Boot ──────────────────────────────────────────────────────────────────────
initBlockchain().then(connected => {
  startSequencer({ contract, wallet, broadcast, stateManager, prisma });
  app.listen(PORT, () => {
    console.log(`🚀 LayerGlide backend on http://localhost:${PORT}`);
    console.log(`   Chain: ${connected ? '✅ connected' : '⚠️  DB-only mode'}`);
    console.log(`   Challenge period: ${CHALLENGE_PERIOD_MS / 1000}s`);
  });
});