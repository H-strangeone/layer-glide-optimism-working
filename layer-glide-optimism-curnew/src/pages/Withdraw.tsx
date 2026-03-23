import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/ui/use-toast";
import { getLayer1Balance, getLayer2Balance, withdrawFunds } from "@/lib/ethers";
import { ArrowDownLeft, ArrowUpRight, Loader2, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { n: '01', title: 'Initiate Request',    desc: 'Enter withdrawal amount and confirm the transaction in your wallet.' },
  { n: '02', title: 'L2 Verification',     desc: 'The Layer 2 contract verifies your balance and authorises the exit.' },
  { n: '03', title: 'Fund Transfer',       desc: 'ETH is transferred from the L2 contract to your Layer 1 address.' },
  { n: '04', title: 'On-chain Finalise',   desc: 'Transaction is finalised and confirmed on the Ethereum mainnet.' },
];

export default function Withdraw() {
  const { address, isConnected } = useWallet();
  const { toast } = useToast();
  const [l1Balance, setL1Balance] = useState('0');
  const [l2Balance, setL2Balance] = useState('0');
  const [amount, setAmount]       = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  const pageRef  = useRef<HTMLDivElement>(null);
  const formRef  = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.wd-header', { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
      gsap.fromTo(formRef.current,  { opacity: 0, x: -32 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out', delay: 0.35 });
      gsap.fromTo('.step-item', { opacity: 0, x: 28 }, {
        opacity: 1, x: 0, duration: 0.55, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: stepsRef.current, start: 'top 85%' }
      });
      gsap.fromTo('.balance-box', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.1, delay: 0.5 });
    }, pageRef);
    return () => ctx.revert();
  }, [isConnected]);

  useEffect(() => {
    if (!address || !isConnected) return;
    const load = async () => {
      try {
        const [l1, l2] = await Promise.all([getLayer1Balance(address), getLayer2Balance(address)]);
        setL1Balance(l1 || '0');
        setL2Balance(l2 || '0');
      } catch { setL1Balance('0'); setL2Balance('0'); }
    };
    load();
    const int = setInterval(load, 10000);
    return () => clearInterval(int);
  }, [address, isConnected]);

  const handleWithdraw = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: 'Invalid Amount', description: 'Enter a valid amount > 0', variant: 'destructive' }); return;
    }
    if (Number(amount) > Number(l2Balance)) {
      toast({ title: 'Insufficient Balance', description: `Max: ${Number(l2Balance).toFixed(4)} ETH`, variant: 'destructive' }); return;
    }
    try {
      setIsWithdrawing(true); setTxSuccess(false);
      await withdrawFunds(amount);
      setTxSuccess(true);
      toast({ title: 'Withdrawal Initiated', description: `${amount} ETH → Layer 1` });
      if (address) {
        const [l1, l2] = await Promise.all([getLayer1Balance(address), getLayer2Balance(address)]);
        setL1Balance(l1); setL2Balance(l2);
      }
      setAmount('');
    } catch (e: any) {
      toast({ title: 'Withdrawal Failed', description: e.message, variant: 'destructive' });
    } finally { setIsWithdrawing(false); }
  };

  if (!isConnected) {
    return (
      <div ref={pageRef} className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass rounded-sm p-10 max-w-sm w-full anim-fade-up">
          <AlertCircle size={40} style={{ color: 'var(--orange)', margin: '0 auto 1rem' }} />
          <h2 className="ln-title text-3xl mb-2">Wallet Required</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to access withdrawal.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>

      {/* Header */}
      <div className="mb-12">
        <div className="wd-header tag mb-4" style={{ opacity: 0 }}>L2 → L1</div>
        <h1 className="wd-header ln-title text-[clamp(3rem,6vw,6rem)] mb-3" style={{ opacity: 0 }}>
          Withdraw<span style={{ color: 'var(--orange)' }}>.</span>
        </h1>
        <p className="wd-header text-base" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 480 }}>
          Move your funds from Layer 2 back to Ethereum mainnet. Fast, secure, and non-custodial.
        </p>
        <div className="mt-5 h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)', width: '100%' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── LEFT: Form ── */}
        <div ref={formRef} className="lg:col-span-3 space-y-5" style={{ opacity: 0 }}>

          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: ArrowUpRight, label: 'Layer 1 Balance', value: `${Number(l1Balance).toFixed(4)} ETH`, color: '#5db87a' },
              { icon: ArrowDownLeft, label: 'Layer 2 Balance', value: `${Number(l2Balance).toFixed(4)} ETH`, color: 'var(--orange)' },
            ].map(({ icon: Icon, label, value, color }, i) => (
              <div key={i} className="balance-box ln-stat-card" style={{ opacity: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={15} style={{ color }} />
                  <span className="ln-label">{label}</span>
                </div>
                <div className="ln-number text-3xl">{value}</div>
              </div>
            ))}
          </div>

          {/* Form panel */}
          <div className="glass orange-stripe rounded-sm p-6">
            <h2 className="ln-title text-3xl mb-6">
              Initiate <span style={{ color: 'var(--orange)' }}>Withdrawal</span>
            </h2>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="ln-label">Amount (ETH)</label>
                  <button onClick={() => setAmount(l2Balance)} className="btn-ghost text-xs">
                    Max
                  </button>
                </div>
                <input
                  type="number"
                  className="ln-input"
                  placeholder="0.0"
                  value={amount}
                  min="0"
                  step="0.0001"
                  onChange={e => setAmount(e.target.value)}
                  disabled={isWithdrawing}
                />
              </div>

              {/* Amount preview */}
              {amount && Number(amount) > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-sm"
                  style={{ background: 'rgba(232,97,26,0.07)', border: '1px solid rgba(232,97,26,0.2)' }}>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>You will receive on L1</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--orange)', fontFamily: "'Barlow Condensed',sans-serif" }}>
                    ~{Number(amount).toFixed(6)} ETH
                  </span>
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !amount}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                {isWithdrawing ? (
                  <><Loader2 size={16} className="anim-spin" /> Processing…</>
                ) : txSuccess ? (
                  <><CheckCircle size={16} /> Withdrawal Sent</>
                ) : (
                  <>Withdraw to Layer 1 <ChevronRight size={16} /></>
                )}
              </button>
            </div>
          </div>

          {/* Success banner */}
          {txSuccess && (
            <div className="flex items-center gap-3 p-4 rounded-sm anim-fade-up"
              style={{ background: 'rgba(93,184,122,0.1)', border: '1px solid rgba(93,184,122,0.25)' }}>
              <CheckCircle size={18} style={{ color: '#5db87a', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#5db87a' }}>
                Withdrawal initiated successfully. Funds will arrive on Layer 1 shortly.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Steps panel ── */}
        <div ref={stepsRef} className="lg:col-span-2">
          <div className="glass rounded-sm p-6 h-full">
            <div className="ln-label mb-5">How it works</div>
            <h2 className="ln-title text-3xl mb-8">
              Withdrawal<br />
              <span style={{ color: 'var(--orange)' }}>Process</span>
            </h2>
            <div className="space-y-0">
              {STEPS.map(({ n, title, desc }, i) => (
                <div key={i} className="step-item relative flex gap-4" style={{ opacity: 0 }}>
                  {/* connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-0 w-[1px]" style={{ background: 'var(--border)' }} />
                  )}
                  {/* number bubble */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center font-black text-sm"
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      background: i === 0 ? 'var(--orange)' : 'var(--subtle)',
                      color: i === 0 ? '#0a0a0a' : 'var(--muted)',
                      border: i === 0 ? 'none' : '1px solid var(--border)',
                    }}>
                    {n}
                  </div>
                  <div className="pb-8">
                    <p className="font-bold text-sm mb-1"
                      style={{ fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)' }}>
                      {title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
