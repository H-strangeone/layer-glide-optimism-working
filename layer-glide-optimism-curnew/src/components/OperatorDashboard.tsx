/**
 * OperatorDashboard.tsx — Fixed
 * Same timestamp bug fixes as BatchManager
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import {
  Layers, Shield, AlertTriangle, CheckCircle, Clock,
  RefreshCw, ChevronDown, Database, Activity, Box, Hash
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API = import.meta.env.VITE_API_URL || "http://localhost:5500";

interface Batch {
  id: string;
  onChainId?: string;
  stateRoot?: string;
  prevStateRoot?: string;
  txRoot?: string;
  transactionsRoot?: string;
  status: string;
  txCount: number;
  challengeEndsAt?: number | null; // unix seconds from backend
  createdAt: number;               // unix seconds from backend — FIXED
  submitter?: string;
  transactions: any[];
  timeLeftMs?: number;
}

interface StateRoot {
  onChainRoot: string | null;
  dbRoot: string | null;
  batchId: string | null;
}

function batchTimeAgo(createdAt: number | string | undefined): string {
  if (!createdAt) return '—';
  const ms = typeof createdAt === 'string'
    ? new Date(createdAt).getTime()
    : createdAt > 1e10 ? createdAt : createdAt * 1000;
  try { return formatDistanceToNow(new Date(ms), { addSuffix: true }); }
  catch { return '—'; }
}

export default function OperatorDashboard() {
  const { address } = useWallet();
  const [batches, setBatches]         = useState<Batch[]>([]);
  const [stateRoot, setStateRoot]     = useState<StateRoot | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [activeTab, setActiveTab]     = useState<"all"|"pending"|"challenge"|"finalized"|"rejected">("all");
  const [fraudBatchId, setFraudBatchId] = useState("");
  const [fraudTxId, setFraudTxId]     = useState("");
  const [generatingProof, setGeneratingProof] = useState(false);
  const [fraudProof, setFraudProof]   = useState<any>(null);
  const [now, setNow]                 = useState(Date.now());

  // Live countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, srRes] = await Promise.all([
        fetch(`${API}/api/batches`),
        fetch(`${API}/api/state-root`),
      ]);
      if (bRes.ok)  setBatches(await bRes.json());
      if (srRes.ok) setStateRoot(await srRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = batches.filter(b => {
    if (activeTab === "all")       return true;
    if (activeTab === "pending")   return b.status === "pending_submission";
    if (activeTab === "challenge") return b.status === "challenge_period";
    if (activeTab === "finalized") return b.status === "finalized";
    if (activeTab === "rejected")  return b.status === "rejected" || b.status === "failed";
    return true;
  });

  const handleGenerateFraudProof = async () => {
    if (!fraudBatchId) return;
    setGeneratingProof(true);
    try {
      const res = await fetch(`${API}/api/fraud-proof/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: fraudBatchId, txIndex: fraudTxId ? parseInt(fraudTxId) : 0 })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const proof = await res.json();
      setFraudProof(proof);
      toast({
        title: proof.isFraudulent ? "🚨 Fraud Detected!" : "✅ Batch Valid",
        description: proof.explanation
      });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setGeneratingProof(false); }
  };

  const handleSubmitFraudProof = async () => {
    if (!fraudProof) return;
    try {
      const res = await fetch(`${API}/api/fraud-proof/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId:          fraudBatchId,
          fraudulentTxHash: fraudProof.fraudulentTxHash,
          txProof:          fraudProof.txProof,
          correctStateRoot: fraudProof.correctStateRoot,
          challengerAddress: address,
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Fraud proof submitted!", description: "Batch will be invalidated if proof is valid" });
      setFraudProof(null);
      setFraudBatchId(""); setFraudTxId("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    }
  };

  const statusStyle = (s: string) => {
    switch (s) {
      case "finalized":          return "bg-green-500/10 text-green-500 border-green-500/20";
      case "challenge_period":   return "bg-orange/10 text-orange border-orange/20";
      case "rejected": case "failed": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "pending_submission": return "bg-white/5 text-muted border-white/10";
      default:                   return "bg-white/5 text-muted border-white/10";
    }
  };
  const statusLabel = (s: string) => ({
    finalized: "Finalized", challenge_period: "Challenge",
    rejected: "Rejected", pending_submission: "Pending", failed: "Failed",
  }[s] || s);

  const stats = {
    total:     batches.length,
    finalized: batches.filter(b => b.status === "finalized").length,
    active:    batches.filter(b => b.status === "challenge_period").length,
    totalTxs:  batches.reduce((sum, b) => sum + (b.txCount || 0), 0),
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-orange/10">
            <Layers size={22} className="text-orange" />
          </div>
          <div>
            <h2 className="ln-title text-3xl tracking-tight">Batch Governance</h2>
            <p className="ln-label text-xs">State root management & fraud proof system</p>
          </div>
        </div>
        <button onClick={fetchData} className="text-muted hover:text-orange transition-colors">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* State Root Banner */}
      <div className="glass rounded-sm p-4 border border-orange/10">
        <div className="flex items-center gap-3">
          <Database size={16} className="text-orange" />
          <div className="flex-1">
            <div className="ln-label text-[9px] mb-0.5">Latest State Root (L1 Truth)</div>
            <div className="text-[11px] font-mono text-orange break-all">
              {stateRoot?.onChainRoot || stateRoot?.dbRoot || "genesis — no batches finalized yet"}
            </div>
          </div>
          {stateRoot?.batchId && (
            <div className="text-[9px] text-muted font-mono">Batch #{stateRoot.batchId}</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Batches",    value: stats.total,    color: "text-orange" },
          { label: "Finalized",        value: stats.finalized, color: "text-green-400" },
          { label: "In Challenge",     value: stats.active,   color: "text-orange" },
          { label: "Total Txs Rolled", value: stats.totalTxs, color: "text-orange" },
        ].map(({ label, value, color }) => (
          <div key={label} className="ln-stat-card">
            <div className="ln-label text-[9px] mb-2">{label}</div>
            <div className={`ln-number text-3xl ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tab filter */}
      <div>
        <div className="flex gap-0 mb-4 border-b border-white/5">
          {(["all","pending","challenge","finalized","rejected"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: activeTab === t ? "var(--orange)" : "var(--muted)",
                borderBottom: activeTab === t ? "2px solid var(--orange)" : "2px solid transparent",
                background: "none",
              }}>
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">No batches in this category</div>
          )}

          {filtered.map(batch => {
            const liveTimeLeftMs = batch.challengeEndsAt
              ? Math.max(0, batch.challengeEndsAt * 1000 - now)
              : (batch.timeLeftMs ?? 0);

            return (
              <div key={batch.id} className="bg-white/5 border border-white/5 rounded-sm hover:border-orange/20 transition-colors group">
                <div className="p-4 cursor-pointer" onClick={() => setExpanded(expanded === batch.id ? null : batch.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Box size={18} className="text-muted group-hover:text-orange transition-colors" />
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest">
                          Batch {batch.onChainId ? `#${batch.onChainId}` : '[UNCOMMITTED]'}
                        </div>
                        <div className="text-[9px] font-mono text-muted/50 select-all">{batch.id}</div>
                        <div className="text-[9px] font-mono text-muted mt-0.5">
                          stateRoot: {(batch.stateRoot || "pending").slice(0, 16)}...
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-muted">{batch.txCount} txs</span>
                      {batch.status === "challenge_period" && batch.challengeEndsAt && (
                        <div className="text-[9px] text-orange font-bold flex items-center gap-1">
                          <Clock size={10} />
                          {liveTimeLeftMs <= 0 ? 'Finalizing...' : (() => {
                            const s = Math.floor(liveTimeLeftMs / 1000);
                            const m = Math.floor(s / 60);
                            return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
                          })()}
                        </div>
                      )}
                      {/* FIXED timestamp display */}
                      <span className="text-[9px] text-muted hidden md:block">
                        {batchTimeAgo(batch.createdAt)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusStyle(batch.status)}`}>
                        {statusLabel(batch.status)}
                      </span>
                      <ChevronDown size={14} className={`text-muted transition-transform ${expanded === batch.id ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>

                {expanded === batch.id && (
                  <div className="border-t border-white/5 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">State Root</div>
                        <div className="text-[9px] font-mono text-orange break-all">{batch.stateRoot || "—"}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">Prev State Root</div>
                        <div className="text-[9px] font-mono text-muted break-all">{batch.prevStateRoot || "genesis"}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-sm">
                      <div className="ln-label text-[9px] mb-1">TX Root</div>
                      <div className="text-[9px] font-mono text-muted break-all">{batch.txRoot || batch.transactionsRoot || "—"}</div>
                    </div>
                    {batch.transactions?.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {batch.transactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between p-2 bg-black/20 rounded-sm text-[9px] font-mono">
                            <span className="text-muted">
                              {tx.fromAddress?.slice(0, 8)}... → {tx.toAddress?.slice(0, 8)}...
                            </span>
                            <span className="text-orange">
                              {tx.valueWei && BigInt(tx.valueWei) > 0n
                                ? (Number(BigInt(tx.valueWei)) / 1e18).toFixed(4)
                                : "0"} ETH
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fraud Proof Section */}
      <div className="glass rounded-sm p-6 border border-red-500/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-sm bg-red-500/10">
            <Shield size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="ln-title text-xl tracking-tight">Fraud Proof System</h3>
            <p className="ln-label text-[9px]">Enter DB UUID (the long id shown under each batch)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="ln-label text-[10px] block mb-2">Batch DB UUID</label>
            <input
              className="ln-input w-full text-xs font-mono"
              placeholder="Paste the full UUID from the batch card above"
              value={fraudBatchId}
              onChange={e => setFraudBatchId(e.target.value)}
            />
          </div>
          <div>
            <label className="ln-label text-[10px] block mb-2">Transaction Index (0 = first tx)</label>
            <input
              className="ln-input w-full text-xs font-mono"
              placeholder="0"
              value={fraudTxId}
              onChange={e => setFraudTxId(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleGenerateFraudProof}
          disabled={generatingProof || !fraudBatchId}
          className="btn-outline mr-3"
        >
          {generatingProof ? "Computing..." : "Generate Proof"}
        </button>

        {fraudProof && (
          <div className="mt-4 space-y-3">
            <div className={`p-3 rounded-sm border ${fraudProof.isFraudulent ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
              <div className={`ln-label text-[9px] mb-2 ${fraudProof.isFraudulent ? 'text-red-400' : 'text-green-400'}`}>
                {fraudProof.isFraudulent ? '🚨 Fraud Detected' : '✅ Batch Valid'}
              </div>
              <div className="text-[9px] text-muted">{fraudProof.explanation}</div>
              {fraudProof.isFraudulent && (
                <div className="text-[9px] font-mono text-muted space-y-1 mt-2">
                  <div>Claimed: <span className="text-red-400">{fraudProof.claimedStateRoot?.slice(0,20)}...</span></div>
                  <div>Correct: <span className="text-green-400">{fraudProof.correctStateRoot?.slice(0,20)}...</span></div>
                </div>
              )}
            </div>
            {fraudProof.isFraudulent && (
              <button onClick={handleSubmitFraudProof} className="btn-primary">
                <AlertTriangle size={14} className="mr-2" />
                Submit Fraud Proof On-Chain
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}