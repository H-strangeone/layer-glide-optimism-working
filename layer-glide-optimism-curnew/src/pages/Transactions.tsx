<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import { BatchManager } from "@/components/BatchManager";
import { TransactionTracker } from "@/components/TransactionTracker";
import { toast } from "@/components/ui/use-toast";
import { ArrowUpRight, ArrowDownLeft, Users, Wallet, Search, Loader2 } from "lucide-react";
import { formatEther } from "ethers";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Transaction {
  hash: string; from: string; to: string; value: string;
  status: string; createdAt: number; batchId?: string;
}

export default function Transactions() {
  const [searchAddress, setSearchAddress] = useState('');
  const [balance, setBalance]             = useState('0');
  const [isSearching, setIsSearching]     = useState(false);
  const [activeTab, setActiveTab]         = useState<'overview'|'transactions'|'batches'>('overview');
  const [stats, setStats] = useState({ sent: '0', received: '0', batches: 0 });
  const [hasSearched, setHasSearched]     = useState(false);

  const pageRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const statsRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.tx-header', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
      gsap.fromTo(searchRef.current, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.3 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!hasSearched) return;
    gsap.fromTo('.stat-box', { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08 });
    gsap.fromTo('.tab-section', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: 0.35 });
  }, [hasSearched]);

  const fetchData = async (addr: string) => {
    const r = await fetch(`http://localhost:5500/api/transactions/user/${addr}`);
    if (!r.ok) throw new Error(r.statusText);
    const { transactions: txs, balance: bal } = await r.json();
    setBalance(bal || '0');

    let sent = BigInt(0), received = BigInt(0);
    const batchSet = new Set<string>();
    if (Array.isArray(txs)) {
      txs.forEach((tx: Transaction) => {
        try {
          const v = tx.value ? BigInt(tx.value) : BigInt(0);
          if (tx.from?.toLowerCase() === addr.toLowerCase()) { sent += v; if (tx.batchId) batchSet.add(tx.batchId); }
          if (tx.to?.toLowerCase() === addr.toLowerCase()) received += v;
          if (tx.batchId) batchSet.add(tx.batchId);
        } catch {}
      });
    }
    setStats({ sent: formatEther(sent.toString()), received: formatEther(received.toString()), batches: batchSet.size });
  };

  const handleSearch = async () => {
    if (!searchAddress.trim()) {
      toast({ title: 'Enter an address', variant: 'destructive' }); return;
    }
    setIsSearching(true);
    try {
      await fetchData(searchAddress.trim());
      setHasSearched(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setIsSearching(false); }
  };

  const STAT_ITEMS = [
    { icon: Wallet,        label: 'L2 Balance',    value: `${Number(balance).toFixed(4)} ETH`, color: 'var(--orange)' },
    { icon: ArrowUpRight,  label: 'Total Sent',    value: `${Number(stats.sent).toFixed(4)} ETH`, color: '#d96060' },
    { icon: ArrowDownLeft, label: 'Total Received', value: `${Number(stats.received).toFixed(4)} ETH`, color: '#5db87a' },
    { icon: Users,         label: 'Batch Activity', value: `${stats.batches} Batches`, color: 'var(--orange)' },
  ];

  const TABS: { id: 'overview'|'transactions'|'batches'; label: string }[] = [
    { id: 'overview',      label: 'Overview' },
    { id: 'transactions',  label: 'Transactions' },
    { id: 'batches',       label: 'Batches' },
  ];

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>

      {/* ── Page header ── */}
      <div className="mb-12">
        <div className="tx-header tag mb-4" style={{ opacity: 0 }}>Transaction Explorer</div>
        <h1 className="tx-header ln-title text-[clamp(3rem,6vw,6rem)] mb-3" style={{ opacity: 0 }}>
          Explorer<span style={{ color: 'var(--orange)' }}>.</span>
        </h1>
        <p className="tx-header text-base" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 500 }}>
          Search any wallet address to inspect its Layer 2 balance, transaction history, and batch participation.
        </p>
        <div className="mt-5 h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)', width: '100%' }} />
      </div>

      {/* ── Search block ── */}
      <div ref={searchRef} className="mb-10" style={{ opacity: 0 }}>
        <div className="glass rounded-sm p-6">
          <div className="ln-label mb-3">Search Wallet</div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input
                className="ln-input pl-9"
                placeholder="0x... wallet address"
                value={searchAddress}
                onChange={e => setSearchAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                disabled={isSearching}
              />
            </div>
            <button onClick={handleSearch} disabled={isSearching} className="btn-primary px-8">
              {isSearching ? <Loader2 size={16} className="anim-spin" /> : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats + Tabs ── */}
      {hasSearched && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {STAT_ITEMS.map(({ icon: Icon, label, value, color }, i) => (
              <div key={i} className="stat-box ln-stat-card" style={{ opacity: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={15} style={{ color }} />
                  <span className="ln-label">{label}</span>
                </div>
                <div className="ln-number text-3xl" style={{ color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="tab-section" style={{ opacity: 0 }}>
            <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="relative px-5 py-3 text-sm font-semibold transition-colors duration-200"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: activeTab === id ? 'var(--orange)' : 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                  {activeTab === id && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'var(--orange)' }} />
                  )}
                </button>
              ))}
            </div>

            <div className="glass rounded-sm p-6">
              {activeTab === 'overview'     && <TransactionTracker mode="user" address={searchAddress} showOverview />}
              {activeTab === 'transactions' && <TransactionTracker mode="user" address={searchAddress} />}
              {activeTab === 'batches'      && <BatchManager address={searchAddress} />}
            </div>
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Search size={40} style={{ color: 'var(--muted)' }} />
          <p className="ln-label">Enter a wallet address above to explore</p>
        </div>
=======
import { useState, useEffect } from 'react';
import { BatchManager } from "@/components/BatchManager";
import { TransactionTracker } from "@/components/TransactionTracker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getLayer2Balance, getContract } from "@/lib/ethers";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowUpRight, ArrowDownLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEther } from "ethers";

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: string;
  createdAt: number;
  batchId?: string;
  type?: string;
  isInBatch?: boolean;
}

interface Batch {
  id: string;
  transactions: Transaction[];
  status: string;
  createdAt: number;
}

export default function Transactions() {
  const [searchAddress, setSearchAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState({
    totalSent: "0",
    totalReceived: "0",
    batchesCreated: 0,
    batchesParticipated: 0
  });

  const fetchTransactionData = async (address: string) => {
    try {
      // Fetch user transactions and balance
      const txResponse = await fetch(`http://localhost:5500/api/transactions/user/${address}`);
      if (!txResponse.ok) {
        throw new Error(`Failed to fetch transactions: ${txResponse.statusText}`);
      }
      const { transactions: txData, balance: l2Balance } = await txResponse.json();
      console.log('Raw transaction data:', txData);
      console.log('Layer 2 balance:', l2Balance);

      setTransactions(txData);
      setBalance(l2Balance || "0");

      // Calculate statistics
      let sent = BigInt(0);
      let received = BigInt(0);
      const batchesCreatedSet = new Set();
      const batchesParticipatedSet = new Set();

      if (Array.isArray(txData)) {
        txData.forEach((tx: Transaction) => {
          if (!tx) return;

          try {
            if (tx.from?.toLowerCase() === address.toLowerCase()) {
              const value = tx.value ? BigInt(tx.value) : BigInt(0);
              sent += value;
              if (tx.batchId) batchesCreatedSet.add(tx.batchId);
            }
            if (tx.to?.toLowerCase() === address.toLowerCase()) {
              const value = tx.value ? BigInt(tx.value) : BigInt(0);
              received += value;
            }
            if (tx.batchId) {
              batchesParticipatedSet.add(tx.batchId);
            }
          } catch (error) {
            console.error('Error processing transaction:', tx, error);
          }
        });
      }

      console.log('Stats calculation:', {
        sent: sent.toString(),
        received: received.toString(),
        batchesCreated: batchesCreatedSet.size,
        batchesParticipated: batchesParticipatedSet.size
      });

      setStats({
        totalSent: formatEther(sent.toString()),
        totalReceived: formatEther(received.toString()),
        batchesCreated: batchesCreatedSet.size,
        batchesParticipated: batchesParticipatedSet.size
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction data: " + (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchAddress) {
      toast({
        title: "Invalid Input",
        description: "Please enter a wallet address",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      await fetchTransactionData(searchAddress);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-primary">Transactions</h1>
      <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
        <CardHeader>
          <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Search Transactions
          </CardTitle>
          <CardDescription className="text-white/70">
            View transaction history and balance for any wallet address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Enter wallet address (0x...)"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="bg-white/5 border-white/10 text-white flex-1"
              disabled={isSearching}
            />
            <Button
              onClick={handleSearch}
              className="bg-purple-500 hover:bg-purple-600"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {searchAddress && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Layer 2 Balance Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="text-sm text-white/70 mb-1">Layer 2 Balance</div>
                    <div className="text-xl font-medium text-white">
                      {Number(balance).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Total Sent Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-red-400" />
                      <div className="text-sm text-white/70">Total Sent</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {Number(stats.totalSent).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Total Received Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-green-400" />
                      <div className="text-sm text-white/70">Total Received</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {Number(stats.totalReceived).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Batch Participation Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      <div className="text-sm text-white/70">Batch Activity</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {stats.batchesParticipated} Batches
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {searchAddress && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500/20">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-purple-500/20">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="batches" className="data-[state=active]:bg-purple-500/20">
              Batches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <TransactionTracker mode="user" address={searchAddress} showOverview />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionTracker mode="user" address={searchAddress} />
          </TabsContent>

          <TabsContent value="batches">
            <BatchManager address={searchAddress} />
          </TabsContent>
        </Tabs>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
      )}
    </div>
  );
}
