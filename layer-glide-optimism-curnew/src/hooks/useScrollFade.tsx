import { useEffect, useRef, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
 
gsap.registerPlugin(ScrollTrigger);
 
interface ScrollFadeOptions {
  y?: number;
  x?: number;
  duration?: number;
  delay?: number;
  ease?: string;
  start?: string;
  stagger?: number;
}
 
/**
 * Fade a single element in when it enters the viewport.
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useScrollFade(ref);
 *   return <div ref={ref} style={{ opacity: 0 }}>...</div>;
 */
export function useScrollFade<T extends HTMLElement>(
  ref: RefObject<T>,
  options: ScrollFadeOptions = {}
) {
  const {
    y = 30, x = 0, duration = 0.7, delay = 0,
    ease = 'power3.out', start = 'top 88%'
  } = options;
 
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start,
      once: true,
      onEnter: () => {
        gsap.fromTo(el,
          { opacity: 0, y, x },
          { opacity: 1, y: 0, x: 0, duration, delay, ease }
        );
      },
    });
    return () => trigger.kill();
  }, []);
}
 
/**
 * Fade a group of child elements (by CSS class) in when the container enters viewport.
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useScrollFadeChildren(ref, '.card');
 *   return <div ref={ref}><div className="card">...</div>...</div>;
 */
export function useScrollFadeChildren<T extends HTMLElement>(
  containerRef: RefObject<T>,
  childSelector: string,
  options: ScrollFadeOptions = {}
) {
  const {
    y = 28, x = 0, duration = 0.6, delay = 0,
    ease = 'power3.out', start = 'top 88%', stagger = 0.1
  } = options;
 
  useEffect(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll(childSelector);
    if (!children.length) return;
 
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start,
      once: true,
      onEnter: () => {
        gsap.fromTo(children,
          { opacity: 0, y, x },
          { opacity: 1, y: 0, x: 0, duration, delay, ease, stagger }
        );
      },
    });
    return () => trigger.kill();
  }, []);
}
 
/**
 * ScrollFadeSection — React component wrapper for easy scroll fade.
 * Usage:
 *   <ScrollFadeSection>
 *     <div>content</div>
 *   </ScrollFadeSection>
 */
import React from 'react';
 
interface ScrollFadeSectionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  y?: number;
  delay?: number;
  duration?: number;
}
 
export function ScrollFadeSection({
  children, className, style, y = 32, delay = 0, duration = 0.7
}: ScrollFadeSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref, { y, delay, duration });
  return (
    <div ref={ref} className={className} style={{ opacity: 0, ...style }}>
      {children}
    </div>
  );
}