/**
 * BatchManager.tsx — Fixed
 *
 * BUGS FIXED:
 * 1. "56 years ago" — was doing parseInt(isoString) → tiny number.
 *    Now backend sends unix seconds, we multiply by 1000 for Date().
 * 2. Batch ID showed DB UUID (#dcb1db...7591) — now shows on-chain ID (#5) or DB short
 * 3. Batches not showing — status filter now handles all status values
 * 4. "1 transaction" chip on all batches — was using wrong field
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@/hooks/useWallet';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Package, ChevronDown, ChevronUp, Box, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { displayEth, formatAddress } from '@/lib/format';

interface Transaction {
  id: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  status: string;
  batchId?: string | null;
  createdAt: number;   
  nonce?: number  // unix seconds from backend
}

interface Batch {
  id: string;                    // DB UUID
  onChainId: string | null;      // on-chain sequential ID (#1, #2...)
  transactionsRoot: string;
  stateRoot?: string | null;
  prevStateRoot?: string | null;
  status: string;
  txCount: number;
  challengeEndsAt: number | null; // unix seconds
  createdAt: number;             // unix seconds — FIXED
  submitter?: string | null;
  transactions: Transaction[];
  timeLeftMs?: number;           // precomputed by backend
}

interface BatchManagerProps {
  address?: string;
}

/** Map backend status → display label + color */
function getStatusInfo(status: string): { label: string; className: string } {
  switch (status?.toLowerCase()) {
    case 'finalized':
      return { label: 'Finalized', className: 'bg-green-500/10 text-green-500 border-green-500/20' };
    case 'challenge_period':
      return { label: 'Challenge', className: 'bg-orange/10 text-orange border-orange/20' };
    case 'rejected':
      return { label: 'Rejected', className: 'bg-red-500/10 text-red-500 border-red-500/20' };
    case 'pending_submission':
      return { label: 'Pending', className: 'bg-white/5 text-muted border-white/10' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' };
    default:
      return { label: status || 'Unknown', className: 'bg-white/5 text-muted border-white/10' };
  }
}

/** Convert unix seconds → human readable "5 minutes ago" */
function timeAgo(unixSec: number | string | undefined): string {
  if (!unixSec) return '—';
  const sec = typeof unixSec === 'string' ? parseInt(unixSec) : unixSec;
  // If it looks like it's already milliseconds (> year 2000 in ms), use directly
  const ms = sec > 1e10 ? sec : sec * 1000;
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return '—';
  }
}

/** Format challenge countdown */
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

