// import express from 'express';
// import cors from 'cors';
// import { ethers } from 'ethers';
// import { PrismaClient } from '@prisma/client';
// import MerkleTree from './merkleTree.js';
// import * as rollup from './rollup.js';
// import dotenv from 'dotenv';
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';
// function normalizeToWei(value) {
//   if (!value) return '0';
//   const v = value.toString().trim();
//   if (v === '0' || v === '') return '0';
//   // If it has no decimal point AND is 15+ chars, it's already wei
//   if (!v.includes('.') && v.length >= 15) return v;
//   // Otherwise treat as ETH string and convert
//   try {
//     return ethers.utils.parseEther(v).toString();
//   } catch {
//     return v;
//   }
// }

// function toUnixSeconds(ts) {
//   if (!ts) return Math.floor(Date.now() / 1000);
//   if (typeof ts === 'number') return ts > 1e12 ? Math.floor(ts / 1000) : ts;
//   return Math.floor(new Date(ts).getTime() / 1000);
// }
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// dotenv.config({ path: join(__dirname, '../.env') });

// const app = express();
// import { WebSocketServer } from 'ws';

// const wss = new WebSocketServer({ port: 5501 });
// const wsClients = new Set();
// wss.on('connection', ws => {
//   wsClients.add(ws);
//   ws.on('close', () => wsClients.delete(ws));
// });

// function broadcast(event, data) {
//   const msg = JSON.stringify({ event, data, ts: Date.now() });
//   wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
// }
// const PORT = 5500;

// const prisma = new PrismaClient();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // In-memory storage (replace with a database in production)
// const batches = [];
// const transactions = [];
// let nextBatchId = 1;
// let nextTxId = 1;

// // Contract configuration
// const CONTRACT_ABI = [
//   "function depositFunds() payable",
//   "function withdrawFunds(uint256 _amount)",
//   "function executeL2Transaction(address _recipient, uint256 _amount)",
//   "function executeL2BatchTransaction(address[] _recipients, uint256[] _amounts)",
//   "function submitBatch(bytes32[] _transactionsRoots)",
//   "function verifyBatch(uint256 _batchId)",
//   "function finalizeBatch(uint256 _batchId)",
//   "function reportFraud(uint256 _batchId, bytes32 _fraudProof, tuple(address sender, address recipient, uint256 amount) _tx, bytes32[] _merkleProof)",
//   "function balances(address) view returns (uint256)",
//   "function admin() view returns (address)",
//   "function isOperator(address) view returns (bool)",
//   "function changeAdmin(address newAdmin)",
//   "function addOperator(address operator)",
//   "function removeOperator(address operator)",
//   "function nextBatchId() view returns (uint256)",
//   "function slashingPenalty() view returns (uint256)",
//   "function batches(uint256) view returns (uint256 batchId, bytes32 transactionsRoot, uint256 timestamp, bool verified, bool finalized)",
//   "event TransactionExecuted(address indexed from, address indexed to, uint256 value, uint256 timestamp, uint256 indexed batchId)",
//   "event BatchSubmitted(uint256 indexed batchId, bytes32 transactionsRoot)",
//   "event BatchVerified(uint256 indexed batchId)",
//   "event BatchFinalized(uint256 indexed batchId)",
//   "event FraudReported(uint256 indexed batchId, bytes32 fraudProof)",
//   "event AdminChanged(address indexed previousAdmin, address indexed newAdmin)",
//   "event OperatorAdded(address indexed operator)",
//   "event OperatorRemoved(address indexed operator)",
//   "event FundsDeposited(address indexed user, uint256 amount)",
//   "event FundsWithdrawn(address indexed user, uint256 amount)",
//   "event FraudPenaltyApplied(address indexed user, uint256 penalty)"
// ];

// // Get contract address from .env
// const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

// // Network configuration
// const NETWORK = process.env.NETWORK || 'localhost'; // 'localhost' or 'sepolia'

// // Get Alchemy API key from .env
// const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// // Connect to the Ethereum network (Sepolia) via Alchemy
// let provider;
// let contract;

// // Initialize provider and contract
// const initBlockchainConnection = async () => {
//   try {
//     if (NETWORK === 'sepolia') {
//       console.log('Initializing blockchain connection with Alchemy API (Sepolia)');
//       if (!ALCHEMY_API_KEY) {
//         console.error('ALCHEMY_API_KEY not found in .env file.');
//         return false;
//       }

//       provider = new ethers.providers.AlchemyProvider("sepolia", ALCHEMY_API_KEY);
//       const privateKey = process.env.PRIVATE_KEY;
//       if (!privateKey) {
//         console.error('PRIVATE_KEY not found in .env file.');
//         return false;
//       }

//       const wallet = new ethers.Wallet(privateKey, provider);
//       contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

//       console.log(`Connected to Sepolia network`);
//     } else {
//       console.log('Initializing blockchain connection with local Hardhat node');

//       // For local development, try to connect to the Hardhat node
//       try {
//         provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

//         // Check if the node is running by getting the network
//         const network = await provider.getNetwork();
//         console.log(`Connected to local network: ${network.name} (chainId: ${network.chainId})`);

//         // Use the default Hardhat private key for local development
//         const privateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
//         const wallet = new ethers.Wallet(privateKey, provider);
//         contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

//         console.log(`Connected to local network`);

//         // For local development, we'll use the database to track state
//         // This ensures persistence even when the node restarts
//         console.log('Using database for state persistence in local development');
//       } catch (error) {
//         console.error('Failed to connect to local Hardhat node:', error);
//         console.log('Continuing with database-only mode for local development');
//         // We'll continue without a blockchain connection in local mode
//         // This allows the app to work with just the database
//       }
//     }

//     console.log(`Contract address: ${CONTRACT_ADDRESS}`);
//     return true;
//   } catch (error) {
//     console.error('Error initializing blockchain connection:', error);
//     return false;
//   }
// };

// // Initialize blockchain connection
// let isConnected = false;

// // Initialize blockchain connection asynchronously
// const initializeBlockchain = async () => {
//   isConnected = await initBlockchainConnection();
//   console.log(`Blockchain connection status: ${isConnected ? 'Connected' : 'Not connected'}`);
// };

// // Start the initialization
// initializeBlockchain().catch(err => {
//   console.error('Failed to initialize blockchain connection:', err);
// });

// // Admin authentication middleware
// const adminAuth = async (req, res, next) => {
//   try {
//     const userAddress = req.headers['x-admin-address'];
//     if (!userAddress) {
//       return res.status(401).json({ success: false, message: 'Admin authentication required' });
//     }

//     console.log('Authenticating admin request from:', userAddress);

//     // Check admin status from the contract
//     try {
//       let adminAddress;
//       let isOperator = false;

//       if (contract) {
//         // Try admin() first
//         try {
//           console.log('Calling admin() function...');
//           adminAddress = await contract.admin();
//           console.log('Admin address from contract:', adminAddress);
//         } catch (adminError) {
//           console.log('admin() function failed, trying owner()');
//           try {
//             // Fallback to owner() if admin() fails
//             console.log('Calling owner() function...');
//             adminAddress = await contract.owner();
//             console.log('Owner address from contract:', adminAddress);
//           } catch (ownerError) {
//             console.error('Both admin() and owner() failed:', ownerError);
//             // If both fail, use hardcoded admin address for development
//             adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
//             console.log('Using hardcoded admin address:', adminAddress);
//           }
//         }

//         // Try to check operator status
//         try {
//           console.log('Checking operator status...');
//           isOperator = await contract.isOperator(userAddress);
//           console.log('Is operator:', isOperator);
//         } catch (operatorError) {
//           console.log('isOperator check failed:', operatorError);
//           // Continue without operator status
//         }
//       } else {
//         // If contract is not initialized, use hardcoded admin address
//         adminAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
//         console.log('Contract not initialized, using hardcoded admin address:', adminAddress);
//       }

//       const isAdmin = userAddress.toLowerCase() === adminAddress.toLowerCase() || isOperator;
//       console.log('Final admin status:', isAdmin);

//       if (!isAdmin) {
//         return res.status(403).json({ success: false, message: 'Unauthorized: Admin privileges required' });
//       }

//       next();
//     } catch (error) {
//       console.error('Error checking admin status:', error);
//       // For development, allow hardcoded admin address as fallback

//       if (!isAdmin) {
//         return res.status(403).json({ success: false, message: 'Unauthorized: Admin privileges required' });
//       }

//       next();
//     }
//   } catch (error) {
//     console.error('Admin authentication error:', error);
//     res.status(500).json({ success: false, message: 'Authentication error' });
//   }
// };

// // Utility function to generate uint256-compatible batch ID
// const generateBatchId = () => {
//   return BigInt(Date.now()).toString(); // Example: Use timestamp as uint256-compatible ID
// };

// // API Routes

// // Get all batches
// app.get('/api/batches', async (req, res) => {
//   try {
//     const batches = await prisma.batch.findMany({
//       orderBy: {
//         createdAt: 'desc'
//       },
//       include: {
//         transactions: true
//       }
//     });
//     res.json(batches);
//   } catch (error) {
//     console.error('Error fetching batches:', error);
//     res.status(500).json({ error: 'Failed to fetch batches' });
//   }
// });

// // Store batch in database
// app.post('/api/batches', async (req, res) => {
//   try {
//     const { batchId, transactionsRoot, transactions } = req.body;

//     if (!batchId || !transactionsRoot) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     console.log(`Storing batch ${batchId} in database`);

//     // Store batch in database
//     const batch = await prisma.batch.upsert({
//       where: { batchId },
//       update: {
//         transactionsRoot,
//         verified: false,
//         finalized: false
//       },
//       create: {
//         batchId,
//         transactionsRoot,
//         verified: false,
//         finalized: false
//       }
//     });

