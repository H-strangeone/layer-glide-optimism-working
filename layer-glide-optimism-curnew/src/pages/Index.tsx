import { useAccount } from "wagmi";
import { useState, useEffect, useRef } from "react";
import DepositCard from "@/components/DepositCard";
import NetworkStatus from "@/components/NetworkStatus";
import { TransactionTracker } from "@/components/TransactionTracker";
import BatchSubmission from "@/components/BatchSubmission";
import { SingleTransaction } from '@/components/SingleTransaction';
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Zap, Shield, ArrowRight, Layers, Activity, Clock, Box, Send, Database, Layout } from 'lucide-react';
 
gsap.registerPlugin(ScrollTrigger);
 
const FEATURES = [
  { icon: Zap,      label: 'Instant Transfers',     desc: 'Sub-second transaction finality on L2 with full Ethereum security beneath.' },
  { icon: Shield,   label: 'Fraud Proof System',    desc: 'Optimistic rollup architecture with on-chain dispute resolution.' },
  { icon: Layers,   label: 'Batch Processing',      desc: 'Aggregate hundreds of transactions into a single L1 calldata batch.' },
  { icon: Activity, label: 'Live Monitoring',        desc: 'Real-time network status, transaction tracking, and Merkle state.' },
  { icon: Clock,    label: 'Fast Withdrawals',      desc: 'Initiate L2→L1 exits seamlessly from the dashboard.' },
  { icon: Layout,   label: 'Open & Permissionless', desc: 'Any wallet can deposit, transfer, and withdraw — no gatekeeping.' },
];
 
