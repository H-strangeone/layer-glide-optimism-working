import React, { useEffect, useRef } from 'react';
import FraudProofMarketplace from '../components/FraudProofMarketplace';
import FraudProof from '../components/FraudProof';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import gsap from 'gsap';
import { ShieldAlert, Trophy, AlertTriangle } from 'lucide-react';

const FraudProofPage: React.FC = () => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.fp-header', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
      gsap.fromTo('.fp-content', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out', delay: 0.5 });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>
      {/* Header */}
      <div className="mb-12">
        <div className="fp-header tag mb-4" style={{ opacity: 0 }}>Dispute Resolution System</div>
        <h1 className="fp-header ln-title text-[clamp(3rem,6vw,6rem)] mb-3" style={{ opacity: 0 }}>
          Fraud<span style={{ color: 'var(--orange)' }}>Proof.</span>
        </h1>
        <p className="fp-header text-base" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 600 }}>
          The economic security layer of LayerGlide. Challenge invalid state transitions, earn rewards for protecting the network. Anyone can participate — no permission required.
        </p>
        <div className="mt-5 h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)', width: '100%' }} />
      </div>

      {/* Warning */}
      <div className="fp-header mb-8 flex gap-3 p-4 rounded-sm" style={{ opacity: 0, background: 'rgba(217,96,96,0.08)', border: '1px solid rgba(217,96,96,0.22)' }}>
        <AlertTriangle size={18} style={{ color: '#d96060', flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: '#d96060', lineHeight: 1.6 }}>
          <strong>Important:</strong> Only submit fraud proofs with verifiable evidence. False challenges are penalized. Valid challenges earn 50% of the 0.05 ETH operator bond = ~0.025 ETH per accepted proof.
        </p>
      </div>

      <div className="fp-content" style={{ opacity: 0 }}>
        <Tabs defaultValue="marketplace" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-white/5 border border-white/5 p-1 rounded-sm">
              <TabsTrigger value="marketplace" className="flex items-center gap-2 px-8 py-2 rounded-sm data-[state=active]:bg-orange data-[state=active]:text-black text-xs font-black uppercase tracking-widest">
                <Trophy size={14} /> Marketplace
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2 px-8 py-2 rounded-sm data-[state=active]:bg-orange data-[state=active]:text-black text-xs font-black uppercase tracking-widest">
                <ShieldAlert size={14} /> Manual Submit
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="glass orange-stripe rounded-sm p-8">
            <TabsContent value="marketplace" className="mt-0">
              <FraudProofMarketplace />
            </TabsContent>
            <TabsContent value="manual" className="mt-0">
              <FraudProof />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default FraudProofPage;