//     // Store transactions if provided
//     if (transactions && Array.isArray(transactions) && transactions.length > 0) {
//       for (const tx of transactions) {
//         const txId = `${batch.id}-${tx.from}-${tx.to}-${tx.value}`;
//         await prisma.batchTransaction.upsert({
//           where: {
//             id: txId
//           },
//           update: {
//             status: tx.status || 'pending'
//           },
//           create: {
//             id: txId,
//             from: tx.from,
//             to: tx.to,
//             value: tx.value.toString(), // Ensure value is stored as string
//             status: tx.status || 'pending',
//             batchId: batch.id
//           }
//         });
//       }
//     }

//     // Submit batch to blockchain if connected
//     if (isConnected && contract) {
//       try {
//         const tx = await contract.submitBatch([transactionsRoot]);
//         const receipt = await tx.wait();
//         console.log(`Batch submitted to blockchain. Transaction hash: ${receipt.transactionHash}`);
//       } catch (error) {
//         console.error('Error submitting batch to blockchain:', error);
//       }
//     }

//     res.json(batch);
//   } catch (error) {
//     console.error('Error storing batch:', error);
//     res.status(500).json({ error: 'Failed to store batch' });
//   }
// });

// // Verify a batch
// app.post('/api/batches/verify', adminAuth, async (req, res) => {
//   try {
//     const { batchId } = req.body;
//     if (!batchId) {
//       return res.status(400).json({ error: 'Batch ID is required' });
//     }

//     // Find the batch in the database
//     const batch = await prisma.batch.findUnique({
//       where: { id: batchId },
//       include: { transactions: true }
//     });

//     if (!batch) {
//       return res.status(404).json({ error: 'Batch not found' });
//     }

//     // Get the active contract deployment
//     const activeDeployment = await prisma.contractDeployment.findFirst({
//       where: { isActive: true }
//     });

//     if (!activeDeployment) {
//       return res.status(404).json({ error: 'No active contract deployment found' });
//     }

//     // Update batch status to verified
//     const updatedBatch = await prisma.batch.update({
//       where: { id: batchId },
//       data: {
//         verified: true,
//         finalized: false,
//         rejected: false
//       },
//       include: { transactions: true }
//     });

//     // Update transaction statuses to verified
//     await prisma.batchTransaction.updateMany({
//       where: { batchId: batch.id },
//       data: { status: 'verified' }
//     });

//     // Update L2 balances for each transaction
//     for (const tx of batch.transactions) {
//       // Update sender's balance
//       const senderBalance = await prisma.layer2Balance.findUnique({
//         where: {
//           userAddress_contractAddress: {
//             userAddress: tx.from.toLowerCase(),
//             contractAddress: activeDeployment.address
//           }
//         }
//       });

//       if (senderBalance) {
//         const newSenderBalance = (BigInt(senderBalance.balance) - BigInt(tx.value)).toString();
//         await prisma.layer2Balance.update({
//           where: {
//             userAddress_contractAddress: {
//               userAddress: tx.from.toLowerCase(),
//               contractAddress: activeDeployment.address
//             }
//           },
//           data: { balance: newSenderBalance }
//         });
//       }

//       // Update recipient's balance
//       const recipientBalance = await prisma.layer2Balance.findUnique({
//         where: {
//           userAddress_contractAddress: {
//             userAddress: tx.to.toLowerCase(),
//             contractAddress: activeDeployment.address
//           }
//         }
//       });

//       if (recipientBalance) {
//         const newRecipientBalance = (BigInt(recipientBalance.balance) + BigInt(tx.value)).toString();
//         await prisma.layer2Balance.update({
//           where: {
//             userAddress_contractAddress: {
//               userAddress: tx.to.toLowerCase(),
//               contractAddress: activeDeployment.address
//             }
//           },
//           data: { balance: newRecipientBalance }
//         });
//       } else {
//         // Create new balance record for recipient
//         await prisma.layer2Balance.create({
//           data: {
//             userAddress: tx.to.toLowerCase(),
//             contractAddress: activeDeployment.address,
//             balance: tx.value
//           }
//         });
//       }
//     }

//     return res.json({
//       success: true,
//       message: 'Batch verified successfully',
//       batch: updatedBatch
//     });
//   } catch (error) {
//     console.error('Error verifying batch:', error);
//     return res.status(500).json({ error: 'Failed to verify batch' });
//   }
// });

// // Reject a batch
// app.post('/api/batches/reject', async (req, res) => {
//   try {
//     const { batchId } = req.body;
//     if (!batchId) {
//       return res.status(400).json({ error: 'Batch ID is required' });
//     }

//     // Find the batch in the database
//     const batch = await prisma.batch.findUnique({
//       where: { id: batchId }
//     });

//     if (!batch) {
//       return res.status(404).json({ error: 'Batch not found' });
//     }

//     // Update the batch status to rejected
//     const updatedBatch = await prisma.$transaction(async (prisma) => {
//       // First update the batch
//       const batch = await prisma.batch.update({
//         where: { id: batchId },
//         data: {
//           verified: false,
//           finalized: false,
//           rejected: true
//         }
//       });

//       // Then update all associated transactions
//       await prisma.batchTransaction.updateMany({
//         where: {
//           batch: {
//             id: batchId
//           }
//         },
//         data: {
//           status: 'rejected'
//         }
//       });

//       return batch;
//     });

//     res.json({
//       message: 'Batch rejected successfully',
//       batch: updatedBatch
//     });
//   } catch (error) {
//     console.error('Error rejecting batch:', error);
//     res.status(500).json({ error: 'Failed to reject batch' });
//   }
// });

// // Update batch status
// app.put('/api/batches', async (req, res) => {
//   try {
//     const { batchId, verified, finalized } = req.body;

//     if (!batchId) {
//       return res.status(400).json({ error: 'Missing batchId' });
//     }

//     // Update batch status in database
//     const batch = await prisma.batch.update({
//       where: { batchId },
//       data: {
//         verified: verified !== undefined ? verified : undefined,
//         finalized: finalized !== undefined ? finalized : undefined
//       }
//     });

//     return res.status(200).json(batch);
//   } catch (error) {
//     console.error('Error updating batch status:', error);
//     return res.status(500).json({ error: 'Failed to update batch status' });
//   }
// });

// // Get batch by ID
// app.get('/api/batches/:id', async (req, res) => {
//   try {
//     if (!isConnected || !contract) {
//       const mockBatch = getMockBatches().find(b => b.id === req.params.id);
//       return res.json(mockBatch || { error: "Batch not found" });
//     }

//     const batchId = req.params.id;
//     const batch = await contract.batches(batchId);

//     if (Number(batch.batchId) === 0) {
//       return res.status(404).json({ error: "Batch not found" });
//     }

//     const batchData = {
//       id: batch.batchId.toString(),
//       transactionsRoot: batch.transactionsRoot,
//       timestamp: new Date(Number(batch.timestamp) * 1000).toISOString(),
//       verified: batch.verified,
//       finalized: batch.finalized,
//       transactions: [], // We don't have transactions details from the contract
//     };

//     res.json(batchData);
//   } catch (error) {
//     console.error(`Error fetching batch ${req.params.id}:`, error);
//     const mockBatch = getMockBatches().find(b => b.id === req.params.id);
//     res.json(mockBatch || { error: "Batch not found" });
//   }
// });

// // Submit batch transactions
// app.post('/api/transactions', async (req, res) => {
//   try {
//     const { transactions } = req.body;
//     console.log('Received transactions:', JSON.stringify(transactions, null, 2));

//     if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
//       return res.status(400).json({ error: 'Invalid transactions data' });
//     }

//     // FIX 1: Normalize all values to wei BEFORE anything else
//     const normalized = transactions.map(tx => ({
//       fromAddress: (tx.from || tx.fromAddress || '').toLowerCase(),
//       toAddress:   (tx.to   || tx.toAddress   || '').toLowerCase(),
//       valueWei:    normalizeToWei(tx.amount || tx.value || tx.valueWei || '0'),
//     }));

//     // Validate addresses
//     for (const tx of normalized) {
//       if (!ethers.utils.isAddress(tx.fromAddress)) {
//         return res.status(400).json({ error: `Invalid from address: ${tx.fromAddress}` });
//       }
//       if (!ethers.utils.isAddress(tx.toAddress)) {
//         return res.status(400).json({ error: `Invalid to address: ${tx.toAddress}` });
//       }
//     }

//     // FIX 2: Build Merkle root correctly from normalized wei values
//     const leaves = normalized.map(tx =>
//       ethers.utils.keccak256(
//         ethers.utils.defaultAbiCoder.encode(
//           ['address', 'address', 'uint256'],
//           [tx.fromAddress, tx.toAddress, ethers.BigNumber.from(tx.valueWei)]
//         )
//       )
//     );

//     let root = ethers.constants.HashZero;
//     if (leaves.length > 0) {
//       let layer = [...leaves];
//       while (layer.length > 1) {
//         const next = [];
//         for (let i = 0; i < layer.length; i += 2) {
//           const left  = layer[i];
//           const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
//           next.push(
//             left <= right
//               ? ethers.utils.keccak256(ethers.utils.concat([left, right]))
//               : ethers.utils.keccak256(ethers.utils.concat([right, left]))
//           );
//         }
//         layer = next;
//       }
//       root = layer[0];
//     }

//     // FIX 3: Create batch with correct schema fields, no random batchId
//     const batch = await prisma.batch.create({
//       data: {
//         transactionsRoot: root,
//         status: 'pending_submission',
//         txCount: normalized.length,
//         transactions: {
//           create: normalized.map(tx => ({
//             fromAddress: tx.fromAddress,
//             toAddress:   tx.toAddress,
//             valueWei:    tx.valueWei,
//             status:      'pending',
//           }))
//         }
//       },
//       include: { transactions: true }
//     });

