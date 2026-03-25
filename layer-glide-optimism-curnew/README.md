# LayerGlide — Production-Grade Optimistic Rollup on Ethereum

> A real Layer 2 scaling solution implementing Optimistic Rollup technology with parallel execution, fraud proofs, state root chaining, and EIP-712 signed transactions.

---

## Why This Is a Real Layer 2

| Property | How LayerGlide Achieves It |
|----------|---------------------------|
| **Trustless** | Smart contract enforces all state transitions on L1 |
| **State correctness** | Every batch commits a Merkle state root on-chain |
| **Fraud proof** | Anyone can prove invalid state transition → revert + slash |
| **Replay protection** | EIP-712 nonce per address, signed off-chain |
| **Data availability** | All tx data stored in DB + calldata on L1 |
| **Withdrawal security** | Requires Merkle proof from finalized state root |
| **Economic security** | Operator bond slashed on fraud, challenger rewarded |

---

## Architecture

```
User Browser
    │
    ├── Signs L2 tx (EIP-712, zero gas)
    │
    ▼
Backend API (Node.js + Express, port 5500)
    │
    ├── Verifies signature & nonce
    ├── Updates PENDING state (optimistic)
    ├── Stores in mempool (SQLite/Postgres)
    │
    ▼
Sequencer (runs inside backend)
    │
    ├── Collects pending txs every 10s
    ├── Simulates execution (ExecutionEngine)
    ├── Computes txRoot + stateRoot
    │
    ▼
Layer2Rollup.sol (Ethereum L1)
    │
    ├── submitBatch(txRoot, stateRoot, txCount)
    ├── Challenge period: 5 min (dev) / 7 days (prod)
    │
    ▼
Challenge Period
    │
    ├── Anyone can submitFraudProof()
    ├── Proves: state transition is INVALID
    ├── If accepted: operator slashed, state reverted
    │
    ▼
finalizeBatch()
    │
    ├── ONLY NOW: pending balances → finalized balances
    ├── Withdrawal roots published
    └── Users can withdraw with Merkle proof
```

---

## Two-Layer State Model

```
pendingBalance   = optimistic (updated on every L2 tx)
finalizedBalance = committed  (updated ONLY after finalization)
```

This is the correct model. Most demo rollups get this wrong and commit balances immediately.

---

## Fraud Proof Mechanics

A fraud proof proves: **"Given prevStateRoot + transactions → the submitted stateRoot is WRONG"**

Steps:
1. Re-execute all transactions in the batch off-chain
2. Compute what stateRoot should be
3. Compare with claimed stateRoot from contract
4. If different → generate Merkle proof that disputed tx is in batch
5. Call `submitFraudProof(batchId, txHash, merkleProof, correctStateRoot)`
6. Contract verifies: tx in batch AND stateRoot differs
7. Batch marked fraudulent → operator slashed → challenger rewarded

---

## Quick Start (Development)

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask browser extension
- (Optional) Rust for sidecar

### 1. Start Local Hardhat Node
```bash
npx hardhat node
```

### 2. Deploy Contract
```bash
npx hardhat run scripts/deploy.cjs --network localhost
# Copy CONTRACT_ADDRESS from output
```

### 3. Update Config
```bash
# backend/.env
CONTRACT_ADDRESS=0x<deployed_address>
VITE_CONTRACT_ADDRESS=0x<deployed_address>
```

