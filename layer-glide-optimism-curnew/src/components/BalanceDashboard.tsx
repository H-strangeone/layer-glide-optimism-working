/**
 * BalanceDashboard
 *
 * Shows users the two-layer state model clearly:
 * - Pending balance: spendable NOW (optimistic)
 * - Finalized balance: committed on L1 (after challenge period)
 * - L1 balance: Ethereum mainnet
 *
 * Also shows challenge period timer for pending batches.
 */

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import {
  Zap, Shield, ArrowDownLeft, Clock, CheckCircle,
  AlertCircle, RefreshCw, TrendingUp
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

interface BalanceInfo {
  layer1Balance:    string;
  layer2Balance:    string;
  finalizedBalance: string;
  pendingBalance:   string;
  isFinalized:      boolean;
}

interface PendingBatchInfo {
  id:            string;
  onChainId:     string | null;
  challengeEndsAt: string | null;
  txCount:       number;
  status:        string;
}

export default function BalanceDashboard() {
  const { address, isConnected } = useWallet();
  const [balances, setBalances]     = useState<BalanceInfo | null>(null);
  const [pendingBatch, setPendingBatch] = useState<PendingBatchInfo | null>(null);
  const [loading, setLoading]       = useState(false);
  const [now, setNow]               = useState(Date.now());

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [balRes, batchRes] = await Promise.all([
        fetch(`${API}/api/balance/${address}`),
        fetch(`${API}/api/batches/user/${address}`),
      ]);
      if (balRes.ok)   setBalances(await balRes.json());
      if (batchRes.ok) {
        const batches = await batchRes.json();
        const challengePeriod = batches.find((b: PendingBatchInfo) => b.status === 'challenge_period');
        setPendingBatch(challengePeriod || null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [address]);

  const timeLeftMs = pendingBatch?.challengeEndsAt
    ? Math.max(0, new Date(pendingBatch.challengeEndsAt).getTime() - now)
    : 0;

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Finalizing...';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  if (!isConnected) return null;

  const l1 = parseFloat(balances?.layer1Balance   || '0');
  const l2 = parseFloat(balances?.layer2Balance   || '0');
  const fi = parseFloat(balances?.finalizedBalance || '0');
  const pending = l2 - fi;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

      {/* L1 Balance */}
      <div className="ln-stat-card">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownLeft size={14} className="text-green-400" />
          <span className="ln-label">L1 Balance</span>
          <button onClick={fetchData} className="ml-auto text-muted hover:text-orange transition-colors">
            <RefreshCw size={10} className={loading ? 'anim-spin' : ''} />
          </button>
        </div>
        <div className="ln-number text-2xl">{l1.toFixed(4)}</div>
        <div className="text-[9px] text-muted mt-1">ETH on Ethereum</div>
      </div>

      {/* L2 Pending */}
      <div className="ln-stat-card">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-orange" />
          <span className="ln-label">L2 Available</span>
        </div>
        <div className="ln-number text-2xl text-orange">{l2.toFixed(4)}</div>
        <div className="text-[9px] text-muted mt-1">Available to spend on L2</div>
        {pending > 0.0001 && (
          <div className="text-[9px] text-yellow-500 mt-1 flex items-center gap-1">
            <Clock size={8} />
            {pending.toFixed(4)} ETH pending finalization
          </div>
        )}
      </div>

      {/* L2 Finalized */}
      <div className="ln-stat-card">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-green-400" />
          <span className="ln-label">L2 Finalized</span>
        </div>
        <div className="ln-number text-2xl text-green-400">{fi.toFixed(4)}</div>
        <div className="text-[9px] text-muted mt-1">Committed on L1 · withdrawable</div>
        {!balances?.isFinalized && fi < l2 && (
          <div className="text-[9px] text-muted mt-1 flex items-center gap-1">
            <AlertCircle size={8} />
            Partial — some txs pending challenge
          </div>
        )}
      </div>

      {/* Challenge Status */}
      <div className="ln-stat-card">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-orange" />
          <span className="ln-label">Challenge Window</span>
        </div>
        {pendingBatch ? (
          <>
            <div className="ln-number text-2xl" style={{ color: timeLeftMs < 60000 ? '#5db87a' : 'var(--orange)' }}>
              {formatCountdown(timeLeftMs)}
            </div>
            <div className="text-[9px] text-muted mt-1">
              Batch #{pendingBatch.onChainId || 'pending'} · {pendingBatch.txCount} txs
            </div>
            <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  background:  timeLeftMs < 60000 ? '#5db87a' : 'var(--orange)',
                  width:       `${Math.max(2, 100 - (timeLeftMs / (300 * 1000)) * 100)}%`
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="ln-number text-2xl text-green-400 flex items-center gap-2">
              <CheckCircle size={20} />
            </div>
            <div className="text-[9px] text-green-400 mt-1">All batches finalized</div>
          </>
        )}
      </div>
    </div>
  );
}