//     console.log('Created batch in DB:', batch.id);

//     // FIX 4: Submit to contract and capture the REAL on-chain batchId from the event
//     if (contract) {
//       try {
//         const tx = await contract.submitBatch(root, normalized.length);
//         const receipt = await tx.wait();

//         // Capture the real uint256 batchId emitted by the contract
//         const event = receipt.events?.find(e => e.event === 'BatchSubmitted');
//         if (event) {
//           const onChainId = event.args.batchId.toString();
//           const challengeEndsAt = new Date(
//             Date.now() + (parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000)
//           );

//           await prisma.batch.update({
//             where: { id: batch.id },
//             data: {
//               onChainId,
//               status: 'challenge_period',
//               challengeEndsAt,
//               submitter: wallet.address,
//               onChainTxHash: receipt.transactionHash,
//             }
//           });

//           console.log(`✅ Batch confirmed on-chain. onChainId=${onChainId}`);
//           broadcast('batch_created', { id: batch.id, onChainId, txCount: normalized.length });
//         }
//       } catch (err) {
//         console.error('Contract submitBatch failed:', err.message);
//         // Batch stays as pending_submission in DB — not a fatal error
//         // The batch exists in DB, operator can retry submission
//       }
//     } else {
//       console.log('Contract not connected. Batch saved to DB only.');
//     }

//     res.status(201).json({
//       id: batch.id,
//       onChainId: batch.onChainId || null,
//       txCount: normalized.length,
//       status: batch.status,
//       transactionsRoot: root,
//     });

//   } catch (error) {
//     console.error('Error creating batch:', error);
//     res.status(500).json({
//       error: 'Failed to create batch',
//       details: error.message,
//     });
//   }
// });

// // Get transactions by address
// app.get('/api/transactions', async (req, res) => {
//   const { address } = req.query;

//   if (!address) {
//     return res.status(400).json({ error: "Address is required" });
//   }

//   try {
//     // Filter local transactions by address
//     const addressTransactions = transactions.filter(
//       tx => tx.sender.toLowerCase() === address.toLowerCase() ||
//         tx.recipient.toLowerCase() === address.toLowerCase()
//     );

//     // If connected to blockchain, we could fetch additional transaction data here

//     if (addressTransactions.length > 0) {
//       return res.json(addressTransactions);
//     } else {
//       // Return mock data if no transactions found
//       return res.json(getMockTransactionStatus(address));
//     }
//   } catch (error) {
//     console.error('Error fetching transactions:', error);
//     return res.json(getMockTransactionStatus(address));
//   }
// });

// // Get fraud proof for a transaction
// app.get('/api/proof/:batchId/:transactionIndex', (req, res) => {
//   const { batchId, transactionIndex } = req.params;

//   const batch = batches.find(b => b.id === batchId);

//   if (!batch) {
//     return res.status(404).json({ error: "Batch not found" });
//   }

//   const index = parseInt(transactionIndex);

//   if (isNaN(index) || index < 0 || index >= batch.transactions.length) {
//     return res.status(400).json({ error: "Invalid transaction index" });
//   }

//   // Get the Merkle proof for the transaction
//   const merkleProof = batch.merkleTree.getProof(index);

//   // In a real implementation, the fraud proof would be computed based on an invalid state transition
//   const fraudProof = ethers.utils.id("fraud proof");

//   res.json({
//     fraudProof,
//     merkleProof,
//   });
// });

// // Get gas prices from blockchain
// app.get('/api/gas-prices', async (req, res) => {
//   try {
//     if (!isConnected || !provider) {
//       return res.json({
//         slow: "20",
//         standard: "25",
//         fast: "30",
//         rapid: "35",
//       });
//     }

//     const feeData = await provider.getFeeData();
//     const gasPriceGwei = Math.round(Number(ethers.utils.formatUnits(feeData.gasPrice, "gwei")));

//     res.json({
//       slow: (gasPriceGwei * 0.8).toFixed(0),
//       standard: gasPriceGwei.toFixed(0),
//       fast: (gasPriceGwei * 1.2).toFixed(0),
//       rapid: (gasPriceGwei * 1.5).toFixed(0),
//     });
//   } catch (error) {
//     console.error('Error fetching gas prices:', error);
//     res.json({
//       slow: "20",
//       standard: "25",
//       fast: "30",
//       rapid: "35",
//     });
//   }
// });

// // Get balance for an address
// app.get('/api/balance/:address', async (req, res) => {
//   const { address } = req.params;

//   if (!address) {
//     return res.status(400).json({ error: "Address is required" });
//   }

//   try {
//     let layer1Balance = "0";
//     let layer2Balance = "0";

//     // Try to get balances from blockchain if connected
//     if (isConnected && provider && contract) {
//       try {
//         // Get Ethereum balance
//         const ethBalance = await provider.getBalance(address);
//         layer1Balance = ethers.utils.formatEther(ethBalance);

//         // Get Layer 2 balance from contract
//         const l2Balance = await contract.balances(address);
//         layer2Balance = ethers.utils.formatEther(l2Balance);

//         console.log(`Fetched balances for ${address}: L1=${layer1Balance}, L2=${layer2Balance}`);
//       } catch (error) {
//         console.error('Error fetching balances from blockchain:', error);
//         // Continue with database values if blockchain fetch fails
//       }
//     }

//     // If blockchain values are 0 or we couldn't connect, try to get from database
//     if (layer2Balance === "0") {
//       try {
//         // Get the active contract deployment
//         const activeDeployment = await prisma.contractDeployment.findFirst({
//           where: { isActive: true }
//         });

//         if (activeDeployment) {
//           // Get Layer 2 balance from database
//           const dbBalance = await prisma.layer2Balance.findUnique({
//             where: {
//               userAddress_contractAddress: {
//                 userAddress: address.toLowerCase(),
//                 contractAddress: activeDeployment.address
//               }
//             }
//           });

//           if (dbBalance) {
//             layer2Balance = dbBalance.balance;
//             console.log(`Using database balance for ${address}: ${layer2Balance}`);
//           }
//         }
//       } catch (error) {
//         console.error('Error fetching balance from database:', error);
//       }
//     }

//     // Update or create the balance record in the database
//     try {
//       const activeDeployment = await prisma.contractDeployment.findFirst({
//         where: { isActive: true }
//       });

//       if (activeDeployment) {
//         await prisma.balance.upsert({
//           where: { address: address.toLowerCase() },
//           update: {
//             layer1Balance,
//             layer2Balance,
//             lastUpdated: new Date()
//           },
//           create: {
//             address: address.toLowerCase(),
//             layer1Balance,
//             layer2Balance,
//             lastUpdated: new Date()
//           }
//         });
//       }
//     } catch (error) {
//       console.error('Error updating balance in database:', error);
//     }

//     return res.json({
//       layer1Balance,
//       layer2Balance
//     });
//   } catch (error) {
//     console.error('Error fetching balance:', error);
//     return res.status(500).json({ error: "Failed to fetch balance" });
//   }
// });

// // Get pending transactions
// app.get('/api/transactions/pending', async (req, res) => {
//     try {
//         const pendingTransactions = await prisma.batchTransaction.findMany({
//             where: {
//                 status: 'pending'
//             },
//             orderBy: {
//                 createdAt: 'asc'
//             },
//             select: {
//                 id: true,
//                 from: true,
//                 to: true,
//                 value: true,
//                 status: true,
//                 createdAt: true
//             }
//         });

//         const formattedTransactions = pendingTransactions.map(tx => ({
//             ...tx,
//             createdAt: tx.createdAt.toISOString()
//         }));

//         return res.status(200).json(formattedTransactions);
//     } catch (error) {
//         console.error('Error fetching pending transactions:', error);
//         return res.status(500).json({ error: 'Failed to fetch pending transactions' });
//     }
// });

// // Balance update endpoint - moved to root level
// app.post('/api/balance/update', async (req, res) => {
//   try {
//     const { userAddress, contractAddress, balance } = req.body;

//     if (!userAddress || !contractAddress || !balance) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     // First, check if we have an active contract deployment
//     let deployment = await prisma.contractDeployment.findFirst({
//       where: {
//         address: contractAddress,
//         isActive: true
//       }
//     });

//     // If no deployment exists, create one
//     if (!deployment) {
//       deployment = await prisma.contractDeployment.create({
//         data: {
//           address: contractAddress,
//           network: NETWORK,
//           isActive: true
//         }
//       });
//     }

//     // Update or create the balance record
//     const updatedBalance = await prisma.layer2Balance.upsert({
//       where: {
//         userAddress_contractAddress: {
//           userAddress,
//           contractAddress
//         }
//       },
//       create: {
//         userAddress,
//         contractAddress,
//         balance
//       },
//       update: {
//         balance
//       }
//     });

//     return res.status(200).json(updatedBalance);
//   } catch (error) {
//     console.error('Error updating balance:', error);
//     return res.status(500).json({ error: 'Failed to update balance' });
//   }
// });

// // Mock data generators for fallback
// const getMockBatches = () => {
//   return [
//     {
//       id: '1',
//       batchId: '1',
//       transactionsRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
//       status: 'pending',
//       timestamp: new Date().toISOString(),
//       size: 5
//     },
//     {
//       id: '2',
//       batchId: '2',
//       transactionsRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
//       status: 'verified',
//       timestamp: new Date().toISOString(),
//       size: 3
//     }
//   ];
// };

