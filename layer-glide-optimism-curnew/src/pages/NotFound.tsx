<<<<<<< HEAD
import { useLocation, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import gsap from 'gsap';

const NotFound = () => {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error('404:', location.pathname);
    const ctx = gsap.context(() => {
      gsap.fromTo('.nf-num',   { opacity: 0, y: 40, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'back.out(1.4)' });
      gsap.fromTo('.nf-text',  { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.3 });
      gsap.fromTo('.nf-btn',   { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.55 });
      gsap.fromTo('.nf-line',  { scaleX: 0 },          { scaleX: 1, duration: 0.7, ease: 'power3.inOut', delay: 0.6 });
    }, ref);
    return () => ctx.revert();
  }, [location.pathname]);

  return (
    <div ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* grid */}
      <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />
      {/* glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(232,97,26,0.09) 0%, transparent 65%)' }} />

      <div className="relative z-10 text-center px-6">
        <div className="nf-num ln-title text-[clamp(8rem,22vw,18rem)] leading-none" style={{ opacity: 0, color: 'var(--orange)', fontStyle: 'italic' }}>
          404
        </div>

        <div className="nf-line mx-auto mb-8 h-[3px] w-24 origin-center rounded" style={{ opacity: 0, background: 'var(--orange)' }} />

        <h2 className="nf-text ln-title text-4xl mb-4" style={{ opacity: 0 }}>
          Lost on the Track
        </h2>
        <p className="nf-text text-base mb-8 mx-auto" style={{ color: 'var(--muted)', opacity: 0, maxWidth: 360, lineHeight: 1.7 }}>
          This page doesn't exist. You must have taken the wrong racing line. Let's get you back to the pits.
        </p>

        <Link to="/" className="nf-btn btn-primary inline-flex" style={{ opacity: 0 }}>
          Back to Home
        </Link>

        <div className="nf-text mt-8 text-xs font-mono" style={{ color: 'var(--muted)', opacity: 0 }}>
          Attempted path: <span style={{ color: 'var(--orange)' }}>{location.pathname}</span>
        </div>
=======
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
      </div>
    </div>
  );
};

export default NotFound;
