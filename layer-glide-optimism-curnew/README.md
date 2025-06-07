#  Layer 2 Optimistic Rollup dApp

This project implements a full-stack **Layer 2 scaling solution** using **Optimistic Rollups** on Ethereum. It includes:

-  Smart contracts for off-chain transaction handling  
-  A backend server for coordination and fraud handling  
-  A frontend dashboard for users to batch, verify, and monitor transactions

---

##  Features

-  Wallet integration via MetaMask  
-  Batch transaction submission  
-  Optimistic rollup architecture with Merkle tree state management  
-  Fraud proof mechanism (concept-level)  
-  Balance verification and withdrawal functionality  
-  Real-time Layer 1 ↔ Layer 2 sync capability

---

##  Tech Stack

| Layer           | Tools / Frameworks                                       |
|-----------------|----------------------------------------------------------|
| **Smart Contract** | Solidity, Hardhat, OpenZeppelin                   |
| **Backend**        | Node.js, Express, Prisma ORM, PostgreSQL          |
| **Frontend**       | React.js, TypeScript, Tailwind CSS, Vite          |
| **Blockchain**     | Ethers.js, MetaMask, Optimism Rollup (Sepolia)    |
| **Dev**            | dotenv, Alchemy API, PM2 (optional for prod)      |

---

##  Folder Structure

```
layer-glide-optimism/
├── backend/           # Node.js + Express server
│   └── server.js
├── contracts/         # Solidity smart contracts
│   └── Rollup.sol
├── frontend/          # React + Tailwind UI
│   └── src/
├── prisma/            # DB schema + migration scripts
├── scripts/           # Hardhat deploy scripts
├── .env               # Env variables (see below)
├── hardhat.config.js
├── package.json
└── README.md
```

---

##  .env File Setup

Create a `.env` file in the root (based on `.env.example`):

```env
# Alchemy API key
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Wallet private key (keep secure!)
PRIVATE_KEY=your_private_key_here

# Smart contract address after deployment
CONTRACT_ADDRESS=0xYourDeployedContractAddress
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

---

##  Setup Instructions

###  Prerequisites

- Node.js (v16+)
- `npm` or `yarn`
- MetaMask browser extension
- Alchemy API key from [https://alchemy.com](https://alchemy.com)
- Ethereum wallet with private key (test wallet)

---

##  Run Instructions (in order)

### 1. Start Local Hardhat Node (optional)

```bash
npx hardhat node
```

> Optional: For local development

---

### 2. Deploy Smart Contract

To **Sepolia testnet**:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

To **local Hardhat**:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

> After deployment, update `.env` and `src/config/contract.ts` with the deployed contract address.

---

### 3. Start the Backend

```bash
cd backend
node server.js
```

> Starts the Express API server connected to your contract

---

### 4. Start the Frontend

Back in the root directory:

```bash
npm run dev
```

> Visit localhost and connect MetaMask to the Sepolia network or hardhat

---

##  License

This project is licensed under the [MIT License](LICENSE).

---
