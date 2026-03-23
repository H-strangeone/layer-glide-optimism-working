import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useWallet } from "@/hooks/useWallet";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ExternalLink, Loader2, ArrowUpRight, ArrowDownLeft, Box, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayEth } from '@/lib/format';

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

interface TransactionTrackerProps {
  mode: "user" | "network";
  address?: string;
  showOverview?: boolean;
}

export function TransactionTracker({ mode, address, showOverview = false }: TransactionTrackerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const targetAddress = mode === "user" ? address : undefined;
      const url = mode === "user"
        ? `http://localhost:5500/api/transactions/user/${targetAddress}`
        : "http://localhost:5500/api/transactions/network";

      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      const txs = Array.isArray(data) ? data : (data.transactions || []);
      
      const sorted = txs
        .filter((tx: any) => tx && tx.createdAt)
        .sort((a: any, b: any) => parseInt(b.createdAt) - parseInt(a.createdAt));

      setTransactions(sorted);
    } catch (error) {
      toast({ title: "Error", description: "Failed to sync logs", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "user" && !address) { setTransactions([]); setIsLoading(false); return; }
    fetchTransactions();
  }, [mode, address]);

  const StatusTag = ({ status }: { status: string }) => {
    const s = status.toLowerCase();
    const colors: Record<string, string> = {
      pending: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      verified: 'text-green-500 bg-green-500/10 border-green-500/20',
      finalized: 'text-orange bg-orange/10 border-orange/20',
      rejected: 'text-red-500 bg-red-500/10 border-red-500/20',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[s] || 'text-muted border-white/10'}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-white/5" />)}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-sm">
        <Hash size={32} className="text-muted mb-4 opacity-30" />
        <p className="ln-label text-xs">No entries found for {address?.slice(0,6)}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-orange" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{mode === "user" ? "Personal Logs" : "Global Stream"}</span>
        </div>
        <button onClick={fetchTransactions} disabled={isLoading} className="text-muted hover:text-orange transition-colors">
          <RefreshCw size={14} className={isLoading ? 'anim-spin' : ''} />
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="ln-label text-[10px] text-white/40">Event</TableHead>
              <TableHead className="ln-label text-[10px] text-white/40">Details</TableHead>
              <TableHead className="ln-label text-[10px] text-white/40">Weight</TableHead>
              <TableHead className="ln-label text-[10px] text-white/40">Status</TableHead>
              <TableHead className="ln-label text-[10px] text-white/40 text-right">Commitment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.hash} className="border-white/5 hover:bg-orange/5 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {tx.type === 'deposit' ? <ArrowDownLeft size={14} className="text-green-500" /> : <ArrowUpRight size={14} className="text-orange" />}
                    <span className="text-[10px] font-bold uppercase text-text">{tx.type || 'Transfer'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-muted">{tx.from.slice(0,6)}...{tx.from.slice(-4)} → {tx.to.slice(0,6)}...{tx.to.slice(-4)}</span>
                    <span className="text-[9px] text-muted/50">{formatDistanceToNow(new Date(tx.createdAt * 1000), { addSuffix: true })}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold font-mono text-orange">{displayEth(tx.value)} ETH</span>
                </TableCell>
                <TableCell>
                   <StatusTag status={tx.status} />
                </TableCell>
                <TableCell className="text-right">
                   {tx.batchId ? (
                     <div className="flex items-center justify-end gap-1.5 group-hover:text-orange transition-colors">
                        <Box size={10} />
                        <span className="text-[10px] font-mono">B#{tx.batchId.slice(0,4)}</span>
                     </div>
                   ) : <span className="text-muted/30">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
