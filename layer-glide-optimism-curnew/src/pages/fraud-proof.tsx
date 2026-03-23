import React, { useEffect, useRef } from 'react';
import FraudProof from '../components/FraudProof';
import gsap from 'gsap';
import { ShieldAlert, ShieldCheck, FileSearch, AlertTriangle } from 'lucide-react';

const HOW_IT_WORKS = [
  { icon: FileSearch,   title: 'Identify Dispute',   desc: 'Detect a state transition you believe to be invalid on Layer 2.' },
  { icon: AlertTriangle, title: 'Submit Evidence',   desc: 'Provide the transaction hash, merkle proof, and your counter-state.' },
  { icon: ShieldAlert,  title: 'Challenge Window',   desc: 'The 7-day challenge window opens. Anyone can verify the claim.' },
  { icon: ShieldCheck,  title: 'Resolution',          desc: 'Contract re-executes disputed tx on L1; invalid party is slashed.' },
];

const FraudProofPage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.fp-header', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
      gsap.fromTo('.fp-card', { opacity: 0, y: 28, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.1, delay: 0.4
      });
      gsap.fromTo('.fp-form', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', delay: 0.6 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>

      {/* Header */}
      <div className="mb-12">
        <div className="fp-header tag mb-4" style={{ opacity: 0 }}>Dispute Resolution</div>
        <h1 className="fp-header ln-title text-[clamp(3rem,6vw,6rem)] mb-3" style={{ opacity: 0 }}>
          Fraud<span style={{ color: 'var(--orange)' }}>Proof.</span>
        </h1>
        <p className="fp-header text-base" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 560 }}>
          The fraud-proof system is the backbone of the optimistic rollup's security model. Any party can challenge a malicious or erroneous state transition within the challenge window.
        </p>
        <div className="mt-5 h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)', width: '100%' }} />
      </div>

      {/* Warning banner */}
      <div className="fp-header mb-10 flex gap-3 p-4 rounded-sm" style={{ opacity: 0, background: 'rgba(217,96,96,0.08)', border: '1px solid rgba(217,96,96,0.22)' }}>
        <AlertTriangle size={18} style={{ color: '#d96060', flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: '#d96060', lineHeight: 1.6 }}>
          <strong>Important:</strong> Only submit a fraud proof if you have verifiable evidence of an invalid state transition. Submitting fraudulent proofs is punishable by stake slashing.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-10">
        <div className="section-header">
          <div>
            <div className="ln-label mb-1">Mechanism</div>
            <h2 className="ln-title text-3xl">How Fraud Proofs Work</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="fp-card ln-card p-5 group" style={{ opacity: 0, cursor: 'default' }}>
              <div className="mb-4 w-10 h-10 rounded-sm flex items-center justify-center transition-colors duration-200"
                style={{ background: 'var(--subtle)', border: '1px solid var(--border)' }}>
                <Icon size={18} style={{ color: 'var(--orange)' }} />
              </div>
              <div className="ln-label mb-1.5">{`0${i+1}`}</div>
              <p className="font-bold text-sm mb-2"
                style={{ fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)' }}>
                {title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Submission form */}
      <div className="fp-form" style={{ opacity: 0 }}>
        <div className="section-header">
          <div>
            <div className="ln-label mb-1">Action</div>
            <h2 className="ln-title text-3xl">Submit <span style={{ color: 'var(--orange)' }}>Proof</span></h2>
          </div>
        </div>
        <div className="glass orange-stripe rounded-sm p-6">
          <FraudProof />
        </div>
      </div>
    </div>
  );
};

export default FraudProofPage;