/**
 * ethers.ts – Frontend blockchain lib (ethers v6)
 *
 * Key changes:
 * - Uses ethers v6 API (BrowserProvider, parseEther, solidityPackedKeccak256)
 * - L2 transfers never call on-chain — signed off-chain and sent to backend
 * - L1 balance read from chain only
 * - No polling — components use WebSocket via useRealtimeUpdates
 */

import { BrowserProvider, Contract, formatEther, parseEther, ethers } from 'ethers';
import { toast }              from '@/components/ui/use-toast';
import { CONTRACT_ADDRESS }   from '@/config/contract';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

// ─── ABI ──────────────────────────────────────────────────────────────────────
const CONTRACT_ABI = [
  'function depositFunds() payable',
  'function withdrawFunds(uint256 _amount)',
  'function withdrawWithProof(bytes32 _withdrawalRoot, uint256 _amount, uint256 _nonce, bytes32[] calldata _proof)',
  'function submitBatch(bytes32 _txRoot, bytes32 _stateRoot, uint256 _txCount) returns (uint256)',
  'function finalizeBatch(uint256 _batchId)',
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
  'function batches(uint256) view returns (uint256 batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, uint256 submittedAt, address submitter, bool finalized, bool fraudulent, uint256 txCount)',
  'event BatchSubmitted(uint256 indexed batchId, bytes32 txRoot, bytes32 stateRoot, bytes32 prevStateRoot, address submitter, uint256 txCount)',
  'event BatchFinalized(uint256 indexed batchId, bytes32 stateRoot)',
  'event FraudProofAccepted(uint256 indexed batchId, address challenger, uint256 reward)',
  'event FundsDeposited(address indexed user, uint256 amount)',
  'event FundsWithdrawn(address indexed user, uint256 amount)',
];

// ─── Network ──────────────────────────────────────────────────────────────────
export const NETWORK_SETTINGS = {
  sepolia: {
    chainId:     '0xaa36a7',
    chainName:   'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls:     ['https://eth-sepolia.g.alchemy.com/v2/'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  localhost: {
    chainId:     '0x539',
    chainName:   'Hardhat',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrls:     ['http://127.0.0.1:8545'],
    blockExplorerUrls: [],
  },
};

export const getProvider = async (): Promise<BrowserProvider> => {
  if (!window.ethereum) throw new Error('MetaMask not found');
  return new BrowserProvider(window.ethereum);
};

export const getContract = async () => {
  const provider = await getProvider();
  const signer   = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};

export const getNetworkName = (chainId: string | number): string => {
  const hex = typeof chainId === 'number' ? `0x${chainId.toString(16)}` : chainId;
  switch (hex) {
    case '0xaa36a7': return 'Sepolia';
    case '0x539':    return 'Hardhat';
    default:         return `Chain ${parseInt(hex as string, 16)}`;
  }
};

export const ensureCorrectNetwork = async () => {
  if (!window.ethereum) return;
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== '0x539') {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x539' }] });
    } catch (err: any) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: '0x539', chainName: 'Hardhat Local', rpcUrls: ['http://127.0.0.1:8545'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 } }]
        });
      }
    }
  }
};

export const switchNetwork = async (networkName: 'sepolia' | 'localhost') => {
  const net = NETWORK_SETTINGS[networkName];
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainId }] });
    return true;
  } catch (err: any) {
    if (err.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ ...net }] });
      return true;
    }
    return false;
  }
};

// ─── Balances ──────────────────────────────────────────────────────────────────

/**
 * FIX 1: L1 balance reads from chain — no caching, no mutation.
 */
export const getLayer1Balance = async (address: string): Promise<string> => {
  try {
    const provider = await getProvider();
    const balance  = await provider.getBalance(address);
    return formatEther(balance);
  } catch { return '0'; }
};

/**
 * L2 balance from backend (pending spendable balance).
 */
export const getLayer2Balance = async (address: string): Promise<string> => {
  try {
    const res  = await fetch(`${API}/api/balance/${address}`);
    const data = await res.json();
    return data.layer2Balance || '0';
  } catch { return '0'; }
};

// ─── Nonce ────────────────────────────────────────────────────────────────────

export const getNonce = async (address: string): Promise<number> => {
  try {
    const res  = await fetch(`${API}/api/nonce/${address}`);
    const data = await res.json();
    return data.nonce ?? 0;
  } catch { return 0; }
};

// ─── EIP-712 signing ─────────────────────────────────────────────────────────

/**
 * Sign an L2 transaction locally.
 * No gas. No on-chain call. Signature is verified by the backend.
 */
export const signL2Transaction = async (
  from: string, to: string, amount: string, nonce: number, deadline?: number
): Promise<{ signature: string; messageHash: string }> => {
  const provider = await getProvider();
  const signer   = await provider.getSigner();
  const valueWei = parseEther(amount).toString();
  const exp      = deadline || Math.floor(Date.now() / 1000) + 3600;

  const msgHash  = ethers.solidityPackedKeccak256(
    ['address', 'address', 'uint256', 'uint256', 'uint256'],
    [from, to, valueWei, nonce, exp]
  );
  const signature = await signer.signMessage(ethers.getBytes(msgHash));
  return { signature, messageHash: msgHash };
};

// ─── L2 Transfer (off-chain) ─────────────────────────────────────────────────

/**
 * FIX 1.2: Pure off-chain L2 transfer.
 * Signs locally, sends to backend mempool. Zero gas.
 */
