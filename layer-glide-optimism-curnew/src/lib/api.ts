
// import { toast } from "@/components/ui/use-toast";
// import { Transaction } from "./merkleTree";
// import { getNonce } from './ethers';
// const API_URL = "http://localhost:5500/api";

// // Interface for batch data
// export interface Batch {
//   id: string;
//   transactionsRoot: string;
//   transactions: Transaction[];
//   timestamp: string;
//   verified: boolean;
//   finalized: boolean;
// }
// // Interface for transaction status
// export interface TransactionStatus {
//   id: string;
//   status: "pending" | "confirmed" | "failed";
//   hash: string;
//   from: string;
//   to: string;
//   amount: string;
//   timestamp: string;
//   batchId?: string;
// }

// // Fetch batches from the backend
// export const fetchBatches = async (): Promise<Batch[]> => {
//   try {
//     const response = await fetch(`${API_URL}/batches`);
//     if (!response.ok) {
//       throw new Error("Failed to fetch batches");
//     }
//     return await response.json();
//   } catch (error) {
//     console.error("Error fetching batches:", error);
//     toast({
//       title: "Error",
//       description: "Failed to fetch batches. Please try again later.",
//       variant: "destructive",
//     });
//     return [];
//   }
// };

// // Fetch batch by ID
// export const fetchBatchById = async (batchId: string): Promise<Batch | null> => {
//   try {
//     const response = await fetch(`${API_URL}/batches/${batchId}`);
//     if (!response.ok) {
//       throw new Error("Failed to fetch batch");
//     }
//     return await response.json();
//   } catch (error) {
//     console.error(`Error fetching batch ${batchId}:`, error);
//     toast({
//       title: "Error",
//       description: `Failed to fetch batch ${batchId}. Please try again later.`,
//       variant: "destructive",
//     });
//     return null;
//   }
// };

// // Submit transactions to the backend
// export const submitTransactions = async (transactions: Transaction[]): Promise<string> => {
//   try {
//     //  STEP 1 — GET BASE NONCE (use sender)
//     const baseNonce = await getNonce(transactions[0].sender);

//     //  STEP 2 — ASSIGN NONCE
//     const txsWithNonce = transactions.map((tx, i) => ({
//       from: tx.sender,        //  map correctly
//       to: tx.recipient,
//       value: tx.amount,
//       nonce: baseNonce + i
//     }));

//     //  STEP 3 — SEND
//     const response = await fetch(`${API_URL}/transactions`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ transactions: txsWithNonce }),
//     });

//     if (!response.ok) {
//       const err = await response.json();
//       throw new Error(err.error || "Failed to submit transactions");
//     }

//     const result = await response.json();
//     return "submitted";
//   } catch (error: any) {
//     console.error("Error submitting transactions:", error);
//     toast({
//       title: "Error",
//       description: error.message || "Failed to submit transactions",
//       variant: "destructive",
//     });
//     throw error;
//   }
// };

// // Fetch transaction status
// export const fetchTransactionStatus = async (address: string): Promise<TransactionStatus[]> => {
//   try {
//     const response = await fetch(`${API_URL}/transactions?address=${address}`);
//     if (!response.ok) {
//       throw new Error("Failed to fetch transaction status");
//     }
//     return await response.json();
//   } catch (error) {
//     console.error("Error fetching transaction status:", error);
//     toast({
//       title: "Error",
//       description: "Failed to fetch transaction status. Please try again later.",
//       variant: "destructive",
//     });
//     return [];
//   }
// };

// // Fetch fraud proof for a transaction
// export const fetchFraudProof = async (batchId: string, transactionIndex: number): Promise<{
//   fraudProof: string;
//   merkleProof: string[];
// }> => {
//   try {
//     const response = await fetch(`${API_URL}/proof/${batchId}/${transactionIndex}`);
//     if (!response.ok) {
//       throw new Error("Failed to fetch fraud proof");
//     }
//     return await response.json();
//   } catch (error) {
//     console.error("Error fetching fraud proof:", error);
//     toast({
//       title: "Error",
//       description: "Failed to fetch fraud proof. Please try again later.",
//       variant: "destructive",
//     });
//     throw error;
//   }
// };

// // For demo purposes - these are mock implementations
// // In a real app, these would interact with the backend
// export const getMockBatches = (): Batch[] => {
//   return [
//     {
//       id: "1",
//       transactionsRoot: "0x123...",
//       transactions: [
//         { sender: "0x123...", recipient: "0x456...", amount: "0.1" },
//         { sender: "0x789...", recipient: "0xabc...", amount: "0.2" },
//       ],
//       timestamp: new Date().toISOString(),
//       verified: true,
//       finalized: false,
//     },
//     {
//       id: "2",
//       transactionsRoot: "0x456...",
//       transactions: [
//         { sender: "0xdef...", recipient: "0xghi...", amount: "0.3" },
//       ],
//       timestamp: new Date().toISOString(),
//       verified: false,
//       finalized: false,
//     },
//   ];
// };

