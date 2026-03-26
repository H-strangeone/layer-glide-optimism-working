/**
 * AdminBatchManager.tsx — Fixed
 *
 * BUGS FIXED:
 * 1. createdAt timestamp - now handles unix seconds from backend (not ISO string)
 * 2. Shows on-chain ID (#1, #2) when available, DB UUID when not
 * 3. All 5 status values handled: pending_submission | challenge_period | finalized | rejected | failed
 * 4. txCount uses batch.txCount (set by sequencer) not transactions.length
 * 5. Challenge countdown is live (updates every second)
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWallet } from "@/hooks/useWallet";
import {
  AlertCircle, ChevronDown, CheckCircle, Clock,
  AlertTriangle, Plus, Loader2, Box, Layers
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { displayEth } from '@/lib/format';

interface BatchTransaction {
  id: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  nonce?: number;
  status: string;
  batchId?: string | null;
  createdAt: number; // unix seconds
}

interface Batch {
  id: string;               // DB UUID
  onChainId: string | null; // on-chain sequential ID
  transactionsRoot: string;
  stateRoot?: string | null;
  prevStateRoot?: string | null;
  status: string;
  submitter?: string | null;
  submittedAt?: number;
  challengeEndsAt: number | null; // unix seconds
  txCount: number;
  onChainTxHash?: string | null;
  transactions: BatchTransaction[];
  challenges?: any[];
  createdAt: number;    // unix seconds — backend converts this
  updatedAt?: number;
  timeLeftMs?: number;  // precomputed by backend
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

function statusStyle(s: string) {
  switch (s) {
    case 'finalized':          return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'challenge_period':   return 'bg-orange/10 text-orange border-orange/20';
    case 'rejected':
    case 'failed':             return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'pending_submission': return 'bg-white/5 text-muted border-white/10';
    default:                   return 'bg-white/5 text-muted border-white/10';
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    finalized:          'Finalized',
    challenge_period:   'Challenge',
    rejected:           'Rejected',
    pending_submission: 'Pending',
    failed:             'Failed',
  };
  return map[s] || s;
}

/** Convert unix seconds to "5 minutes ago" — handles both ISO strings and unix seconds */
function batchTimeAgo(createdAt: number | string | undefined): string {
  if (!createdAt) return '—';
  // If backend sends unix seconds (our fix), multiply by 1000
  // If somehow ISO string slips through, new Date() handles it too
  const ms = typeof createdAt === 'string'
    ? new Date(createdAt).getTime()
    : createdAt > 1e10
      ? createdAt              // already milliseconds
      : createdAt * 1000;      // unix seconds → ms
  try { return formatDistanceToNow(new Date(ms), { addSuffix: true }); }
  catch { return '—'; }
}

