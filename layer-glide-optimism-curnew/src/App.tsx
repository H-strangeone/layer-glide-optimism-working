/**
 * src/App.tsx — with global scroll fade initialized
 * 
 * Only change from existing: imports and calls initGlobalScrollFade() in AppContent
 */

import React, { useEffect, useRef } from 'react';
import { useRealtimeUpdates } from './hooks/useRealtimeUpdates';
import { WagmiConfig } from 'wagmi';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Navbar from './components/Navbar';
import Index from './pages/Index';
import Transactions from './pages/Transactions';
import Withdraw from './pages/Withdraw';
import Admin from './pages/Admin';
import Batches from './pages/batches';
import FraudProofPage from './pages/fraud-proof';
import DemoGuide from './components/DemoGuide';
import NotFound from './pages/NotFound';
import { config } from './lib/wagmi';
import gsap from 'gsap';
import { useWallet } from './hooks/useWallet';
import { initGlobalScrollFade } from './lib/globalScrollFade';  // ← NEW

const queryClient = new QueryClient();

/* ── Custom cursor ── */
function Cursor() {
  const dot  = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      gsap.to(dot.current,  { x: e.clientX - 3,  y: e.clientY - 3,  duration: 0.04 });
      gsap.to(ring.current, { x: e.clientX - 16, y: e.clientY - 16, duration: 0.16 });
    };
    const enter = () => { gsap.to(ring.current, { scale: 1.6, duration: 0.2 }); };
    const leave = () => { gsap.to(ring.current, { scale: 1, duration: 0.2 }); };

    window.addEventListener('mousemove', move);
    document.querySelectorAll('a,button,[role="button"]').forEach(el => {
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
    });
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <>
      <div ref={dot}  className="cursor-dot"  style={{ position: 'fixed', top: 0, left: 0 }} />
      <div ref={ring} className="cursor-ring" style={{ position: 'fixed', top: 0, left: 0 }} />
    </>
  );
}

/* ── Page transition overlay ── */
function PageTransition({ children }: { children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const location   = useLocation();

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(overlayRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.22, ease: 'power3.inOut' }
    ).fromTo(overlayRef.current,
      { scaleX: 1, transformOrigin: 'right center' },
      { scaleX: 0, duration: 0.20, ease: 'power3.inOut' }
    );
    // After page transition, re-scan for scroll-fade elements
    setTimeout(() => initGlobalScrollFade(), 100);
  }, [location.pathname]);

  return (
    <>
      <div ref={overlayRef} className="page-transition" />
      {children}
    </>
  );
}

function AppContent() {
  useRealtimeUpdates();
  const { isConnected } = useWallet();

  // Initialize global scroll fade once on mount
  useEffect(() => {
    initGlobalScrollFade();
  }, []);

  useEffect(() => {
    const ensureNetwork = async () => {
      if (!window.ethereum) return;
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x539" }] });
      } catch (err: any) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: "0x539", chainName: "Hardhat Local", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }]
          });
        }
      }
    };
    ensureNetwork();
  }, []);

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: isConnected ? 88 : 60, minHeight: '100vh', background: 'var(--bg)' }}>
        <PageTransition>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
            <Routes>
              <Route path="/"             element={<Index />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/batches"      element={<Batches />} />
              <Route path="/withdraw"     element={<Withdraw />} />
              <Route path="/admin"        element={<Admin />} />
              <Route path="/fraud-proof"  element={<FraudProofPage />} />
              <Route path="/demo"         element={<DemoGuide />} />
              <Route path="*"             element={<NotFound />} />
            </Routes>
          </div>
        </PageTransition>
      </main>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WagmiConfig config={config}>
          <Router>
            <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
              <Cursor />
              <AppContent />
            </div>
          </Router>
        </WagmiConfig>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;