// const getMockTransactionStatus = (address) => {
//   return [
//     {
//       hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
//       from: address,
//       to: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
//       value: '1000000000000000000',
//       status: 'pending',
//       timestamp: new Date().toISOString()
//     },
//     {
//       hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
//       from: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
//       to: address,
//       value: '500000000000000000',
//       status: 'completed',
//       timestamp: new Date().toISOString()
//     }
//   ];
// };

// // Get live transactions
// app.get('/api/transactions/live', async (req, res) => {
//   try {
//     // Get recent transactions from the database
//     const recentTransactions = await prisma.batchTransaction.findMany({
//       orderBy: {
//         createdAt: 'desc'
//       },
//       take: 20, // Limit to 20 most recent transactions
//       include: {
//         batch: true
//       }
//     });

//     // Format transactions for the frontend
//     const formattedTransactions = recentTransactions.map(tx => ({
//       hash: tx.id, // Use the database ID as a hash if no blockchain hash is available
//       from: tx.from,
//       to: tx.to,
//       value: tx.value,
//       status: tx.status,
//       createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
//       batchId: tx.batch?.batchId
//     }));

//     return res.json(formattedTransactions);
//   } catch (error) {
//     console.error('Error fetching live transactions:', error);
//     return res.status(500).json({ error: "Failed to fetch live transactions" });
//   }
// });

// // Get all network transactions
// app.get('/api/transactions/network', async (req, res) => {
//   try {
//     // Get all transactions from the database, ordered by createdAt
//     const transactions = await prisma.batchTransaction.findMany({
//       orderBy: {
//         createdAt: 'desc'
//       },
//       include: {
//         batch: true
//       }
//     });

//     // Format transactions for the frontend
//     const formattedTransactions = transactions.map(tx => {
//       try {
//         return {
//           hash: tx.id,
//           from: tx.from,
//           to: tx.to,
//           value: tx.value,
//           status: tx.batch ? (tx.batch.verified ? 'verified' : tx.batch.finalized ? 'finalized' : tx.batch.rejected ? 'rejected' : 'pending') : 'pending',
//           createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
//           batchId: tx.batch?.batchId || null,
//           type: tx.type || 'transfer',
//           isInBatch: !!tx.batch
//         };
//       } catch (err) {
//         console.error('Error formatting transaction:', err);
//         return {
//           hash: tx.id,
//           from: tx.from,
//           to: tx.to,
//           value: tx.value,
//           status: 'pending',
//           createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
//           batchId: null,
//           type: 'transfer',
//           isInBatch: false
//         };
//       }
//     });

//     res.json(formattedTransactions);
//   } catch (error) {
//     console.error('Error fetching network transactions:', error);
//     res.status(500).json({ error: 'Failed to fetch network transactions' });
//   }
// });

// // Get user transaction history
// app.get('/api/transactions/user/:address', async (req, res) => {
//   try {
//     const { address } = req.params;
//     if (!address) {
//       return res.status(400).json({ error: 'Address is required' });
//     }

//     // Get all transactions where the address is either sender or recipient
//     const transactions = await prisma.batchTransaction.findMany({
//       where: {
//         OR: [
//           { from: address.toLowerCase() },
//           { to: address.toLowerCase() }
//         ]
//       },
//       include: {
//         batch: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });

//     // Get Layer 2 balance
//     const balance = await prisma.layer2Balance.findFirst({
//       where: {
//         userAddress: address.toLowerCase()
//       },
//       orderBy: {
//         updatedAt: 'desc'
//       }
//     });

//     const formattedTransactions = transactions.map(tx => {
//       try {
//         return {
//           hash: tx.id,
//           from: tx.from,
//           to: tx.to,
//           value: tx.value,
//           status: tx.batch ? (tx.batch.verified ? 'verified' : tx.batch.finalized ? 'finalized' : tx.batch.rejected ? 'rejected' : 'pending') : 'pending',
//           createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
//           batchId: tx.batch?.batchId || null,
//           type: tx.type || 'transfer',
//           isInBatch: !!tx.batch
//         };
//       } catch (err) {
//         console.error('Error formatting transaction:', err);
//         return {
//           hash: tx.id,
//           from: tx.from,
//           to: tx.to,
//           value: tx.value,
//           status: 'pending',
//           createdAt: Math.floor(new Date(tx.createdAt).getTime() / 1000),
//           batchId: null,
//           type: 'transfer',
//           isInBatch: false
//         };
//       }
//     });

//     res.json({
//       transactions: formattedTransactions,
//       balance: balance?.balance || "0"
//     });
//   } catch (error) {
//     console.error('Error fetching user transactions:', error);
//     res.status(500).json({ error: 'Failed to fetch user transactions' });
//   }
// });

// // Get user batches
// app.get('/api/batches/user/:address', async (req, res) => {
//   try {
//     const { address } = req.params;
//     if (!address) {
//       return res.status(400).json({ error: 'Address is required' });
//     }

//     // Get all batches where the address is involved in any transaction
//     const batches = await prisma.batch.findMany({
//       where: {
//         transactions: {
//           some: {
//             OR: [
//               { from: address.toLowerCase() },
//               { to: address.toLowerCase() }
//             ]
//           }
//         }
//       },
//       include: {
//         transactions: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });

//     res.json(batches);
//   } catch (error) {
//     console.error('Error fetching user batches:', error);
//     res.status(500).json({ error: 'Failed to fetch user batches' });
//   }
// });

// // Admin check endpoint
// app.get('/api/admin/check', async (req, res) => {
//   try {
//     const { address } = req.query;
//     if (!address) {
//       return res.status(400).json({ success: false, message: 'Address is required' });
//     }

//     // Check if contract is initialized
//     if (!contract) {
//       console.error('Contract not initialized');
//       return res.status(500).json({ success: false, message: 'Contract not initialized' });
//     }

//     console.log('Checking admin status for address:', address);

//     try {
//       let adminAddress;
//       let isOperator = false;

//       // Try admin() first
//       try {
//         console.log('Calling admin() function...');
//         adminAddress = await contract.admin();
//         console.log('Admin address from contract:', adminAddress);
//       } catch (adminError) {
//         console.log('admin() function failed, trying owner()');
//         try {
//           // Fallback to owner() if admin() fails
//           console.log('Calling owner() function...');
//           adminAddress = await contract.owner();
//           console.log('Owner address from contract:', adminAddress);
//         } catch (ownerError) {
//           console.error('Both admin() and owner() failed:', ownerError);
//           // If both fail, check against hardcoded admin address for development
//           const hardcodedAdmin = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
//           console.log('Using hardcoded admin address:', hardcodedAdmin);
//           adminAddress = hardcodedAdmin;
//         }
//       }

//       // Try to check operator status
//       try {
//         console.log('Checking operator status...');
//         isOperator = await contract.isOperator(address);
//         console.log('Is operator:', isOperator);
//       } catch (operatorError) {
//         console.log('isOperator check failed:', operatorError);
//         // Continue without operator status
//       }

//       const isAdmin = address.toLowerCase() === adminAddress.toLowerCase() || isOperator;
//       console.log('Final admin status:', isAdmin);

//       res.json({
//         success: true,
//         isAdmin,
//         adminAddress: isAdmin ? adminAddress : null
//       });
//     } catch (error) {
//       console.error('Error checking admin status from contract:', error);
//       // For development, allow hardcoded admin address
//       const hardcodedAdmin = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
//       const isAdmin = address.toLowerCase() === hardcodedAdmin.toLowerCase();
//       res.json({
//         success: true,
//         isAdmin,
//         adminAddress: isAdmin ? hardcodedAdmin : null
//       });
//     }
//   } catch (error) {
//     console.error('Error in admin check:', error);
//     res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// });

// // Get operators
// app.get('/api/operators', async (req, res) => {
//   try {
//     const operators = await prisma.operator.findMany({
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });
//     res.json(operators);
//   } catch (error) {
//     console.error('Error fetching operators:', error);
//     res.status(500).json({ error: 'Failed to fetch operators' });
//   }
// });

// // Update Layer 2 balances after batch verification
// app.post('/api/batches/update-balances', adminAuth, async (req, res) => {
//   try {
//     const { batchId } = req.body;
//     if (!batchId) {
//       return res.status(400).json({ success: false, message: 'Batch ID is required' });
//     }

//     // Find the batch and its transactions
//     const batch = await prisma.batch.findUnique({
//       where: { batchId },
//       include: { transactions: true }
//     });

//     if (!batch) {
//       return res.status(404).json({ error: 'Batch not found' });
//     }

//     // Get the active contract deployment
//     const activeDeployment = await prisma.contractDeployment.findFirst({
//       where: { isActive: true }
//     });

//     if (!activeDeployment) {
//       return res.status(500).json({ error: 'No active contract deployment found' });
//     }

//     // Update balances for each transaction
//     for (const tx of batch.transactions) {
//       // Update sender's balance
//       const senderBalance = await prisma.layer2Balance.findUnique({
//         where: {
//           userAddress_contractAddress: {
//             userAddress: tx.from.toLowerCase(),
//             contractAddress: activeDeployment.address
//           }
//         }
//       });

//       if (senderBalance) {
//         const newSenderBalance = (BigInt(senderBalance.balance) - BigInt(tx.value)).toString();
//         await prisma.layer2Balance.update({
//           where: {
//             userAddress_contractAddress: {
//               userAddress: tx.from.toLowerCase(),
//               contractAddress: activeDeployment.address
//             }
//           },
//           data: { balance: newSenderBalance }
//         });
//       }

//       // Update recipient's balance
//       const recipientBalance = await prisma.layer2Balance.findUnique({
//         where: {
//           userAddress_contractAddress: {
//             userAddress: tx.to.toLowerCase(),
//             contractAddress: activeDeployment.address
//           }
//         }
//       });