function challengeCountdown(challengeEndsAt: number | null, timeLeftMs?: number): string {
  if (!challengeEndsAt && !timeLeftMs) return '';
  const ms = timeLeftMs ?? Math.max(0, challengeEndsAt! * 1000 - Date.now());
  if (ms <= 0) return 'Finalizing...';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function AdminBatchManager({ isAdmin, isOperator = false }: { isAdmin: boolean; isOperator?: boolean }) {
  const { address, isConnected } = useWallet();
  const [batches, setBatches]             = useState<Batch[]>([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState('all');
  const [now, setNow]                     = useState(Date.now());
  const { toast } = useToast();

  // Tick every second for live countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API}/api/batches`);
      if (!res.ok) throw new Error('Fetch failed');
      setBatches(await res.json());
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to sync batches', variant: 'destructive' });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, []);

  const handleSubmitBatch = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const pendingRes = await fetch(`${API}/api/transactions/pending`);
      const pending    = await pendingRes.json();
      if (!Array.isArray(pending) || !pending.length) {
        toast({ title: 'System', description: 'No pending transactions to batch' });
        return;
      }

      // Sequencer handles batching automatically — this is just a manual trigger info
      toast({ title: 'Info', description: 'Sequencer builds batches automatically every 10s. Pending txs will be batched shortly.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const TABS = ['all', 'pending', 'challenge', 'finalized', 'rejected'] as const;

  const filtered = batches.filter(b => {
    if (activeTab === 'all')       return true;
    if (activeTab === 'pending')   return b.status === 'pending_submission';
    if (activeTab === 'challenge') return b.status === 'challenge_period';
    if (activeTab === 'finalized') return b.status === 'finalized';
    if (activeTab === 'rejected')  return b.status === 'rejected' || b.status === 'failed';
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-orange/10">
            <Layers size={20} className="text-orange" />
          </div>
          <div>
            <h3 className="ln-title text-2xl tracking-tight">Batch Governance</h3>
            <p className="ln-label text-xs">Manage cryptographic state commitments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchBatches} disabled={isLoading} variant="outline" size="sm">
            {isLoading ? <Loader2 size={14} className="anim-spin" /> : '↺'}
          </Button>
          {(isAdmin || isOperator) && (
            <Button onClick={handleSubmitBatch} disabled={isLoading} className="btn-primary px-6">
              <Plus size={16} className="mr-2" /> Trigger Batch
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TABS.slice(1).map(tab => {
          const count = batches.filter(b => {
            if (tab === 'pending')   return b.status === 'pending_submission';
            if (tab === 'challenge') return b.status === 'challenge_period';
            if (tab === 'finalized') return b.status === 'finalized';
            if (tab === 'rejected')  return b.status === 'rejected' || b.status === 'failed';
            return false;
          }).length;
          return (
            <div key={tab} className="ln-stat-card py-3">
              <div className="ln-label text-[9px] mb-1 capitalize">{tab}</div>
              <div className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{
              fontFamily:   "'Barlow Condensed', sans-serif",
              color:        activeTab === t ? 'var(--orange)' : 'var(--muted)',
              borderBottom: activeTab === t ? '2px solid var(--orange)' : '2px solid transparent',
              background:   'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Batch list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted text-sm">No batches in this category</div>
        )}

        {filtered.map(batch => {
          // Live time left calculation (ticks every second)
          const liveTimeLeftMs = batch.challengeEndsAt
            ? Math.max(0, batch.challengeEndsAt * 1000 - now)
            : (batch.timeLeftMs ?? 0);

          return (
            <div
              key={batch.id}
              className="bg-white/5 border border-white/5 rounded-sm hover:border-orange/20 transition-colors group"
            >
              <Collapsible
                open={expandedBatchId === batch.id}
                onOpenChange={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <Box size={18} className="text-muted group-hover:text-orange transition-colors flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest">
                          {/* On-chain ID when available, else mark as uncommitted */}
                          Batch {batch.onChainId ? `#${batch.onChainId}` : '[UNCOMMITTED]'}
                        </div>
                        <div className="text-[9px] font-mono text-muted/50 mt-0.5 select-all truncate max-w-xs">
                          {batch.id}
                        </div>
                        <div className="text-[9px] font-mono text-muted mt-0.5">
                          state: {(batch.stateRoot || 'pending').slice(0, 14)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[9px] text-muted">{batch.txCount} txs</span>

                      {batch.status === 'challenge_period' && batch.challengeEndsAt && (
                        <div className="text-[9px] text-orange font-bold flex items-center gap-1">
                          <Clock size={10} />
                          {challengeCountdown(batch.challengeEndsAt, liveTimeLeftMs)}
                        </div>
                      )}

                      {/* Timestamp — using batchTimeAgo which handles unix seconds */}
                      <span className="text-[9px] text-muted hidden md:block">
                        {batchTimeAgo(batch.createdAt)}
                      </span>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusStyle(batch.status)}`}>
                        {statusLabel(batch.status)}
                      </span>

                      <CollapsibleTrigger asChild>
                        <button>
                          <ChevronDown
                            size={14}
                            className={`text-muted transition-transform ${expandedBatchId === batch.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="border-t border-white/5 p-4 space-y-3">
                    {/* Roots */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">State Root (after)</div>
                        <div className="text-[9px] font-mono text-orange break-all">{batch.stateRoot || '—'}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">Prev State Root</div>
                        <div className="text-[9px] font-mono text-muted break-all">{batch.prevStateRoot || 'genesis'}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">TX Root</div>
                        <div className="text-[9px] font-mono text-muted break-all">{batch.transactionsRoot || '—'}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">DB UUID (for fraud proof)</div>
                        <div className="text-[9px] font-mono text-muted break-all select-all">{batch.id}</div>
                      </div>
                    </div>

                    {/* Transactions */}
                    {batch.transactions?.length > 0 && (
                      <div>
                        <div className="ln-label text-[9px] mb-2">
                          {batch.transactions.length} transaction{batch.transactions.length !== 1 ? 's' : ''}
                          {' '}(txCount from sequencer: {batch.txCount})
                        </div>
                        <Table>
                          <TableBody>
                            {batch.transactions.map((tx) => (
                              <TableRow key={tx.id} className="border-white/5">
                                <TableCell className="text-[9px] font-mono text-muted">
                                  {tx.fromAddress?.slice(0, 10)}...{tx.fromAddress?.slice(-4)}
                                  {' → '}
                                  {tx.toAddress?.slice(0, 10)}...{tx.toAddress?.slice(-4)}
                                </TableCell>
                                <TableCell className="text-[9px] font-mono text-muted">
                                  nonce #{tx.nonce ?? 0}
                                </TableCell>
                                <TableCell className="text-[9px] font-bold text-orange text-right">
                                  {displayEth(tx.valueWei)} ETH
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}