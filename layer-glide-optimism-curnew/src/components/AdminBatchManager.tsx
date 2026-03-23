import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getContract } from "@/lib/ethers";
import { useWallet } from "@/hooks/useWallet";
import {
  AlertCircle, ChevronDown, ChevronRight, CheckCircle, Clock,
  AlertTriangle, Plus, Loader2, XCircle, CheckCircle2, Package, Box, Layers
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEther } from 'ethers';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BatchTransaction {
  id: string; fromAddress: string; toAddress: string; valueWei: string;
  status: string; batchId: string | null; createdAt: string;
}

interface Batch {
  id: string; onChainId: string | null; transactionsRoot: string;
  status: string; submitter: string | null; submittedAt: string;
  challengeEndsAt: string | null; txCount: number; onChainTxHash: string | null;
  transactions: BatchTransaction[]; challenges?: any[]; createdAt: string; updatedAt: string;
}

const displayEth = (weiStr: string): string => {
  if (!weiStr || weiStr === '0') return '0';
  try {
    const n = BigInt(weiStr);
    if (n < 1_000_000_000n) return `${weiStr} ETH`;
    return `${formatEther(n)} ETH`;
  } catch { return `${weiStr} ETH`; }
};

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

export default function AdminBatchManager({ isAdmin, isOperator = false }: { isAdmin: boolean; isOperator?: boolean }) {
  const { address, isConnected } = useWallet();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API}/api/batches`);
      if (!res.ok) throw new Error('Fetch failed');
      setBatches(await res.json());
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to sync batches', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchBatches(); }, []);

  const handleSubmitBatch = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const pendingRes = await fetch(`${API}/api/transactions/pending`);
      const pending = await pendingRes.json();
      if (!pending.length) { toast({ title: 'System', description: 'Zero pending transactions' }); return; }

      const submitRes = await fetch(`${API}/api/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: pending }),
      });
      if (!submitRes.ok) throw new Error('Submission failed');
      toast({ title: 'Success', description: 'Batch committed and broadcast' });
      await fetchBatches();
    } catch (err) {
      toast({ title: 'Error', description: 'Commit failed', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const getStatusTag = (status: string) => {
    const s = status.toLowerCase();
    const map: Record<string, string> = {
        rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
        finalized: 'bg-green-500/10 text-green-500 border-green-500/20',
        challenge_period: 'bg-orange/10 text-orange border-orange/20',
        pending_submission: 'bg-white/5 text-muted border-white/10',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${map[s] || 'text-muted'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const filtered = batches.filter(b => activeTab === 'all' || b.status.includes(activeTab));

  return (
    <div className="space-y-8">
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
        <Button onClick={handleSubmitBatch} disabled={isLoading} className="btn-primary px-8">
           {isLoading ? <Loader2 size={16} className="anim-spin mr-2" /> : <Plus size={16} className="mr-2" />}
           Commit New Batch
        </Button>
      </div>

      <div className="space-y-4">
        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 p-1 rounded-sm border border-white/5 mb-6">
            {['all', 'pending', 'challenge', 'finalized', 'rejected'].map(t => (
                <TabsTrigger key={t} value={t} className="px-6 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-orange transition-all">
                  {t}
                </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-3">
            {filtered.map(batch => (
                <div key={batch.id} className="bg-white/5 border border-white/5 rounded-sm p-5 hover:border-orange/20 transition-colors group">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <Box size={20} className="text-muted group-hover:text-orange transition-colors" />
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-text">
                            Batch {batch.onChainId ? `#${batch.onChainId}` : `[UNCOMMITTED]`}
                          </div>
                          <div className="text-[10px] font-mono text-muted">Root: {batch.transactionsRoot.slice(0, 16)}...</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        {batch.challengeEndsAt && (
                           <div className="text-[10px] text-orange font-bold uppercase tracking-widest flex items-center gap-2">
                              <Clock size={12} /> {formatDistanceToNow(new Date(batch.challengeEndsAt), { addSuffix: true })}
                           </div>
                        )}
                        {getStatusTag(batch.status)}
                     </div>
                   </div>

                   <Collapsible open={expandedBatchId === batch.id} onOpenChange={() => setExpandedBatchId(expandedBatchId === batch.id ? null : batch.id)}>
                      <CollapsibleTrigger className="w-full text-left pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase text-muted hover:text-orange transition-colors">
                         View {batch.txCount} Transmissions
                         <ChevronDown size={14} className={`transform transition-transform ${expandedBatchId === batch.id ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 overflow-x-auto">
                        <Table>
                          <TableBody>
                            {batch.transactions.map(tx => (
                                <TableRow key={tx.id} className="border-white/5">
                                  <TableCell className="text-[10px] font-mono text-muted">{tx.fromAddress.slice(0,10)}... → {tx.toAddress.slice(0,10)}...</TableCell>
                                  <TableCell className="text-[10px] font-bold text-orange text-right">{displayEth(tx.valueWei)}</TableCell>
                                </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                   </Collapsible>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}