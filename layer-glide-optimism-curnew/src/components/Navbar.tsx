import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import gsap from 'gsap';

const NAV_LINKS = [
  { to: '/transactions', label: 'Explorer' },
  { to: '/batches',      label: 'Blocks' },
  { to: '/withdraw',     label: 'Bridge' },
  { to: '/fraud-proof',  label: 'Dispute' },
];

const Navbar: React.FC = () => {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [isAdmin, setIsAdmin]     = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const location = useLocation();

  const navRef    = useRef<HTMLElement>(null);
  const logoRef   = useRef<HTMLAnchorElement>(null);
  const linksRef  = useRef<HTMLDivElement>(null);
  const rightRef  = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<HTMLDivElement>(null);

  // Scroll shadow
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Entrance animation
  useEffect(() => {
    if (!navRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.set(navRef.current, { opacity: 1 })
      .fromTo(stripeRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' })
      .fromTo(logoRef.current,   { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.6 }, '-=0.5')
      .fromTo(linksRef.current?.children ?? [], { opacity: 0, y: -10 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.45 }, '-=0.35')
      .fromTo(rightRef.current,  { opacity: 0, x: 20  }, { opacity: 1, x: 0, duration: 0.5 }, '-=0.45');
  }, []);

  // Admin check
  useEffect(() => {
    if (!address) return;
    fetch(`http://localhost:5500/api/admin/check?address=${address}`)
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin))
      .catch(() => {});
  }, [address]);

  const handleConnect = async () => {
    try { await connect(); }
    catch (err) {
      toast({ title: 'Connection Failed', description: err instanceof Error ? err.message : 'Failed to connect', variant: 'destructive' });
    }
  };

  const isActive = (p: string) => location.pathname === p;

  return (
    <>
      <nav
        ref={navRef}
        className="glass-nav"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          opacity: 0,
          transition: 'box-shadow 0.3s ease',
          boxShadow: scrolled ? '0 8px 48px rgba(0,0,0,0.8)' : 'none',
        }}
      >
        {/* Racing stripe — Lando Norris GP */}
        <div
          ref={stripeRef}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 2,
            background: 'linear-gradient(90deg, var(--orange) 0%, #f07235 40%, var(--orange) 100%)',
            transformOrigin: 'left',
          }}
        />

        <div style={{ maxWidth: 1280 }} className="mx-auto px-6 flex items-center justify-between h-[58px]">

          {/* ── Logo ── */}
          <Link
            ref={logoRef as any}
            to="/"
            className="flex items-center gap-3 group select-none no-underline"
            style={{ opacity: 0 }}
          >
            {/* L logo mark — two angled bars like a rollup "layer" */}
            <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
              {/* Bottom bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                width: '100%', height: 3,
                background: 'var(--orange)',
                borderRadius: 1,
              }} />
              {/* Left bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0,
                width: 3, height: '100%',
                background: 'var(--orange)',
                borderRadius: 1,
              }} />
              {/* Accent dot */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: 6, height: 6,
                borderRadius: '50%',
                background: 'var(--orange)',
                opacity: 0.6,
              }} />
            </div>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: '1.25rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              transition: 'color 0.2s',
            }}>
              Layer<span style={{ color: 'var(--orange)' }}>Glide</span>
            </span>
          </Link>

          {/* ── Nav links ── */}
          {isConnected && (
            <div ref={linksRef} className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map(({ to, label }) => (
                <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>
                  {label}
                </Link>
              ))}
              {isAdmin && (
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
                  Admin
                </Link>
              )}
            </div>
          )}

          {/* ── Right ── */}
          <div ref={rightRef} className="flex items-center gap-3" style={{ opacity: 0 }}>
            {isConnected ? (
              <>
                {/* Address pill */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px',
                  background: 'var(--subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--orange)',
                    animation: 'pulseOrange 2.5s infinite',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: 'var(--muted)',
                    letterSpacing: '0.03em',
                  }}>
                    {address?.slice(0, 6)}…{address?.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={disconnect}
                  className="btn-outline text-xs py-1.5 px-4"
                  style={{ fontSize: 11, padding: '5px 14px' }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="btn-primary"
                style={{ fontSize: 13, padding: '7px 20px' }}
              >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Ticker bar ── */}
      {isConnected && (
        <div
          className="ticker"
          style={{ position: 'fixed', top: 58, left: 0, right: 0, zIndex: 40 }}
        >
          <div className="marquee-wrap">
            <div className="marquee-track">
              {[...Array(8)].map((_, i) => (
                <span key={i} className="px-8">
                  ⬡ LayerGlide L2 · Optimistic Rollup · Ethereum L1 Security · 99.99% Uptime ·
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