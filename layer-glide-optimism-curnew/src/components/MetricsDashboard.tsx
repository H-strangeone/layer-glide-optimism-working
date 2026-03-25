import { useState, useEffect } from 'react';
import { Activity, Zap, Layers, Shield, TrendingUp, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

interface Metrics {
  totalTransactions:   number;
  pendingTransactions: number;
  totalBatches:        number;
  finalizedBatches:    number;
  rejectedBatches:     number;
  activeChallenges:    number;
  avgTxsPerBatch:      number;
  estimatedGasSaving:  string;
  compressionRatio:    string;
  networkHealth:       string;
}

interface StateRootInfo {
  currentStateRoot:   string;
  latestBatchId:      string | null;
  latestBatchStatus:  string | null;
}

export default function MetricsDashboard() {
  const [metrics,    setMetrics]    = useState<Metrics | null>(null);
  const [stateRoot,  setStateRoot]  = useState<StateRootInfo | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15_000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`${API}/api/metrics`),
        fetch(`${API}/api/state-root`),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (sRes.ok) setStateRoot(await sRes.json());
    } catch {}
    setLoading(false);
  };

  const STAT_CARDS = metrics ? [
    { icon: Activity, label: 'Total Transactions',  value: metrics.totalTransactions.toLocaleString(),  color: 'text-orange' },
    { icon: Clock,    label: 'Pending in Pool',      value: metrics.pendingTransactions.toString(),      color: 'text-yellow-400' },
    { icon: Layers,   label: 'Total Batches',        value: metrics.totalBatches.toString(),             color: 'text-text' },
    { icon: CheckCircle, label: 'Finalized Batches', value: metrics.finalizedBatches.toString(),         color: 'text-green-400' },
    { icon: Zap,      label: 'Gas Saved vs L1',      value: metrics.estimatedGasSaving,                  color: 'text-orange' },
    { icon: TrendingUp, label: 'Compression Ratio',  value: metrics.compressionRatio,                   color: 'text-orange' },
    { icon: Shield,   label: 'Active Challenges',     value: metrics.activeChallenges.toString(),         color: metrics.activeChallenges > 0 ? 'text-red-400' : 'text-green-400' },
    { icon: AlertTriangle, label: 'Rejected Batches', value: metrics.rejectedBatches.toString(),         color: metrics.rejectedBatches > 0 ? 'text-red-400' : 'text-muted' },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-sm bg-orange/10 border border-orange/20">
          <TrendingUp size={20} className="text-orange" />
        </div>
        <div>
          <h3 className="ln-title text-2xl tracking-tight">Network Metrics</h3>
          <p className="ln-label text-xs">Real-time compression and efficiency stats</p>
        </div>
        {metrics && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full border"
            style={{
              background: metrics.networkHealth === 'healthy' ? 'rgba(93,184,122,0.1)' : 'rgba(217,96,96,0.1)',
              borderColor: metrics.networkHealth === 'healthy' ? 'rgba(93,184,122,0.25)' : 'rgba(217,96,96,0.25)',
            }}>
            <span className={`w-1.5 h-1.5 rounded-full ${metrics.networkHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500'} anim-pulse-orange`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${metrics.networkHealth === 'healthy' ? 'text-green-500' : 'text-red-500'}`}>
              {metrics.networkHealth}
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-20 bg-white/5 border border-white/5 rounded-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STAT_CARDS.map(({ icon: Icon, label, value, color }, i) => (
            <div key={i} className="ln-stat-card group hover:scale-[1.02] transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="ln-label text-[9px]">{label}</span>
              </div>
              <div className={`text-2xl font-black font-mono ${color}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* State Root Chain */}
      {stateRoot && (
        <div className="glass rounded-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={16} className="text-orange" />
            <h4 className="ln-title text-lg">Current State Root</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted w-24 flex-shrink-0">State Root</div>
              <div className="font-mono text-xs text-orange break-all">{stateRoot.currentStateRoot}</div>
            </div>
            {stateRoot.latestBatchId && (
              <div className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted w-24 flex-shrink-0">Latest Batch</div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">#{stateRoot.latestBatchId}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    stateRoot.latestBatchStatus === 'finalized'
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : stateRoot.latestBatchStatus === 'challenge_period'
                      ? 'bg-orange/10 text-orange border-orange/20'
                      : 'bg-white/5 text-muted border-white/10'
                  }`}>
                    {stateRoot.latestBatchStatus}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gas Comparison */}
      {metrics && (
        <div className="glass rounded-sm p-6">
          <h4 className="ln-title text-lg mb-4">L1 vs L2 Gas Comparison</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="ln-label text-[10px]">L1 Direct (Ethereum)</div>
              <div className="text-2xl font-black text-red-400 font-mono">21,000 gas</div>
              <div className="text-[10px] text-muted">per transaction</div>
            </div>
            <div className="space-y-2">
              <div className="ln-label text-[10px]">L2 Batch (LayerGlide)</div>
              <div className="text-2xl font-black text-orange font-mono">
                {metrics.avgTxsPerBatch > 0
                  ? `~${Math.round(500_000 / Math.max(1, metrics.avgTxsPerBatch)).toLocaleString()} gas`
                  : '~500 gas'}
              </div>
              <div className="text-[10px] text-muted">per transaction in batch</div>
            </div>
            <div className="space-y-2">
              <div className="ln-label text-[10px]">Savings</div>
              <div className="text-2xl font-black text-green-400 font-mono">{metrics.estimatedGasSaving}</div>
              <div className="text-[10px] text-muted">per transaction · {metrics.compressionRatio} compression</div>
            </div>
          </div>
          {/* Bar comparison */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-16 text-[10px] text-muted">L1 Gas</div>
              <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-red-500/60 rounded-full" style={{ width: '100%' }} />
              </div>
              <div className="text-xs font-mono text-red-400 w-20 text-right">21,000</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 text-[10px] text-muted">L2 Batch</div>
              <div className="flex-1 bg-white/5 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-orange rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, 100 - Math.max(0, parseInt(metrics.estimatedGasSaving)))}%` }} />
              </div>
              <div className="text-xs font-mono text-orange w-20 text-right">
                {metrics.avgTxsPerBatch > 0 ? `~${Math.round(500_000 / metrics.avgTxsPerBatch)}` : '~500'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}