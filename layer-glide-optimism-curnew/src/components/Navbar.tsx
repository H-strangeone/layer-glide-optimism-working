<<<<<<< HEAD
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
=======
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";

const Navbar: React.FC = () => {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!address) return;

      try {
        const response = await fetch(`http://localhost:5500/api/admin/check?address=${address}`);
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        setUserRoles(data.roles || []); // Assuming the API returns a 'roles' array
      } catch (error) {
        console.error('Error fetching user roles:', error);
      }
    };

    fetchUserRoles();
  }, [address]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Connection failed:", error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  return (
    <nav className="backdrop-blur-md bg-black/30 border-b border-white/10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              to="/"
              className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent hover:from-purple-500 hover:via-pink-600 hover:to-purple-700 transition-all duration-300"
            >
              Layer 2 Scaling
            </Link>
            {isConnected && (
              <div className="flex space-x-6">
                {userRoles.map((role) => (
                  <span key={role} className="text-white/70 hover:text-white transition-colors duration-200">
                    {role}
                  </span>
                ))}
                <Link
                  to="/transactions"
                  className="text-white/70 hover:text-white transition-colors duration-200"
                >
                  Transactions
                </Link>
                <Link
                  to="/batches"
                  className="text-white/70 hover:text-white transition-colors duration-200"
                >
                  Batches
                </Link>
                <Link
                  to="/withdraw"
                  className="text-white/70 hover:text-white transition-colors duration-200"
                >
                  Withdraw
                </Link>
                <Link
                  to="/fraud-proof"
                  className="text-white/70 hover:text-white transition-colors duration-200"
                >
                  Fraud Proof
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Admin
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isConnected ? (
              <>
                <span className="text-sm text-white/70 bg-white/5 px-3 py-1 rounded-full">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <Button
                  variant="outline"
                  onClick={disconnect}
                  className="border-white/10 text-white/70 hover:text-white hover:border-white/20 transition-colors duration-200"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all duration-200"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
  );
};

export default Navbar;