### 4. Start Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your contract address
npm install
npx prisma migrate dev
node server.js
```

### 5. Start Frontend
```bash
# Root directory
npm install
npm run dev
```

### 6. (Optional) Start Rust Sidecar
```bash
cd rust-sidecar
cargo run --release
```

---

## Testing Each Feature

### Test 1: L1 Balance Stability
1. Connect MetaMask
2. Note L1 balance
3. Submit a few L2 transfers
4. Refresh several times
5. **Expected**: L1 balance NEVER changes on L2 transfers (only changes on deposit/withdraw)

### Test 2: Two-Layer State
1. Make an L2 transfer
2. Check "L2 Available" — decreases immediately
3. Check "L2 Finalized" — still old value
4. Wait for batch creation + challenge period (5 min in dev)
5. **Expected**: After finalization, "L2 Finalized" matches "L2 Available"

### Test 3: Nonce & Replay Protection
```bash
# Try to reuse a nonce — should fail
curl -X POST http://localhost:5500/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactions":[{"from":"0x...","to":"0x...","valueWei":"1000000000000000","nonce":0,"signature":"0x..."}]}'
# Expected: 400 Bad nonce: expected 1, got 0
```

### Test 4: Fraud Proof
1. Go to Fraud Proof page
2. Find a batch in "Challenge Period"
3. Click "Generate Proof"
4. If fraud detected (test: manually corrupt DB stateRoot), "Submit Fraud Proof On-Chain" appears
5. **Expected**: Batch marked rejected, sequencer bond slashed

### Test 5: Auto-Finalize Safety
```bash
# Check logs — should see:
# ⏰ Auto-finalizing batch onChainId=1
# ✅ BatchFinalized onChainId=1
# NOT: ❌ Auto-finalize failed
```

### Test 6: WebSocket (no polling)
1. Open browser DevTools → Network → WS
2. Connect to ws://localhost:5501
3. Submit an L2 tx
4. **Expected**: Single WebSocket message `tx_added` arrives — NO polling requests

### Test 7: Signature Verification
```bash
# Submit tx with bad signature
curl -X POST http://localhost:5500/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactions":[{"from":"0xf39...","to":"0x70...","valueWei":"100","nonce":0,"signature":"0xbadsig"}]}'
# Expected: 400 Signature mismatch
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=5500
WS_PORT=5501
NETWORK=localhost                    # localhost | sepolia
CONTRACT_ADDRESS=0x...               # from deploy script
PRIVATE_KEY=0xac09...                # Hardhat account #0 for local
ALCHEMY_API_KEY=                     # Required for Sepolia
DATABASE_URL="file:./dev.db"
CHALLENGE_PERIOD_SECONDS=300         # 5 min dev, 604800 (7 days) prod
FRONTEND_URL=http://localhost:8080
```

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:5500
VITE_WS_URL=ws://localhost:5501
VITE_CONTRACT_ADDRESS=0x...
```

---

## Production Deployment

### Infrastructure Requirements
- Server: 2 vCPU, 4GB RAM minimum (DigitalOcean Droplet, Hetzner CX21, etc.)
- Domain: Any registrar (Cloudflare for DNS)
- Database: PostgreSQL (replace SQLite)
- Reverse proxy: Nginx

### Step 1: Switch to PostgreSQL
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/layerglide"
```

### Step 2: Deploy Contract to Sepolia
```bash
# Set in .env:
NETWORK=sepolia
ALCHEMY_API_KEY=your_key
PRIVATE_KEY=your_operator_key

npx hardhat run scripts/deploy.cjs --network sepolia
```

### Step 3: Change Challenge Period
```env
CHALLENGE_PERIOD_SECONDS=604800  # 7 days
```

### Step 4: Nginx Config
```nginx
server {
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass         http://localhost:5500;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

### Step 5: PM2 Process Manager
```bash
npm install -g pm2
pm2 start backend/server.js --name layerglide-api
pm2 start rust-sidecar/target/release/layerglide-sidecar --name layerglide-sidecar
pm2 save
pm2 startup
```

### Step 6: CI/CD (GitHub Actions)
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: deploy
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /app/layerglide
            git pull
            cd backend && npm install && npx prisma migrate deploy
            pm2 restart all
```

---

## Free APIs for Production (Question 5)

| Service | What For | Free Tier |
|---------|----------|-----------|
| **Alchemy** | Ethereum RPC (Sepolia/Mainnet) | 300M compute units/month |
| **Infura** | Backup RPC provider | 100K requests/day |
| **Etherscan** | Block explorer verification | 5 requests/second |
| **QuickNode** | Additional RPC | 10M credits/month |

For real production (millions of users) you'd need:
- Dedicated Ethereum node (geth/erigon on your server, ~$100/month)
- PostgreSQL cluster (Supabase free tier: 500MB)
- Redis for nonce caching (Upstash free: 10K requests/day)

---

## Rust Sidecar (Option A)

For production scale, offload Merkle computation to Rust:

```bash
# Build
cd rust-sidecar
cargo build --release

# Run (port 5502)
./target/release/layerglide-sidecar

# Test
curl -X POST http://localhost:5502/merkle/tree \
  -H "Content-Type: application/json" \
  -d '{"leaves":["0xabc...","0xdef..."]}'
```

The Node.js backend can call `http://localhost:5502` for heavy Merkle operations.
In DB-only or dev mode, falls back to JS implementation.

---

## Gas Savings

| Scenario | L1 Direct | L2 (LayerGlide) | Saving |
|----------|-----------|------------------|--------|
| 1 transfer | 21,000 gas | ~25,000 gas (full batch) | none |
| 10 transfers | 210,000 gas | ~25,000 gas | ~88% |
| 100 transfers | 2,100,000 gas | ~50,000 gas | ~97.6% |
| 1000 transfers | 21,000,000 gas | ~100,000 gas | ~99.5% |

Compression ratio improves with batch size. At scale, 100x+ gas reduction.

---

## License

MIT