// export const getMockTransactionStatus = (address: string): TransactionStatus[] => {
//   return [
//     {
//       id: "tx1",
//       status: "confirmed",
//       hash: "0x123...",
//       from: address,
//       to: "0x456...",
//       amount: "0.1",
//       timestamp: new Date().toISOString(),
//       batchId: "1",
//     },
//     {
//       id: "tx2",
//       status: "pending",
//       hash: "0x789...",
//       from: address,
//       to: "0xabc...",
//       amount: "0.2",
//       timestamp: new Date().toISOString(),
//     },
//   ];
// };
////// revamp

/**
 * api.ts — Production L2 API client
 * All methods typed, error-handled, ready to use.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5500";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BalanceInfo {
  layer1Balance:    string;
  layer2Balance:    string;     // pending (available to spend)
  finalizedBalance: string;     // post-challenge finalized
  pendingBalance:   string;
  layer1BalanceWei: string;
  layer2BalanceWei: string;
  finalizedWei:     string;
  pendingWei:       string;
  isFinalized:      boolean;
}

export interface Batch {
  id:              string;
  onChainId?:      string;
  stateRoot?:      string;
  prevStateRoot?:  string;
  txRoot?:         string;
  transactionsRoot: string;
  status:          string;
  txCount:         number;
  challengeEndsAt?: string;
  createdAt:       string;
  submitter?:      string;
  transactions:    PendingTx[];
}

export interface PendingTx {
  id:          string;
  fromAddress: string;
  toAddress:   string;
  valueWei:    string;
  nonce:       number;
  status:      string;
  batchId?:    string;
  createdAt:   number;
}

export interface StateRootInfo {
  onChainRoot: string | null;
  dbRoot:      string | null;
  prevRoot:    string | null;
  batchId:     string | null;
}

export interface FraudProof {
  batchId:         string;
  txLeaf:          string;
  txProof:         string[];
  preStateLeaf:    string;
  preStateProof:   string[];
  postStateLeaf:   string;
  postStateProof:  string[];
  correctStateRoot: string;
  claimedStateRoot: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Balance ──────────────────────────────────────────────────────────────────
export const getBalance = (address: string) =>
  request<BalanceInfo>(`/api/balance/${address}`);

// ─── Transactions ─────────────────────────────────────────────────────────────
export const submitTransactions = (transactions: any[]) =>
  request<{ success: boolean; count: number; ids: string[] }>(
    "/api/transactions",
    { method: "POST", body: JSON.stringify({ transactions }) }
  );

export const getUserTransactions = (address: string) =>
  request<{ transactions: PendingTx[] }>(`/api/transactions/user/${address}`);

export const getNetworkTransactions = () =>
  request<PendingTx[]>("/api/transactions/network");

// ─── Nonce ────────────────────────────────────────────────────────────────────
export const getNonce = (address: string) =>
  request<{ nonce: number }>(`/api/nonce/${address}`);

// ─── Batches ──────────────────────────────────────────────────────────────────
export const getBatches = () =>
  request<Batch[]>("/api/batches");

export const getBatch = (id: string) =>
  request<Batch>(`/api/batches/${id}`);

export const getUserBatches = (address: string) =>
  request<Batch[]>(`/api/batches/user/${address}`);

// ─── State Root ───────────────────────────────────────────────────────────────
export const getStateRoot = () =>
  request<StateRootInfo>("/api/state-root");

// ─── Fraud Proofs ─────────────────────────────────────────────────────────────
export const generateFraudProof = (batchId: string, txId: string) =>
  request<FraudProof>("/api/fraud-proof/generate", {
    method: "POST",
    body: JSON.stringify({ batchId, txId })
  });

export const submitFraudProof = (proof: FraudProof) =>
  request<{ success: boolean; txHash: string }>("/api/fraud-proof/submit", {
    method: "POST",
    body: JSON.stringify(proof)
  });

// ─── Withdrawals ──────────────────────────────────────────────────────────────
export const requestWithdrawal = (address: string, amount: string) =>
  request<{ success: boolean; withdrawalId: string; simulated?: boolean }>(
    "/api/withdrawal/request",
    { method: "POST", body: JSON.stringify({ address, amount }) }
  );

// ─── Admin ────────────────────────────────────────────────────────────────────
export const checkAdmin = (address: string) =>
  request<{ success: boolean; isAdmin: boolean; isOperator: boolean }>(
    `/api/admin/check?address=${address}`
  );

export const getOperators = () =>
  request<any[]>("/api/admin/operators");

export const addOperator = (address: string) =>
  request<any>("/api/admin/operators", {
    method: "POST",
    body: JSON.stringify({ address })
  });

export const removeOperator = (address: string) =>
  request<any>(`/api/admin/operators/${address}`, { method: "DELETE" });

// ─── Gas ──────────────────────────────────────────────────────────────────────
export const getGasPrices = () =>
  request<{ slow: string; standard: string; fast: string; rapid: string }>(
    "/api/gas-prices"
  );

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthCheck = () =>
  request<{ status: string; blockchain: boolean; network: string }>(
    "/health"
  );