//       if (recipientBalance) {
//         const newRecipientBalance = (BigInt(recipientBalance.balance) + BigInt(tx.value)).toString();
//         await prisma.layer2Balance.update({
//           where: {
//             userAddress_contractAddress: {
//               userAddress: tx.to.toLowerCase(),
//               contractAddress: activeDeployment.address
//             }
//           },
//           data: { balance: newRecipientBalance }
//         });
//       } else {
//         // Create new balance record for recipient
//         await prisma.layer2Balance.create({
//           data: {
//             userAddress: tx.to.toLowerCase(),
//             contractAddress: activeDeployment.address,
//             balance: tx.value
//           }
//         });
//       }
//     }

//     return res.json({ success: true, message: 'Balances updated successfully' });
//   } catch (error) {
//     console.error('Error updating balances:', error);
//     return res.status(500).json({ error: 'Failed to update balances' });
//   }
// });

// // Challenge a batch
// app.post('/api/batches/challenge', async (req, res) => {
//   try {
//     const { batchId, challengerAddress } = req.body;
//     if (!batchId || !challengerAddress) {
//       return res.status(400).json({ error: 'Batch ID and challenger address are required' });
//     }

//     // Find the batch in the database
//     const batch = await prisma.batch.findUnique({
//       where: { id: batchId },
//       include: { transactions: true }
//     });

//     if (!batch) {
//       return res.status(404).json({ error: 'Batch not found' });
//     }

//     if (!batch.verified || batch.finalized || batch.rejected) {
//       return res.status(400).json({ error: 'Batch cannot be challenged in its current state' });
//     }

//     // Create a challenge record
//     const challenge = await prisma.batchChallenge.create({
//       data: {
//         batchId: batch.id,
//         challengerAddress: challengerAddress.toLowerCase(),
//         status: 'pending',
//         timestamp: new Date()
//       }
//     });

//     res.json({
//       message: 'Challenge submitted successfully',
//       challenge
//     });
//   } catch (error) {
//     console.error('Error submitting challenge:', error);
//     res.status(500).json({ error: 'Failed to submit challenge' });
//   }
// });

// // Verify a challenge
// app.post('/api/batches/verify-challenge', adminAuth, async (req, res) => {
//   try {
//     const { batchId, isValid, adminAddress } = req.body;
//     if (!batchId || typeof isValid !== 'boolean') {
//       return res.status(400).json({ error: 'Batch ID and validity status are required' });
//     }

//     // Find the challenge
//     const challenge = await prisma.batchChallenge.findFirst({
//       where: {
//         batchId,
//         status: 'pending'
//       },
//       include: {
//         batch: true
//       }
//     });

//     if (!challenge) {
//       return res.status(404).json({ error: 'Challenge not found' });
//     }

//     const PENALTY_AMOUNT = '10000000000000000000'; // 10 ETH penalty

//     if (isValid) {
//       // Challenge is valid - penalize batch creator
//       // Update batch creator's balances
//       const batchCreator = await prisma.user.findFirst({
//         where: { address: challenge.batch.creatorAddress }
//       });

//       if (batchCreator) {
//         // Deduct from L2 balance first
//         const l2Balance = BigInt(batchCreator.l2Balance || '0');
//         const penalty = BigInt(PENALTY_AMOUNT);

//         if (l2Balance >= penalty) {
//           await prisma.user.update({
//             where: { id: batchCreator.id },
//             data: {
//               l2Balance: (l2Balance - penalty).toString()
//             }
//           });
//         } else {
//           // If L2 balance is insufficient, deduct from L1 balance
//           const l1Balance = BigInt(batchCreator.l1Balance || '0');
//           await prisma.user.update({
//             where: { id: batchCreator.id },
//             data: {
//               l2Balance: '0',
//               l1Balance: (l1Balance - (penalty - l2Balance)).toString()
//             }
//           });
//         }
//       }

//       // Update batch status
//       await prisma.batch.update({
//         where: { id: batchId },
//         data: {
//           rejected: true,
//           verified: false,
//           finalized: false
//         }
//       });
//     } else {
//       // Challenge is invalid - penalize challenger
//       const challenger = await prisma.user.findFirst({
//         where: { address: challenge.challengerAddress }
//       });

//       if (challenger) {
//         const l2Balance = BigInt(challenger.l2Balance || '0');
//         const penalty = BigInt(PENALTY_AMOUNT);

//         if (l2Balance >= penalty) {
//           await prisma.user.update({
//             where: { id: challenger.id },
//             data: {
//               l2Balance: (l2Balance - penalty).toString()
//             }
//           });
//         } else {
//           const l1Balance = BigInt(challenger.l1Balance || '0');
//           await prisma.user.update({
//             where: { id: challenger.id },
//             data: {
//               l2Balance: '0',
//               l1Balance: (l1Balance - (penalty - l2Balance)).toString()
//             }
//           });
//         }
//       }
//     }

//     // Update challenge status
//     await prisma.batchChallenge.update({
//       where: { id: challenge.id },
//       data: {
//         status: isValid ? 'accepted' : 'rejected',
//         resolvedBy: adminAddress.toLowerCase(),
//         resolvedAt: new Date()
//       }
//     });

//     res.json({
//       message: isValid ? 'Challenge verified as valid' : 'Challenge rejected',
//       challenge
//     });
//   } catch (error) {
//     console.error('Error verifying challenge:', error);
//     res.status(500).json({ error: 'Failed to verify challenge' });
//   }
// });

// // Rollup API endpoints
// app.post('/api/rollup/batch/create', async (req, res) => {
//   try {
//     const result = await rollup.createBatch();
//     res.json(result);
//   } catch (error) {
//     console.error('Error creating batch:', error);
//     res.status(500).json({ error: 'Failed to create batch' });
//   }
// });

// app.post('/api/rollup/batch/verify', async (req, res) => {
//   try {
//     const { batchId } = req.body;
//     if (!batchId) {
//       return res.status(400).json({ error: 'Batch ID is required' });
//     }

//     const result = await rollup.verifyBatch(batchId);
//     res.json(result);
//   } catch (error) {
//     console.error('Error verifying batch:', error);
//     res.status(500).json({ error: 'Failed to verify batch' });
//   }
// });

// app.post('/api/rollup/batch/finalize', async (req, res) => {
//   try {
//     const { batchId } = req.body;
//     if (!batchId) {
//       return res.status(400).json({ error: 'Batch ID is required' });
//     }

//     const result = await rollup.finalizeBatch(batchId);
//     res.json(result);
//   } catch (error) {
//     console.error('Error finalizing batch:', error);
//     res.status(500).json({ error: 'Failed to finalize batch' });
//   }
// });

// app.post('/api/rollup/fraud-proof', async (req, res) => {
//   try {
//     const { batchId, challengerAddress, fraudProof } = req.body;
//     if (!batchId || !challengerAddress || !fraudProof) {
//       return res.status(400).json({ error: 'Batch ID, challenger address, and fraud proof are required' });
//     }

//     const result = await rollup.submitFraudProof(batchId, challengerAddress, fraudProof);
//     res.json(result);
//   } catch (error) {
//     console.error('Error submitting fraud proof:', error);
//     res.status(500).json({ error: 'Failed to submit fraud proof' });
//   }
// });

// // Admin API endpoints
// app.get('/api/admin/operators', async (req, res) => {
//   try {
//     // For now, return mock data
//     const operators = [
//       { id: '1', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', isActive: true },
//       { id: '2', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', isActive: true }
//     ];
//     res.json(operators);
//   } catch (error) {
//     console.error('Error fetching operators:', error);
//     res.status(500).json({ error: 'Failed to fetch operators' });
//   }
// });

// app.post('/api/admin/operators', async (req, res) => {
//   try {
//     const { address } = req.body;
//     if (!address) {
//       return res.status(400).json({ error: 'Address is required' });
//     }

//     // In a real implementation, you would add the operator to the database
//     // For now, just return success
//     res.json({ success: true, message: 'Operator added successfully' });
//   } catch (error) {
//     console.error('Error adding operator:', error);
//     res.status(500).json({ error: 'Failed to add operator' });
//   }
// });

// app.delete('/api/admin/operators/:address', async (req, res) => {
//   try {
//     const { address } = req.params;
//     if (!address) {
//       return res.status(400).json({ error: 'Address is required' });
//     }

//     // In a real implementation, you would remove the operator from the database
//     // For now, just return success
//     res.json({ success: true, message: 'Operator removed successfully' });
//   } catch (error) {
//     console.error('Error removing operator:', error);
//     res.status(500).json({ error: 'Failed to remove operator' });
//   }
// });

// app.get('/api/admin/contracts', async (req, res) => {
//   try {
//     // For now, return mock data
//     const contracts = [
//       { id: '1', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'localhost', isActive: true }
//     ];
//     res.json(contracts);
//   } catch (error) {
//     console.error('Error fetching contracts:', error);
//     res.status(500).json({ error: 'Failed to fetch contracts' });
//   }
// });

// app.post('/api/admin/contracts', async (req, res) => {
//   try {
//     const { address, network } = req.body;
//     if (!address || !network) {
//       return res.status(400).json({ error: 'Address and network are required' });
//     }

//     // In a real implementation, you would add the contract to the database
//     // For now, just return success
//     res.json({ success: true, message: 'Contract added successfully' });
//   } catch (error) {
//     console.error('Error adding contract:', error);
//     res.status(500).json({ error: 'Failed to add contract' });
//   }
// });

// // Report a batch
// app.post('/api/batches/report', async (req, res) => {
//   try {
//     const { batchId, reason } = req.body;
//     if (!batchId || !reason) {
//       return res.status(400).json({ error: 'Batch ID and reason are required' });
//     }

//     // Create a report record in the database
//     const report = await prisma.batchReport.create({
//       data: {
//         batchId,
//         reason,
//         createdAt: new Date()
//       }
//     });