export default function Index() {
  const { address } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { isConnected } = useWallet();
  const [activeAction, setActiveAction] = useState<'deposit' | 'transfer' | 'batch'>('deposit');
 
  const containerRef    = useRef<HTMLDivElement>(null);
  const lineRef         = useRef<HTMLDivElement>(null);
  const actionsRef      = useRef<HTMLDivElement>(null);
  const networkRef      = useRef<HTMLDivElement>(null);
  const actionContentRef = useRef<HTMLDivElement>(null);
  const trackerRef      = useRef<HTMLDivElement>(null);
  const featuresRef     = useRef<HTMLDivElement>(null);
 
  // Hero entrance (fires immediately on connect)
  useEffect(() => {
    if (!isConnected) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-tag',   { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 });
      gsap.fromTo('.hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.1 });
      gsap.fromTo('.hero-sub',   { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.3 });
      gsap.fromTo(lineRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut', delay: 0.4 });
 
      // Scroll-triggered fades for all sections below the fold
      gsap.fromTo(networkRef.current,
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.75,
          scrollTrigger: { trigger: networkRef.current, start: 'top 87%', once: true } }
      );
      gsap.fromTo(actionsRef.current,
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.75,
          scrollTrigger: { trigger: actionsRef.current, start: 'top 87%', once: true } }
      );
      gsap.fromTo(trackerRef.current,
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.75,
          scrollTrigger: { trigger: trackerRef.current, start: 'top 87%', once: true } }
      );
      // Feature cards stagger on scroll
      gsap.fromTo('.feature-card',
        { opacity: 0, y: 28, scale: 0.96 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: featuresRef.current, start: 'top 88%', once: true },
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [isConnected]);
 
  // Action tab content transition
  useEffect(() => {
    if (actionContentRef.current) {
      const tl = gsap.timeline();
      tl.to(actionContentRef.current, { opacity: 0, y: 10, duration: 0.15, ease: 'power2.in' })
        .set(actionContentRef.current, { y: -10 })
        .to(actionContentRef.current, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    }
  }, [activeAction]);
 
  const handleSuccess = (transaction: any) => {
    console.log("Transaction successful:", transaction);
    // No extra API calls — state is managed by the backend
  };
 
  if (!isConnected) {
    return (
      <div className="relative min-h-[90vh] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(232,97,26,0.06) 0%, transparent 60%)' }} />
        <div className="relative z-10 space-y-8 max-w-4xl">
          <div className="inline-block p-1 px-3 glass rounded-full border-accent-orange/20 anim-fade-up">
            <span className="text-[10px] font-bold text-orange uppercase tracking-widest">Optimistic Scaling · Ready to Race</span>
          </div>
          <h1 className="ln-title text-[clamp(4rem,12vw,10rem)] leading-[0.85] tracking-tighter anim-fade-up" style={{ animationDelay: '0.1s' }}>
            Fastest <span style={{ color: 'var(--orange)' }}>Ethereum</span><br />Scaling Engine
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-muted anim-fade-up" style={{ animationDelay: '0.2s' }}>
            Experience sub-second finality with full Ethereum security. Connect your wallet to access the control center.
          </p>
          <div className="pt-6 anim-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="w-24 h-1 bg-orange mx-auto mb-10 rounded-full" />
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-muted italic">Awaiting telemetry connection...</div>
          </div>
        </div>
        <div className="mt-24 grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full anim-fade-up" style={{ animationDelay: '0.4s' }}>
          {FEATURES.slice(0, 3).map((f, i) => (
            <div key={i} className="glass p-6 rounded-sm text-left group hover:border-orange/30 transition-colors">
              <f.icon className="text-orange mb-4 group-hover:scale-110 transition-transform" size={20} />
              <h4 className="ln-title text-sm mb-1">{f.label}</h4>
              <p className="text-[10px] text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
 
  return (
    <div ref={containerRef} className="space-y-32 pb-32">
      {/* Hero */}
      <section className="pt-12">
        <div className="hero-tag tag mb-6" style={{ opacity: 0 }}>Driver Dashboard</div>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-8">
          <h1 className="hero-title ln-title text-[clamp(4rem,8vw,12rem)] leading-[0.85] tracking-tighter" style={{ opacity: 0 }}>
            Welcome to<br /><span style={{ color: 'var(--orange)' }}>LayerGlide.</span>
          </h1>
          <div className="max-w-xs space-y-4 mb-4 hero-sub" style={{ opacity: 0 }}>
            <p className="text-sm text-muted leading-relaxed">
              Real-time Layer 2 monitoring and high-speed asset bridging. Optimized for precision and performance.
            </p>
            <div className="flex gap-4">
              <div className="flex-1 p-3 bg-white/5 border border-white/5 rounded-sm">
                <div className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1">State</div>
                <div className="text-xs font-bold text-orange flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange anim-pulse-orange" />
                  Synced
                </div>
              </div>
              <div className="flex-1 p-3 bg-white/5 border border-white/5 rounded-sm">
                <div className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1">Uptime</div>
                <div className="text-xs font-bold">100.0%</div>
              </div>
            </div>
          </div>
        </div>
        <div ref={lineRef} className="h-0.5 w-full bg-gradient-to-r from-orange to-transparent opacity-0" />
      </section>
 
      {/* Network Status — scroll fade */}
      <section ref={networkRef} className="space-y-6" style={{ opacity: 0 }}>
        <div className="flex items-center gap-4 mb-2">
          <Activity size={20} className="text-orange" />
          <h2 className="ln-title text-3xl">Live Telemetry</h2>
        </div>
        <NetworkStatus />
      </section>
 
      {/* Actions — scroll fade */}
      <section ref={actionsRef} className="space-y-10" style={{ opacity: 0 }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
          <div>
            <div className="ln-label mb-2">Transact</div>
            <h2 className="ln-title text-4xl">Platform <span style={{ color: 'var(--orange)' }}>Actions.</span></h2>
          </div>
          <div className="flex bg-white/5 p-1 rounded-sm border border-white/5">
            {[
              { id: 'deposit' as const,  label: 'L1 Bridge',    icon: Database },
              { id: 'transfer' as const, label: 'L2 Transfer',  icon: Send },
              { id: 'batch' as const,    label: 'Batch Commit', icon: Box },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAction(tab.id)}
                className={`flex items-center gap-2 px-6 py-2 rounded-sm text-xs font-black uppercase tracking-[0.1em] transition-all duration-300 ${
                  activeAction === tab.id
                    ? 'bg-orange text-black shadow-lg shadow-orange/20'
                    : 'text-muted hover:text-text hover:bg-white/5'
                }`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <tab.icon size={13} className={activeAction === tab.id ? 'text-black' : 'text-orange'} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="glass rounded-sm p-10 min-h-[440px] relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange/5 via-transparent to-transparent pointer-events-none" />
          <div ref={actionContentRef} className="relative z-10">
            {activeAction === 'deposit'  && <DepositCard onSuccess={handleSuccess} />}
            {activeAction === 'transfer' && <SingleTransaction onSuccess={handleSuccess} />}
            {activeAction === 'batch'    && <BatchSubmission onSuccess={handleSuccess} />}
          </div>
        </div>
      </section>
 
      {/* Tracker — scroll fade */}
      {address && (
        <section ref={trackerRef} className="space-y-8" style={{ opacity: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Clock size={20} className="text-orange" />
              <h2 className="ln-title text-3xl">Mission Logs</h2>
            </div>
            <div className="tag">Recent Events</div>
          </div>
          <div className="glass rounded-sm p-10">
            <TransactionTracker mode="user" address={address} key={refreshTrigger} />
          </div>
        </section>
      )}
 
      {/* Features — scroll fade stagger */}
      <section ref={featuresRef} className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <div key={i} className="feature-card p-8 bg-white/5 border border-white/5 rounded-sm group hover:border-orange/20 transition-all duration-300" style={{ opacity: 0 }}>
            <f.icon className="text-orange/40 group-hover:text-orange mb-6 transition-colors group-hover:scale-110 transition-transform" size={20} />
            <h4 className="text-[12px] font-bold uppercase tracking-widest text-text mb-3">{f.label}</h4>
            <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
 