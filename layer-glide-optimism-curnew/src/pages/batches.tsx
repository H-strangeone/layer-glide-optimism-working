import { useEffect, useRef } from 'react';
import { BatchManager } from '@/components/BatchManager';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Package, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const BATCH_FACTS = [
  { stat: '100+', label: 'Txs per batch' },
  { stat: '<1s',  label: 'Batch finality' },
  { stat: '~95%', label: 'Gas saving' },
  { stat: 'L1',   label: 'Security anchor' },
];

export default function BatchesPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.bat-header', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
      gsap.fromTo('.bat-fact', { opacity: 0, y: 24, scale: 0.95 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.08, delay: 0.4
      });
      gsap.fromTo('.bat-main', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', delay: 0.55 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>

      {/* Header */}
      <div className="mb-10">
        <div className="bat-header tag mb-4" style={{ opacity: 0 }}>Rollup Engine</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-3">
          <h1 className="bat-header ln-title text-[clamp(3rem,6vw,6rem)]" style={{ opacity: 0 }}>
            Batch<span style={{ color: 'var(--orange)' }}>Manager.</span>
          </h1>
          <p className="bat-header text-sm mb-2" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 360, lineHeight: 1.6 }}>
            Bundle multiple Layer 2 transactions into a single optimistic batch and commit to Ethereum L1 at a fraction of the cost.
          </p>
        </div>
        <div className="h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)' }} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {BATCH_FACTS.map(({ stat, label }, i) => (
          <div key={i} className="bat-fact ln-stat-card" style={{ opacity: 0 }}>
            <div className="ln-number text-4xl mb-1" style={{ color: i === 0 ? 'var(--orange)' : 'var(--text)' }}>{stat}</div>
            <div className="ln-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── How batching works ── */}
      <div className="mb-10 glass rounded-sm p-6 stripe-left pl-8">
        <div className="ln-label mb-3">How it works</div>
        <h2 className="ln-title text-3xl mb-5">
          Optimistic <span style={{ color: 'var(--orange)' }}>Rollup Batching</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Collect Txs', desc: 'Aggregate pending L2 transactions from the mempool into a candidate batch.' },
            { step: '02', title: 'Submit to L1', desc: 'Compress the batch as calldata and submit it to the L1 rollup contract.' },
            { step: '03', title: 'Challenge Window', desc: 'A 7-day fraud-proof window opens; if no valid challenge, the batch finalises.' },
          ].map(({ step, title, desc }, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-9 h-9 rounded-sm flex items-center justify-center font-black text-sm"
                style={{ background: 'var(--orange)', color: '#0a0a0a', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {step}
              </div>
              <div>
                <p className="font-bold text-sm mb-1" style={{ fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {title}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch manager component */}
      <div className="bat-main" style={{ opacity: 0 }}>
        <div className="section-header">
          <div>
            <div className="ln-label mb-1">Active</div>
            <h2 className="ln-title text-3xl">Live Batches</h2>
          </div>
          <Package size={20} style={{ color: 'var(--muted)' }} />
        </div>
        <div className="glass rounded-sm p-6">
          <BatchManager />
        </div>
      </div>
    </div>
  );
}