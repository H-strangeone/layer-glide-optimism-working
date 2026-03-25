import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowUpRight, ArrowDownLeft, Zap, Shield, Clock,
  CheckCircle, AlertTriangle, RefreshCw, Send, Database,
  TrendingUp, Activity, Lock, Unlock
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5500";

interface BalanceInfo {
  layer1Balance: string;
  layer2Balance: string;
  finalizedBalance: string;
  pendingBalance: string;
  isFinalized: boolean;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: string;
  createdAt: number;
  batchId?: string;
  type?: string;
}

interface StateRootInfo {
  onChainRoot: string | null;
  dbRoot: string | null;
  prevRoot: string | null;
  batchId: string | null;
}

export default function UserDashboard() {
  const { address, isConnected } = useWallet();
  const [balances, setBalances]       = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stateRoot, setStateRoot]     = useState<StateRootInfo | null>(null);
  const [loading, setLoading]         = useState(false);
  const [recipient, setRecipient]     = useState("");
  const [amount, setAmount]           = useState("");
  const [sending, setSending]         = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [tab, setTab]                 = useState<"transfer"|"withdraw"|"history">("transfer");

  const fetchData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [balRes, txRes, srRes] = await Promise.all([
        fetch(`${API}/api/balance/${address}`),
        fetch(`${API}/api/transactions/user/${address}`),
        fetch(`${API}/api/state-root`),
      ]);
      if (balRes.ok) setBalances(await balRes.json());
      if (txRes.ok)  {
        const d = await txRes.json();
        setTransactions(d.transactions || d);
      }
      if (srRes.ok)  setStateRoot(await srRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTransfer = async () => {
    if (!recipient || !amount || !address) return;
    setSending(true);
    try {
      // Get nonce
      const nonceRes = await fetch(`${API}/api/nonce/${address}`);
      const { nonce } = await nonceRes.json();

      // Sign transaction
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();

      const valueWei = ethers.parseEther(amount).toString();
      const msgHash  = ethers.solidityPackedKeccak256(
        ["address", "address", "uint256", "uint256"],
        [address.toLowerCase(), recipient.toLowerCase(), valueWei, nonce]
      );
      const signature = await signer.signMessage(ethers.getBytes(msgHash));

      const res = await fetch(`${API}/api/transactions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: [{
            from: address, to: recipient,
            valueWei, nonce, signature
          }]
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transfer failed");
      }

      toast({ title: "Transfer submitted", description: "Your L2 transfer is in the mempool" });
      setRecipient(""); setAmount("");
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !address) return;
    setWithdrawing(true);
    try {
      const { ethers } = await import("ethers");
      const valueWei = ethers.parseEther(withdrawAmount).toString();

      const res = await fetch(`${API}/api/withdrawal/request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amount: valueWei })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Withdrawal failed");
      }

      const data = await res.json();
      toast({
        title: "Withdrawal requested",
        description: data.simulated
          ? "Simulated withdrawal queued (challenge period applies)"
          : `On-chain withdrawal #${data.withdrawalId} submitted`
      });
      setWithdrawAmount("");
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case "finalized":   return "text-green-400 bg-green-400/10 border-green-400/20";
      case "challenge_period": return "text-orange bg-orange/10 border-orange/20";
      case "batched":     return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "pending":     return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "failed":      return "text-red-400 bg-red-400/10 border-red-400/20";
      default:            return "text-muted bg-white/5 border-white/10";
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center glass rounded-sm p-10 max-w-sm w-full">
          <Shield size={40} style={{ color: "var(--orange)", margin: "0 auto 1rem" }} />
          <h2 className="ln-title text-3xl mb-2">Connect Wallet</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Connect MetaMask to access your L2 account
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ln-stat-card">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownLeft size={14} style={{ color: "var(--orange)" }} />
            <span className="ln-label">L1 Balance</span>
          </div>
          <div className="ln-number text-2xl">{Number(balances?.layer1Balance || 0).toFixed(4)}</div>
          <div className="text-[9px] text-muted mt-1">ETH on Ethereum</div>
        </div>

        <div className="ln-stat-card">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} style={{ color: "var(--orange)" }} />
            <span className="ln-label">L2 Pending</span>
          </div>
          <div className="ln-number text-2xl">{Number(balances?.pendingBalance || 0).toFixed(4)}</div>
          <div className="text-[9px] text-muted mt-1">Available to spend</div>
        </div>

        <div className="ln-stat-card">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-green-400" />
            <span className="ln-label">L2 Finalized</span>
          </div>
          <div className="ln-number text-2xl">{Number(balances?.finalizedBalance || 0).toFixed(4)}</div>
          <div className="text-[9px] text-muted mt-1">Post-challenge</div>
        </div>

        <div className="ln-stat-card">
          <div className="flex items-center gap-2 mb-3">
            <Database size={14} style={{ color: "var(--orange)" }} />
            <span className="ln-label">State Root</span>
          </div>
          <div className="text-[10px] font-mono text-orange truncate">
            {stateRoot?.dbRoot ? stateRoot.dbRoot.slice(0, 14) + "..." : "genesis"}
          </div>
          <div className="text-[9px] text-muted mt-1">
            {stateRoot?.batchId ? `Batch #${stateRoot.batchId}` : "No batches yet"}
          </div>
        </div>
      </div>

      {/* Action Tabs */}
      <div className="glass rounded-sm overflow-hidden">
        <div className="flex border-b border-white/5">
          {(["transfer", "withdraw", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: tab === t ? "var(--orange)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid var(--orange)" : "2px solid transparent",
                background: "none",
              }}
            >
              {t === "transfer" ? "Transfer" : t === "withdraw" ? "Withdraw" : "History"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Transfer Tab */}
          {tab === "transfer" && (
            <div className="space-y-5 max-w-md">
              <div>
                <label className="ln-label text-[10px] block mb-2">Recipient Address</label>
                <input
                  className="ln-input w-full font-mono text-xs"
                  placeholder="0x..."
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="ln-label text-[10px]">Amount (ETH)</label>
                  <button
                    className="text-[10px] font-bold text-orange hover:opacity-70"
                    onClick={() => setAmount(balances?.pendingBalance || "")}
                  >
                    MAX
                  </button>
                </div>
                <input
                  className="ln-input w-full font-mono text-xl"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0" step="0.0001"
                />
              </div>
              <div className="p-3 rounded-sm bg-white/5 border border-white/5 text-[10px] text-muted">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={10} className="text-orange" />
                  <span>Instant L2 settlement — signed off-chain, batched for L1</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={10} className="text-orange" />
                  <span>Protected by cryptographic state roots + fraud proofs</span>
                </div>
              </div>
              <button
                onClick={handleTransfer}
                disabled={sending || !recipient || !amount}
                className="btn-primary w-full py-3 justify-center"
              >
                {sending ? "Signing & submitting..." : "Send Transfer"}
                {!sending && <Send size={14} className="ml-2" />}
              </button>
            </div>
          )}

          {/* Withdraw Tab */}
          {tab === "withdraw" && (
            <div className="space-y-5 max-w-md">
              <div className="p-4 rounded-sm border" style={{ borderColor: "rgba(232,97,26,0.2)", background: "rgba(232,97,26,0.05)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-orange" />
                  <span className="text-[11px] font-bold text-orange uppercase tracking-wider">Challenge Period</span>
                </div>
                <p className="text-[10px] text-muted">
                  Withdrawals require a Merkle proof of your finalized balance. After the challenge period passes,
                  funds are released to your L1 address.
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="ln-label text-[10px]">Withdraw Amount (ETH)</label>
                  <button
                    className="text-[10px] font-bold text-orange hover:opacity-70"
                    onClick={() => setWithdrawAmount(balances?.finalizedBalance || "")}
                  >
                    MAX FINALIZED
                  </button>
                </div>
                <input
                  className="ln-input w-full font-mono text-xl"
                  type="number"
                  placeholder="0.0"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  min="0" step="0.0001"
                />
              </div>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount}
                className="btn-primary w-full py-3 justify-center"
              >
                {withdrawing ? "Generating proof..." : "Request Withdrawal"}
                {!withdrawing && <Unlock size={14} className="ml-2" />}
              </button>
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="ln-label text-[10px]">{transactions.length} transactions</span>
                <button onClick={fetchData} className="text-muted hover:text-orange transition-colors">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
              {transactions.length === 0 ? (
                <div className="text-center py-10 text-muted text-sm">No transactions yet</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {transactions.map(tx => (
                    <div key={tx.hash} className="flex items-center justify-between p-3 bg-white/5 rounded-sm border border-white/5 hover:border-orange/20 transition-colors">
                      <div className="flex items-center gap-3">
                        {tx.from?.toLowerCase() === address?.toLowerCase()
                          ? <ArrowUpRight size={14} className="text-orange" />
                          : <ArrowDownLeft size={14} className="text-green-400" />
                        }
                        <div>
                          <div className="text-[10px] font-mono text-muted">
                            {tx.from?.toLowerCase() === address?.toLowerCase()
                              ? `→ ${tx.to?.slice(0,8)}...`
                              : `← ${tx.from?.slice(0,8)}...`
                            }
                          </div>
                          <div className="text-[9px] text-muted/60">
                            {tx.batchId ? `Batch #${tx.batchId}` : "Pending batch"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-orange">
                          {Number(tx.value ? (BigInt(tx.value) > 1000000000n
                            ? Number(BigInt(tx.value)) / 1e18
                            : Number(tx.value)) : 0).toFixed(4)} ETH
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${statusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}