//     res.json({
//       message: 'Batch reported successfully',
//       report
//     });
//   } catch (error) {
//     console.error('Error reporting batch:', error);
//     res.status(500).json({ error: 'Failed to report batch' });
//   }
// });

// // Submit fraud proof
// app.post('/api/batches/fraud-proof', async (req, res) => {
//   try {
//     const { batchId, fraudProof, challengerAddress } = req.body;
//     if (!batchId || !fraudProof || !challengerAddress) {
//       return res.status(400).json({ error: 'Batch ID, fraud proof, and challenger address are required' });
//     }

//     // Submit fraud proof to the blockchain if connected
//     if (isConnected && contract) {
//       try {
//         const tx = await contract.reportFraud(batchId, fraudProof, challengerAddress);
//         const receipt = await tx.wait();
//         console.log(`Fraud proof submitted. Transaction hash: ${receipt.transactionHash}`);
//       } catch (error) {
//         console.error('Error submitting fraud proof to blockchain:', error);
//         return res.status(500).json({ error: 'Failed to submit fraud proof to blockchain' });
//       }
//     }

//     // Save fraud proof in the database
//     const fraudRecord = await prisma.fraudProof.create({
//       data: {
//         batchId,
//         fraudProof,
//         challengerAddress,
//         createdAt: new Date()
//       }
//     });

//     res.json({
//       message: 'Fraud proof submitted successfully',
//       fraudRecord
//     });
//   } catch (error) {
//     console.error('Error submitting fraud proof:', error);
//     res.status(500).json({ error: 'Failed to submit fraud proof' });
//   }
// });
// // Auto-finalize batches after challenge period — runs every 60 seconds
// setInterval(async () => {
//   if (!contract) return;
//   try {
//     const now = new Date();
//     const eligible = await prisma.batch.findMany({
//       where: {
//         status: 'challenge_period',
//         challengeEndsAt: { lt: now },
//         onChainId: { not: null }
//       }
//     });
//     for (const batch of eligible) {
//       try {
//         const tx = await contract.finalizeBatch(
//           ethers.BigNumber.from(batch.onChainId)
//         );
//         await tx.wait();
//         console.log(`✅ Auto-finalized batch onChainId=${batch.onChainId}`);
//         broadcast('batch_finalized', { onChainId: batch.onChainId });
//       } catch (err) {
//         console.error(`❌ Auto-finalize failed for ${batch.onChainId}:`, err.message);
//       }
//     }
//   } catch (err) {
//     console.error('Auto-finalize cron error:', err.message);
//   }
// }, 60_000);
// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
//   if (isConnected) {
//     console.log(`Connected to blockchain via ${NETWORK === 'sepolia' ? 'Alchemy (Sepolia)' : 'local Hardhat node'}`);
//   } else {
//     console.log(`Running with mock data (blockchain connection not established)`);
//     if (NETWORK === 'sepolia') {
//       console.log(`Check your .env file to ensure ALCHEMY_API_KEY and PRIVATE_KEY are set correctly`);
//     } else {
//       console.log(`Check your local Hardhat node is running`);
//     }
//   }
// });
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startSequencer } from './sequencer.js';
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
// FIX: All values normalized to wei before DB insert.
// Old code stored ETH strings ("2", "4") mixed with wei — caused formatEther crashes.
function normalizeToWei(value) {
  if (!value) return '0';
  const v = value.toString().trim();
  if (v === '0' || v === '') return '0';
  if (!v.includes('.') && v.length >= 15) return v; // already wei
  try { return ethers.utils.parseEther(v).toString(); }
  catch { return v; }
}

// FIX: Timestamps were stored as Unix ms integers but frontend multiplied by 1000 thinking seconds.
// Always output Unix seconds from API.
function toUnixSeconds(ts) {
  if (!ts) return Math.floor(Date.now() / 1000);
  if (typeof ts === 'number') return ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return Math.floor(new Date(ts).getTime() / 1000);
}

// ─── Prisma ───────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean)
}));
app.use(express.json({ limit: '1mb' }));

// ─── WebSocket ────────────────────────────────────────────────────────────────
// FIX: Replaced 6 independent polling loops (50+ req/min) with single WebSocket.
const wss = new WebSocketServer({ port: WS_PORT });
const wsClients = new Set();
wss.on('connection', ws => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
  ws.send(JSON.stringify({ event: 'connected', ts: Date.now() }));
});
function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wsClients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}
console.log(`🔌 WebSocket server on port ${WS_PORT}`);

// ─── Contract ABI ─────────────────────────────────────────────────────────────
// FIX: Old ABI had wrong submitBatch signature (array instead of two params)
// and wrong reportFraud signature (4 params with tuple instead of 3).
// Both caused every contract call to revert silently.
const CONTRACT_ABI = [
  "function depositFunds() payable",
  "function withdrawFunds(uint256 _amount)",
  // FIX: submitBatch now takes (bytes32 root, uint256 txCount) not (bytes32[])
  "function submitBatch(bytes32 _transactionsRoot, uint256 _txCount)",
  "function finalizeBatch(uint256 _batchId)",
  // FIX: reportFraud now exactly 3 params matching contract — old had tuple as 4th param
  "function reportFraud(uint256 batchId, bytes32 fraudProofHash, bytes32[] calldata merkleProof)",
  "function balances(address) view returns (uint256)",
  "function admin() view returns (address)",
  "function isOperator(address) view returns (bool)",
  "function operatorBonds(address) view returns (uint256)",
  "function nextBatchId() view returns (uint256)",
  "function challengePeriod() view returns (uint256)",
  "function batches(uint256) view returns (uint256 batchId, bytes32 transactionsRoot, uint256 submittedAt, address submitter, bool finalized, bool fraudulent, uint256 txCount)",
  "function addOperator(address operator)",
  "function removeOperator(address operator)",
  "function depositOperatorBond() payable",
  "function setChallengePeriod(uint256 _seconds)",
  // Events — backend listens to these to keep DB in sync with chain
  "event BatchSubmitted(uint256 indexed batchId, bytes32 transactionsRoot, address submitter, uint256 txCount)",
  "event BatchFinalized(uint256 indexed batchId)",
  "event BatchRejected(uint256 indexed batchId, address challenger)",
  "event FraudReported(uint256 indexed batchId, bytes32 fraudProofHash, address challenger)",
  "event FundsDeposited(address indexed user, uint256 amount)",
  "event FundsWithdrawn(address indexed user, uint256 amount)",
  "event OperatorSlashed(address indexed operator, uint256 amount, address challenger)",
  "event OperatorAdded(address indexed operator)",
  "event OperatorRemoved(address indexed operator)",
  "event AdminChanged(address indexed previousAdmin, address indexed newAdmin)",
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
    if (!privateKey) throw new Error('PRIVATE_KEY not set in .env');

    wallet   = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === '0x') throw new Error(`No contract deployed at ${CONTRACT_ADDRESS}`);

    console.log(`✅ Blockchain connected: ${NETWORK}`);
    console.log(`   Contract : ${CONTRACT_ADDRESS}`);
    console.log(`   Operator : ${wallet.address}`);

    // FIX: Old code never listened to contract events — DB was always out of sync.
    setupContractEventListeners();
    return true;
  } catch (err) {
    console.warn(`⚠️  Blockchain not connected: ${err.message}`);
    console.warn('    Running in DB-only mode.');
    return false;
  }
}

// ─── Contract Event Listeners ─────────────────────────────────────────────────
// FIX: These keep the DB authoritative. Previously the DB had no idea what
// the contract was doing — status never updated unless admin manually clicked.
function setupContractEventListeners() {
  if (!contract) return;

  contract.on('BatchFinalized', async (batchId) => {
    try {
      const onChainId = batchId.toString();
      await prisma.batch.updateMany({
        where: { onChainId },
        data: { status: 'finalized' }
      });
      await prisma.pendingTransaction.updateMany({
        where: { batch: { onChainId } },
        data: { status: 'finalized' }
      });
      broadcast('batch_finalized', { onChainId });
      console.log(`📡 BatchFinalized onChainId=${onChainId}`);
    } catch (err) {
      console.error('BatchFinalized handler error:', err.message);
    }
  });

  contract.on('BatchRejected', async (batchId) => {
    try {
      const onChainId = batchId.toString();
      await prisma.batch.updateMany({
        where: { onChainId },
        data: { status: 'rejected' }
      });
      await prisma.pendingTransaction.updateMany({
        where: { batch: { onChainId } },
        data: { status: 'rejected' }
      });
      broadcast('batch_rejected', { onChainId });
      console.log(`📡 BatchRejected onChainId=${onChainId}`);
    } catch (err) {
      console.error('BatchRejected handler error:', err.message);
    }
  });

  contract.on('FundsDeposited', async (user, amount) => {
  try {
    const onChainBal = await contract.balances(user);

    await prisma.layer2Balance.upsert({
      where: {
        userAddress_contractAddress: {
          userAddress: user.toLowerCase(),
          contractAddress: CONTRACT_ADDRESS.toLowerCase()
        }
      },
      create: {
        userAddress: user.toLowerCase(),
        contractAddress: CONTRACT_ADDRESS.toLowerCase(),
        balanceWei: onChainBal.toString()
      },
      update: {
        balanceWei: onChainBal.toString() // ✅ FIX
      }
    });

    broadcast('balance_updated', { address: user.toLowerCase() });

  } catch (err) {
    console.error('FundsDeposited handler error:', err.message);
  }
});

  contract.on('FundsWithdrawn', async (user) => {
    try {
      const onChainBal = await contract.balances(user);
      await prisma.layer2Balance.upsert({
        where: {
          userAddress_contractAddress: {
            userAddress: user.toLowerCase(),
            contractAddress: CONTRACT_ADDRESS.toLowerCase()
          }
        },
        create: {
          userAddress: user.toLowerCase(),
          contractAddress: CONTRACT_ADDRESS.toLowerCase(),
          balanceWei: onChainBal.toString()
        },
        update: { balanceWei: onChainBal.toString() }
      });
      broadcast('balance_updated', { address: user.toLowerCase() });
    } catch (err) {
      console.error('FundsWithdrawn handler error:', err.message);
    }
  });

  console.log('📡 Contract event listeners active');
}

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
// FIX: Old middleware had hardcoded fallback to Hardhat account #0 (publicly known).
// Anyone could claim admin when contract was unreachable. Now returns 503 instead.
async function requireAdmin(req, res, next) {
  try {
    const userAddress = req.headers['x-admin-address'];
    if (!userAddress) {
      return res.status(401).json({ error: 'x-admin-address header required' });
    }
    if (!contract) {
      return res.status(503).json({ error: 'Contract not connected — cannot verify admin' });
    }
    const [adminAddress, isOp] = await Promise.all([
      contract.admin(),
      contract.isOperator(userAddress)
    ]);
    const isAdminCaller = adminAddress.toLowerCase() === userAddress.toLowerCase();
    if (!isAdminCaller && !isOp) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    req.callerAddress = userAddress;
    next();
  } catch (err) {
    console.error('Admin auth error:', err.message);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  blockchain: !!contract,
  network: NETWORK,
  contractAddress: CONTRACT_ADDRESS,
  ts: Date.now()
}));

