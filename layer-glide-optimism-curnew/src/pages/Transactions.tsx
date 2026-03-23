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
    // ✅ Fetch transactions
const txRes = await fetch(`http://localhost:5500/api/transactions/user/${addr}`);
if (!txRes.ok) throw new Error(txRes.statusText);
const { transactions: txs } = await txRes.json();

// ✅ Fetch correct balance (SOURCE OF TRUTH)
const balRes = await fetch(`http://localhost:5500/api/balance/${addr}`);
if (!balRes.ok) throw new Error(balRes.statusText);
const balData = await balRes.json();

setBalance(balData.layer2Balance || '0');

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
      )}
    </div>
  );
}