export const executeL2Transaction = async (recipient: string, amount: string) => {
  const provider = await getProvider();
  const signer   = await provider.getSigner();
  const from     = (await signer.getAddress()).toLowerCase();
  const nonce    = await getNonce(from);
  const valueWei = parseEther(amount).toString();
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const { signature } = await signL2Transaction(from, recipient, amount, nonce, deadline);

  const res = await fetch(`${API}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactions: [{ from, to: recipient, valueWei, nonce, deadline, signature }]
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'L2 transfer failed');
  }

  const result = await res.json();
  return {
    hash:   result.transactions?.[0]?.id || '0x0000',
    status: 1,
    wait:   async () => ({ status: 1, transactionHash: result.transactions?.[0]?.id || '0x0000' }),
  };
};

// ─── Batch L2 Transfer ────────────────────────────────────────────────────────

export const executeL2BatchTransaction = async (recipients: string[], amounts: string[]) => {
  const provider = await getProvider();
  const signer   = await provider.getSigner();
  const from     = (await signer.getAddress()).toLowerCase();
  let   nonce    = await getNonce(from);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const transactions = [];
  for (let i = 0; i < recipients.length; i++) {
    const valueWei = parseEther(amounts[i]).toString();
    const { signature } = await signL2Transaction(from, recipients[i], amounts[i], nonce + i, deadline);
    transactions.push({ from, to: recipients[i], valueWei, nonce: nonce + i, deadline, signature });
  }

  const res = await fetch(`${API}/api/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Batch failed'); }
  const result = await res.json();
  return { hash: result.id || '0x0000', wait: async () => ({ status: 1 }) };
};

export const batchTransfer = executeL2BatchTransaction;

// ─── L1 Deposit ───────────────────────────────────────────────────────────────

export const depositFunds = async (amount: string) => {
  await ensureCorrectNetwork();
  const contract = await getContract();
  const tx       = await contract.depositFunds({ value: parseEther(amount) });
  await tx.wait();
  toast({ title: 'Deposited', description: `${amount} ETH bridged to L2` });
  return tx;
};

// ─── L1 Withdraw ─────────────────────────────────────────────────────────────

export const withdrawFunds = async (amount: string) => {
  await ensureCorrectNetwork();
  const contract = await getContract();
  const tx       = await contract.withdrawFunds(parseEther(amount));
  await tx.wait();
  toast({ title: 'Withdrawn', description: `${amount} ETH withdrawn to L1` });
  return tx;
};

// ─── Fraud Proof ─────────────────────────────────────────────────────────────

export const generateFraudProof = async (batchDbId: string, txIndex = 0) => {
  const res = await fetch(`${API}/api/fraud-proof/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId: batchDbId, txIndex })
  });
  if (!res.ok) throw new Error('Failed to generate fraud proof');
  return res.json();
};

export const submitFraudProofFromBackend = async (
  batchDbId: string, challengerAddress: string, fraudProofData: any
) => {
  const res = await fetch(`${API}/api/fraud-proof/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId: batchDbId,
      challengerAddress,
      ...fraudProofData.contractCallParams,
    })
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
  return res.json();
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const isAdmin = async (address: string): Promise<boolean> => {
  try {
    const res  = await fetch(`${API}/api/admin/check?address=${address}`);
    const data = await res.json();
    return data.isAdmin || false;
  } catch { return false; }
};

export const addOperator = async (operatorAddress: string) => {
  await ensureCorrectNetwork();
  const contract = await getContract();
  const tx = await contract.addOperator(operatorAddress);
  await tx.wait();
};

export const removeOperator = async (operatorAddress: string) => {
  await ensureCorrectNetwork();
  const contract = await getContract();
  const tx = await contract.removeOperator(operatorAddress);
  await tx.wait();
};

export const isOperator = async (address: string): Promise<boolean> => {
  try { const c = await getContract(); return await c.isOperator(address); }
  catch { return false; }
};

// ─── Batches ──────────────────────────────────────────────────────────────────

export const getBatches = async () => {
  try { const r = await fetch(`${API}/api/batches`); return r.ok ? r.json() : []; }
  catch { return []; }
};

export const getBatchTransactions = async (batchId: string) => {
  try {
    const r     = await fetch(`${API}/api/batches/${batchId}`);
    if (!r.ok) return [];
    const batch = await r.json();
    return batch.transactions || [];
  } catch { return []; }
};

export const verifyBatch  = async () => { /* handled by sequencer */ };
export const finalizeBatch = async () => { /* handled by auto-finalizer + event */ };
export const reportFraudWithMerkleProof = async () => { /* use submitFraudProofFromBackend */ };

// ─── Gas Price ────────────────────────────────────────────────────────────────

export const getGasPrice = async (): Promise<string> => {
  try {
    const provider = await getProvider();
    const fee      = await provider.getFeeData();
    return fee.gasPrice ? `0x${fee.gasPrice.toString(16)}` : '0x0';
  } catch { return '0x0'; }
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const connectWallet = async () => {
  if (!window.ethereum) throw new Error('MetaMask is not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts.length) throw new Error('No accounts found');
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  localStorage.setItem('walletConnected', 'true');
  localStorage.setItem('lastConnectedAddress', accounts[0]);
  return { address: accounts[0], network: getNetworkName(chainId) };
};

export const disconnectWallet = async () => {
  localStorage.removeItem('walletConnected');
  localStorage.removeItem('lastConnectedAddress');
  try { await window.ethereum?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch {}
  window.location.reload();
};