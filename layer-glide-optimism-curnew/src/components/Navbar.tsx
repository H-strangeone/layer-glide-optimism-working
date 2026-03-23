import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import gsap from 'gsap';

const NAV_LINKS = [
  { to: '/transactions', label: 'Transactions' },
  { to: '/batches',      label: 'Batches' },
  { to: '/withdraw',     label: 'Withdraw' },
  { to: '/fraud-proof',  label: 'Fraud Proof' },
];

const Navbar: React.FC = () => {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [isAdmin, setIsAdmin]   = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const navRef    = useRef<HTMLElement>(null);
  const logoRef   = useRef<HTMLAnchorElement>(null);
  const linksRef  = useRef<HTMLDivElement>(null);
  const rightRef  = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<HTMLDivElement>(null);

  /* scroll shadow */
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  /* entrance */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.set(navRef.current, { opacity: 1 })
      .fromTo(stripeRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' })
      .fromTo(logoRef.current,   { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6 }, '-=0.5')
      .fromTo(linksRef.current?.children ?? [], { opacity: 0, y: -10 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.4 }, '-=0.4')
      .fromTo(rightRef.current,  { opacity: 0, x: 20 },  { opacity: 1, x: 0, duration: 0.5 }, '-=0.5');
  }, []);

  /* admin check */
  useEffect(() => {
    if (!address) return;
    fetch(`http://localhost:5500/api/admin/check?address=${address}`)
      .then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => {});
  }, [address]);

  const handleConnect = async () => {
    try { await connect(); } catch (err) {
      toast({ title: 'Connection Failed', description: err instanceof Error ? err.message : 'Failed to connect', variant: 'destructive' });
    }
  };

  const isActive = (p: string) => location.pathname === p;

  return (
    <>
      <nav
        ref={navRef}
        className={`glass-nav fixed top-0 left-0 right-0 z-50 opacity-0 transition-shadow duration-300 ${scrolled ? 'shadow-[0_8px_40px_rgba(0,0,0,0.7)]' : ''}`}
      >
        {/* orange racing top stripe */}
        <div ref={stripeRef} className="absolute top-0 left-0 right-0 h-[2px] origin-left"
          style={{ background: 'linear-gradient(90deg, var(--orange) 0%, #f07032 50%, var(--orange) 100%)' }} />

        <div style={{ maxWidth: 1280 }} className="mx-auto px-6 flex items-center justify-between h-[62px]">
          {/* Logo */}
          <Link ref={logoRef} to="/" className="flex items-center gap-2.5 group select-none no-underline">
            <div className="relative flex-shrink-0 w-8 h-8">
              <div className="absolute bottom-0 left-0 w-full h-[3px] rounded-sm" style={{ background: 'var(--orange)' }} />
              <div className="absolute bottom-0 left-0 w-[3px] h-full rounded-sm"  style={{ background: 'var(--orange)' }} />
            </div>
            <span className="ln-title text-[1.35rem] tracking-tight group-hover:text-orange transition-colors duration-200">
              Layer<span style={{ color: 'var(--orange)' }}>Glide</span>
            </span>
          </Link>

          {/* Nav links */}
          {isConnected && (
            <div ref={linksRef} className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(({ to, label }) => (
                <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>{label}</Link>
              ))}
              {isAdmin && (
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>Admin</Link>
              )}
            </div>
          )}

          {/* Right side */}
          <div ref={rightRef} className="flex items-center gap-3">
            {isConnected ? (
              <>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono"
                  style={{ background: 'var(--subtle)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full anim-pulse-orange" style={{ background: 'var(--orange)' }} />
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </div>
                <button onClick={disconnect} className="btn-outline text-xs py-1.5 px-4">Disconnect</button>
              </>
            ) : (
              <button onClick={handleConnect} disabled={isConnecting} className="btn-primary">
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Ticker bar - shows below nav when connected */}
      {isConnected && (
        <div className="fixed top-[62px] left-0 right-0 z-40 ticker">
          <div className="marquee-wrap">
            <div className="marquee-track">
              {[...Array(8)].map((_, i) => (
                <span key={i} className="px-8">
                  ⬡ LayerGlide L2 · Optimistic Rollup Network · Fast · Secure · Scalable &nbsp;·&nbsp;
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