export function BatchManager({ address }: BatchManagerProps) {
  const [batches, setBatches]         = useState<Batch[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<string>('all');
  const { toast } = useToast();
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const url = address
        ? `${API}/api/batches/user/${address}`
        : `${API}/api/batches`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data: Batch[] = await res.json();
      setBatches(data);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBatches(); }, [address]);

  // Tab filtering
  const TABS = ['all', 'pending', 'challenge', 'finalized', 'rejected'] as const;
  const filtered = batches.filter(b => {
    if (activeTab === 'all')       return true;
    if (activeTab === 'pending')   return b.status === 'pending_submission';
    if (activeTab === 'challenge') return b.status === 'challenge_period';
    if (activeTab === 'finalized') return b.status === 'finalized';
    if (activeTab === 'rejected')  return b.status === 'rejected' || b.status === 'failed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 anim-spin text-orange" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 bg-white/5 rounded-sm border border-white/5 gap-3">
        <Package size={32} className="text-muted opacity-30" />
        <p className="ln-label text-xs">
          {address ? `No batches for ${formatAddress(address)}` : 'No batches submitted yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-0 border-b border-white/5">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{
              fontFamily:   "'Barlow Condensed', sans-serif",
              color:        activeTab === tab ? 'var(--orange)' : 'var(--muted)',
              borderBottom: activeTab === tab ? '2px solid var(--orange)' : '2px solid transparent',
              background:   'none',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted text-sm">No batches in this category</p>
      )}

      {filtered.map(batch => {
        const { label, className } = getStatusInfo(batch.status);
        // Batch label: prefer on-chain sequential ID, fallback to short DB UUID
        const batchLabel = batch.onChainId
          ? `#${batch.onChainId}`
          : `[UNCOMMITTED] ${batch.id.slice(0, 8)}...`;

        return (
          <div
            key={batch.id}
            className="bg-white/5 border border-white/5 rounded-sm hover:border-orange/20 transition-colors group"
          >
            {/* Header row */}
            <div
              className="p-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Box size={18} className="text-muted group-hover:text-orange transition-colors flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-widest">
                      Batch {batchLabel}
                    </div>
                    {/* Show full DB UUID for manual fraud proof use */}
                    <div className="text-[9px] font-mono text-muted/50 mt-0.5 truncate">
                      UUID: {batch.id}
                    </div>
                    <div className="text-[9px] font-mono text-muted mt-0.5">
                      stateRoot: {batch.stateRoot ? batch.stateRoot.slice(0, 14) + '...' : 'pending'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[9px] text-muted">
                    {/* txCount is the accurate count from sequencer */}
                    {batch.txCount || batch.transactions?.length || 0} txs
                  </span>

                  {/* Challenge countdown */}
                  {batch.status === 'challenge_period' && batch.challengeEndsAt && (
                    <div className="text-[9px] text-orange font-bold flex items-center gap-1">
                      <Clock size={10} />
                      {challengeCountdown(batch.challengeEndsAt, batch.timeLeftMs)}
                    </div>
                  )}

                  {/* Timestamp — FIXED: createdAt is now unix seconds from backend */}
                  <span className="text-[9px] text-muted hidden sm:block">
                    {timeAgo(batch.createdAt)}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${className}`}>
                    {label}
                  </span>

                  <ChevronDown
                    size={14}
                    className={`text-muted transition-transform ${expandedId === batch.id ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            <Collapsible open={expandedId === batch.id}>
              <CollapsibleContent>
                <div className="border-t border-white/5 p-4 space-y-3">
                  {/* Full IDs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-sm">
                      <div className="ln-label text-[9px] mb-1">On-chain Batch ID</div>
                      <div className="text-[10px] font-mono text-orange">
                        {batch.onChainId ? `#${batch.onChainId}` : 'Not yet submitted to chain'}
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-sm">
                      <div className="ln-label text-[9px] mb-1">DB UUID (for fraud proof API)</div>
                      <div className="text-[10px] font-mono text-muted break-all select-all">
                        {batch.id}
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-sm">
                      <div className="ln-label text-[9px] mb-1">TX Root</div>
                      <div className="text-[10px] font-mono text-muted break-all">
                        {batch.transactionsRoot || '—'}
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-sm">
                      <div className="ln-label text-[9px] mb-1">State Root</div>
                      <div className="text-[10px] font-mono text-muted break-all">
                        {batch.stateRoot || '—'}
                      </div>
                    </div>
                    {batch.prevStateRoot && (
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">Prev State Root</div>
                        <div className="text-[10px] font-mono text-muted/60 break-all">
                          {batch.prevStateRoot}
                        </div>
                      </div>
                    )}
                    {batch.submitter && (
                      <div className="p-3 bg-white/5 rounded-sm">
                        <div className="ln-label text-[9px] mb-1">Submitter</div>
                        <div className="text-[10px] font-mono text-muted">{batch.submitter}</div>
                      </div>
                    )}
                  </div>

                  {/* Transactions */}
                  {batch.transactions?.length > 0 && (
                    <div>
                      <div className="ln-label text-[9px] mb-2">
                        {batch.transactions.length} transaction{batch.transactions.length !== 1 ? 's' : ''}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/5">
                              <TableHead className="text-[9px]">From</TableHead>
                              <TableHead className="text-[9px]">To</TableHead>
                              <TableHead className="text-[9px]">Amount</TableHead>
                              <TableHead className="text-[9px]">Nonce</TableHead>
                              <TableHead className="text-[9px]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batch.transactions.map((tx) => (
                              <TableRow key={tx.id} className="border-white/5">
                                <TableCell className="text-[9px] font-mono">
                                  {tx.fromAddress?.slice(0, 8)}...{tx.fromAddress?.slice(-4)}
                                </TableCell>
                                <TableCell className="text-[9px] font-mono">
                                  {tx.toAddress?.slice(0, 8)}...{tx.toAddress?.slice(-4)}
                                </TableCell>
                                <TableCell className="text-[9px] font-bold text-orange">
                                  {displayEth(tx.valueWei)} ETH
                                </TableCell>
                                <TableCell className="text-[9px] text-muted">
                                  #{tx.nonce ?? 0}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${getStatusInfo(tx.status).className}`}>
                                    {getStatusInfo(tx.status).label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}