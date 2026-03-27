import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
 
gsap.registerPlugin(ScrollTrigger);
 
let initialized = false;
let observer: MutationObserver | null = null;
 
function setupElement(el: Element) {
  if ((el as HTMLElement).dataset.scrollFadeInit) return;
  (el as HTMLElement).dataset.scrollFadeInit = 'true';
  (el as HTMLElement).style.opacity = '0';
 
  const isStagger = el.classList.contains('scroll-fade-stagger');
  const delay = parseFloat((el as HTMLElement).dataset.delay || '0');
  const yAmt  = parseFloat((el as HTMLElement).dataset.y    || '28');
 
  if (isStagger) {
    const children = Array.from(el.children);
    if (children.length === 0) return;
    children.forEach(c => { (c as HTMLElement).style.opacity = '0'; });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.01 }); // un-hide container
        gsap.fromTo(children,
          { opacity: 0, y: yAmt },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1, delay }
        );
      },
    });
  } else {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 89%',
      once: true,
      onEnter: () => {
        gsap.fromTo(el,
          { opacity: 0, y: yAmt },
          { opacity: 1, y: 0, duration: 0.72, ease: 'power3.out', delay }
        );
      },
    });
  }
}
 
function scanAndSetup() {
  document.querySelectorAll('.scroll-fade, .scroll-fade-stagger').forEach(setupElement);
}
 
export function initGlobalScrollFade() {
  if (initialized) return;
  initialized = true;
 
  // Initial scan
  scanAndSetup();
 
  // Watch for DOM changes (page transitions add new elements)
  observer = new MutationObserver(() => {
    // Debounce slightly to let React finish rendering
    setTimeout(scanAndSetup, 60);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
 
export function destroyGlobalScrollFade() {
  observer?.disconnect();
  observer = null;
  initialized = false;}