// ─── Admin Check ──────────────────────────────────────────────────────────────
// FIX: Removed hardcoded admin backdoor fallbacks entirely.
app.get('/api/admin/check', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });

    if (!contract) {
      return res.json({ success: true, isAdmin: false, isOperator: false });
    }

    const [adminAddress, isOp] = await Promise.all([
      contract.admin(),
      contract.isOperator(address)
    ]);

    res.json({
      success: true,
      isAdmin: adminAddress.toLowerCase() === address.toLowerCase(),
      isOperator: isOp,
    });
  } catch (err) {
    console.error('Admin check error:', err.message);
    res.status(500).json({ error: 'Admin check failed' });
  }
});

// ─── GET /api/batches ─────────────────────────────────────────────────────────
app.get('/api/batches', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { transactions: true }
    });
    res.json(batches);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// ─── GET /api/batches/user/:address ───────────────────────────────────────────
app.get('/api/batches/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const batches = await prisma.batch.findMany({
      where: {
        transactions: {
          some: {
            OR: [
              { fromAddress: address.toLowerCase() },
              { toAddress:   address.toLowerCase() }
            ]
          }
        }
      },
      include: { transactions: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(batches);
  } catch (err) {
    console.error('Error fetching user batches:', err);
    res.status(500).json({ error: 'Failed to fetch user batches' });
  }
});

// ─── GET /api/batches/:id ─────────────────────────────────────────────────────
app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id },
      include: { transactions: true }
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    console.error('Error fetching batch:', err);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// ─── POST /api/transactions ───────────────────────────────────────────────────
// This is the main entry point for L2 transfers.
// FIX 1: Normalizes all values to wei before DB insert.
// FIX 2: Builds correct Merkle root from normalized wei values.
// FIX 3: Creates batch with new schema (no random batchId).
// FIX 4: Captures REAL on-chain batchId from BatchSubmitted event.
app.post('/api/transactions', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array required' });
    }

    // ✅ Normalize
    const normalized = transactions.map(tx => ({
      fromAddress: (tx.from || tx.fromAddress || '').toLowerCase(),
      toAddress:   (tx.to   || tx.toAddress   || '').toLowerCase(),
      valueWei:    normalizeToWei(tx.amount || tx.value || tx.valueWei || '0'),
    }));

    // ✅ Validate addresses
    for (const tx of normalized) {
      if (!ethers.utils.isAddress(tx.fromAddress)) {
        return res.status(400).json({ error: `Invalid from address: ${tx.fromAddress}` });
      }
      if (!ethers.utils.isAddress(tx.toAddress)) {
        return res.status(400).json({ error: `Invalid to address: ${tx.toAddress}` });
      }
    }

    // 🔥 STEP 1: CHECK BALANCES
    for (const tx of normalized) {
      const balance = await prisma.layer2Balance.findUnique({
        where: {
          userAddress_contractAddress: {
            userAddress: tx.fromAddress,
            contractAddress: CONTRACT_ADDRESS.toLowerCase()
          }
        }
      });

      const currentBalance = balance ? BigInt(balance.balanceWei) : 0n;
      const txValue = BigInt(tx.valueWei);

      if (currentBalance < txValue) {
        return res.status(400).json({
          error: `Insufficient L2 balance for ${tx.fromAddress}`
        });
      }
    }

    // 🔥 STEP 2: UPDATE BALANCES (OPTIMISTIC EXECUTION)
    // 🔥 STEP 2: UPDATE BALANCES (SAFE BIGINT VERSION)
for (const tx of normalized) {
  const txValue = BigInt(tx.valueWei);

  const existingFrom = await prisma.layer2Balance.findUnique({
    where: {
      userAddress_contractAddress: {
        userAddress: tx.fromAddress,
        contractAddress: CONTRACT_ADDRESS.toLowerCase()
      }
    }
  });

  const existingTo = await prisma.layer2Balance.findUnique({
    where: {
      userAddress_contractAddress: {
        userAddress: tx.toAddress,
        contractAddress: CONTRACT_ADDRESS.toLowerCase()
      }
    }
  });

  const fromBalance = existingFrom ? BigInt(existingFrom.balanceWei) : 0n;
  const toBalance   = existingTo   ? BigInt(existingTo.balanceWei)   : 0n;

  const newFromBalance = fromBalance - txValue;
  const newToBalance   = toBalance + txValue;

  // 🧠 Safety check (should never go negative)
  if (newFromBalance < 0n) {
    throw new Error(`Negative balance detected for ${tx.fromAddress}`);
  }

  // ➖ update sender
  await prisma.layer2Balance.upsert({
    where: {
      userAddress_contractAddress: {
        userAddress: tx.fromAddress,
        contractAddress: CONTRACT_ADDRESS.toLowerCase()
      }
    },
    update: {
      balanceWei: newFromBalance.toString()
    },
    create: {
      userAddress: tx.fromAddress,
      contractAddress: CONTRACT_ADDRESS.toLowerCase(),
      balanceWei: "0"
    }
  });

  // ➕ update receiver
  await prisma.layer2Balance.upsert({
    where: {
      userAddress_contractAddress: {
        userAddress: tx.toAddress,
        contractAddress: CONTRACT_ADDRESS.toLowerCase()
      }
    },
    update: {
      balanceWei: newToBalance.toString()
    },
    create: {
      userAddress: tx.toAddress,
      contractAddress: CONTRACT_ADDRESS.toLowerCase(),
      balanceWei: newToBalance.toString()
    }
  });
}

    // ✅ STORE TRANSACTIONS
    await prisma.pendingTransaction.createMany({
      data: normalized.map(tx => ({
        fromAddress: tx.fromAddress,
        toAddress:   tx.toAddress,
        valueWei:    tx.valueWei,
        status:      'pending'
      }))
    });

    console.log(`📥 Stored ${normalized.length} transactions in pool`);

    broadcast('tx_added', { count: normalized.length });

    return res.status(201).json({
      success: true,
      status: "pending",
      message: "Transaction submitted to L2",
      count: normalized.length
    });

  } catch (err) {
    console.error('Error storing transactions:', err);
    res.status(500).json({
      error: 'Failed to store transactions',
      details: err.message
    });
  }
});

// ─── POST /api/batches/reject ─────────────────────────────────────────────────
app.post('/api/batches/reject', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const updatedBatch = await prisma.$transaction(async (tx) => {
      const updated = await tx.batch.update({
        where: { id },
        data: { status: 'rejected' }
      });
      await tx.pendingTransaction.updateMany({
        where: { batchId: id },
        data: { status: 'rejected' }
      });
      return updated;
    });

    broadcast('batch_rejected', { id });
    res.json({ message: 'Batch rejected successfully', batch: updatedBatch });
  } catch (err) {
    console.error('Error rejecting batch:', err);
    res.status(500).json({ error: 'Failed to reject batch' });
  }
});

// ─── POST /api/batches/challenge ──────────────────────────────────────────────
app.post('/api/batches/challenge', async (req, res) => {
  try {
    const { batchId, challengerAddress, fraudProofHash, merkleProof } = req.body;
    if (!batchId || !challengerAddress || !fraudProofHash || !merkleProof) {
      return res.status(400).json({ error: 'batchId, challengerAddress, fraudProofHash, merkleProof required' });
    }

    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (batch.status !== 'challenge_period') {
      return res.status(400).json({ error: `Batch status is ${batch.status} — not in challenge period` });
    }

    // Submit fraud proof to contract
    if (contract && batch.onChainId) {
      try {
        const proofArray = Array.isArray(merkleProof) ? merkleProof : JSON.parse(merkleProof);
        const tx = await contract.reportFraud(
          ethers.BigNumber.from(batch.onChainId),
          fraudProofHash,
          proofArray
        );
        const receipt = await tx.wait();

        const challenge = await prisma.challenge.create({
          data: {
            batchId,
            challengerAddress: challengerAddress.toLowerCase(),
            fraudProofHash,
            merkleProof: JSON.stringify(proofArray),
            status: 'valid',
            onChainTxHash: receipt.transactionHash,
          }
        });

        broadcast('challenge_submitted', { batchId, onChainId: batch.onChainId });
        return res.json({ message: 'Fraud proof accepted — batch rejected', challenge });
      } catch (err) {
        // Contract rejected the proof
        await prisma.challenge.create({
          data: {
            batchId,
            challengerAddress: challengerAddress.toLowerCase(),
            fraudProofHash,
            merkleProof: JSON.stringify(merkleProof),
            status: 'invalid',
          }
        });
        return res.status(400).json({ error: `Fraud proof rejected by contract: ${err.message}` });
      }
    }

    // DB-only mode
    const challenge = await prisma.challenge.create({
      data: {
        batchId,
        challengerAddress: challengerAddress.toLowerCase(),
        fraudProofHash,
        merkleProof: JSON.stringify(merkleProof),
        status: 'pending',
      }
    });

    broadcast('challenge_submitted', { batchId });
    res.json({ message: 'Challenge submitted', challenge });
  } catch (err) {
    console.error('Error submitting challenge:', err);
    res.status(500).json({ error: 'Failed to submit challenge' });
  }
});

// ─── GET /api/transactions/pending ───────────────────────────────────────────
app.get('/api/transactions/pending', async (req, res) => {
  try {
    const pending = await prisma.pendingTransaction.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pending.map(tx => ({
      ...tx,
      createdAt: toUnixSeconds(tx.createdAt)
    })));
  } catch (err) {
    console.error('Error fetching pending transactions:', err);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// ─── GET /api/transactions/live ───────────────────────────────────────────────
app.get('/api/transactions/live', async (req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { batch: true }
    });
    res.json(txs.map(tx => ({
      hash:      tx.id,
      from:      tx.fromAddress,
      to:        tx.toAddress,
      value:     tx.valueWei,
      status:    tx.status,
      createdAt: toUnixSeconds(tx.createdAt),
      batchId:   tx.batch?.onChainId || null,
    })));
  } catch (err) {
    console.error('Error fetching live transactions:', err);
    res.status(500).json({ error: 'Failed to fetch live transactions' });
  }
});

// ─── GET /api/transactions/network ───────────────────────────────────────────
app.get('/api/transactions/network', async (req, res) => {
  try {
    const txs = await prisma.pendingTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { batch: true }
    });
    res.json(txs.map(tx => ({
      hash:      tx.id,
      from:      tx.fromAddress,
      to:        tx.toAddress,
      value:     tx.valueWei,
      status:    tx.batch?.status || tx.status,
      createdAt: toUnixSeconds(tx.createdAt),
      batchId:   tx.batch?.onChainId || null,
      type:      'transfer',
      isInBatch: !!tx.batch,
    })));
  } catch (err) {
    console.error('Error fetching network transactions:', err);
    res.status(500).json({ error: 'Failed to fetch network transactions' });
  }
});

// ─── GET /api/transactions/user/:address ─────────────────────────────────────
app.get('/api/transactions/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!address) return res.status(400).json({ error: 'address required' });

    const txs = await prisma.pendingTransaction.findMany({
      where: {
        OR: [
          { fromAddress: address.toLowerCase() },
          { toAddress:   address.toLowerCase() }
        ]
      },
      include: { batch: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      transactions: txs.map(tx => ({
        hash:      tx.id,
        from:      tx.fromAddress,
        to:        tx.toAddress,
        value:     tx.valueWei,
        status:    tx.batch?.status || tx.status,
        createdAt: toUnixSeconds(tx.createdAt),
        batchId:   tx.batch?.onChainId || null,
        type:      'transfer',
        isInBatch: !!tx.batch,
      }))
      // ❌ REMOVE balance completely
    });

  } catch (err) {
    console.error('Error fetching user transactions:', err);
    res.status(500).json({ error: 'Failed to fetch user transactions' });
  }
});

// ─── GET /api/balance/:address ────────────────────────────────────────────────
app.get('/api/balance/:address', async (req, res) => {
  const { address } = req.params;

  try {
    let layer1BalanceWei = '0';
    let layer2BalanceWei = '0';

    // ✅ L1 → blockchain
    if (provider) {
      try {
        const ethBal = await provider.getBalance(address);
        layer1BalanceWei = ethBal.toString();
      } catch (err) {
        console.error('L1 fetch failed:', err.message);
      }
    }

    // ✅ L2 → ONLY DB (single source of truth)
    const dbBal = await prisma.layer2Balance.findUnique({
  where: {
    userAddress_contractAddress: {
      userAddress: address.toLowerCase(),
      contractAddress: CONTRACT_ADDRESS.toLowerCase()
    }
  }
});

    if (dbBal) {
      layer2BalanceWei = dbBal.balanceWei;
    }

    // ✅ Cache (optional)
    await prisma.balance.upsert({
      where: { address: address.toLowerCase() },
      create: {
        address: address.toLowerCase(),
        layer1BalanceWei,
        layer2BalanceWei
      },
      update: {
        layer1BalanceWei,
        layer2BalanceWei,
        lastSyncedAt: new Date()
      }
    }).catch(() => {});

    return res.json({
      layer1Balance: ethers.utils.formatEther(layer1BalanceWei),
      layer2Balance: ethers.utils.formatEther(layer2BalanceWei),
      layer1BalanceWei,
      layer2BalanceWei,
    });

  } catch (err) {
    console.error('Error fetching balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ─── POST /api/balance/update ─────────────────────────────────────────────────
app.post('/api/balance/update', async (req, res) => {
  try {
    const { userAddress, contractAddress, balance } = req.body;
    if (!userAddress || !contractAddress || !balance) {
      return res.status(400).json({ error: 'userAddress, contractAddress, balance required' });
    }
    const updated = await prisma.layer2Balance.upsert({
      where: { userAddress_contractAddress: { userAddress: userAddress.toLowerCase(), contractAddress: contractAddress.toLowerCase() } },
      create: { userAddress: userAddress.toLowerCase(), contractAddress: contractAddress.toLowerCase(), balanceWei: normalizeToWei(balance) },
      update: { balanceWei: normalizeToWei(balance) }
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating balance:', err);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// ─── GET /api/gas-prices ──────────────────────────────────────────────────────
app.get('/api/gas-prices', async (req, res) => {
  try {
    if (!provider) {
      return res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' });
    }
    const feeData = await provider.getFeeData();
    const gwei = Math.round(Number(ethers.utils.formatUnits(feeData.gasPrice || 0, 'gwei')));
    res.json({
      slow:     (gwei * 0.8).toFixed(0),
      standard: gwei.toFixed(0),
      fast:     (gwei * 1.2).toFixed(0),
      rapid:    (gwei * 1.5).toFixed(0),
    });
  } catch (err) {
    res.json({ slow: '20', standard: '25', fast: '30', rapid: '35' });
  }
});

// ─── GET /api/operators ───────────────────────────────────────────────────────
app.get('/api/operators', async (req, res) => {
  try {
    const operators = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(operators);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

// ─── GET /api/admin/operators ─────────────────────────────────────────────────
app.get('/api/admin/operators', async (req, res) => {
  try {
    const operators = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(operators);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

// ─── POST /api/admin/operators ────────────────────────────────────────────────
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
  } catch (err) {
    console.error('Error adding operator:', err);
    res.status(500).json({ error: 'Failed to add operator' });
  }
});

// ─── DELETE /api/admin/operators/:address ────────────────────────────────────
app.delete('/api/admin/operators/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (contract) {
      const tx = await contract.removeOperator(address);
      await tx.wait();
    }
    await prisma.operator.update({
      where: { address: address.toLowerCase() },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing operator:', err);
    res.status(500).json({ error: 'Failed to remove operator' });
  }
});

// ─── GET /api/admin/contracts ─────────────────────────────────────────────────
app.get('/api/admin/contracts', async (req, res) => {
  try {
    const deployments = await prisma.contractDeployment.findMany();
    res.json(deployments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// ─── POST /api/rollup/fraud-proof ─────────────────────────────────────────────
app.post('/api/rollup/fraud-proof', async (req, res) => {
  try {
    const { batchId, fraudProof, merkleProof } = req.body;
    if (!batchId || !fraudProof || !merkleProof) {
      return res.status(400).json({ error: 'batchId, fraudProof, merkleProof required' });
    }
    // Delegate to challenge endpoint
    req.body = {
      batchId,
      challengerAddress: req.body.challengerAddress || '0x0000000000000000000000000000000000000000',
      fraudProofHash: fraudProof,
      merkleProof,
    };
    // Simple validation response for backward compat
    res.json({ isValid: true, message: 'Use /api/batches/challenge for full fraud proof submission' });
  } catch (err) {
    res.status(500).json({ isValid: false, message: err.message });
  }
});

// ─── Auto-Finalize Cron ───────────────────────────────────────────────────────
// FIX: Batches were never finalized — old contract required manual admin clicking.
// New contract is permissionless after challenge period — this cron does it automatically.
setInterval(async () => {
  if (!contract) return;
  try {
    const now = new Date();
    const eligible = await prisma.batch.findMany({
      where: {
        status: 'challenge_period',
        challengeEndsAt: { lt: now },
        onChainId: { not: null }
      }
    });
    for (const batch of eligible) {
      try {
        console.log(`⏰ Auto-finalizing batch onChainId=${batch.onChainId}`);
        const tx = await contract.finalizeBatch(ethers.BigNumber.from(batch.onChainId));
        await tx.wait();
        // DB update handled by BatchFinalized event listener
      } catch (err) {
        console.error(`❌ Auto-finalize failed for ${batch.onChainId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Auto-finalize cron error:', err.message);
  }
}, 60_000);

// ─── Start ────────────────────────────────────────────────────────────────────
initBlockchain().then(() => {
  startSequencer({ contract, wallet, broadcast });
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Network  : ${NETWORK}`);
    console.log(`   Contract : ${CONTRACT_ADDRESS}`);
  });
});