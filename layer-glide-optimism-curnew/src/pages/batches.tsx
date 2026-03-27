/**
 * batches.tsx — Block Tower with wooden/brown blocks
 * 
 * CHANGES from previous version:
 * 1. Blocks are brown/wood toned (warm chocolate, oak, mahogany palette)
 * 2. Blocks are 30% bigger
 * 3. Click a block to start spinning it; click again to stop
 * 4. Scroll fade-in via GSAP ScrollTrigger on all sections
 * 5. Challenge period status read from contract
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { BatchManager } from '@/components/BatchManager';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Package, ChevronDown, Layers, X, Clock, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

gsap.registerPlugin(ScrollTrigger);

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

interface BlockData {
  id:          string;
  onChainId:   string | null;
  status:      string;
  txCount:     number;
  stateRoot:   string | null;
  createdAt:   number;
  challengeEndsAt: number | null;
  timeLeftMs?: number;
}

interface SelectedBlock {
  data:    BlockData;
  screenX: number;
  screenY: number;
}

// ── Warm brown/wood palette ──────────────────────────────────────────────────
const STATUS = {
  finalized:          { hex: 0x6B8F5E, label: 'Finalized',   css: '#6B8F5E' },   // moss green
  challenge_period:   { hex: 0xC47A2B, label: 'Challenge',   css: '#C47A2B' },   // amber wood
  pending_submission: { hex: 0x7A6552, label: 'Pending',     css: '#7A6552' },   // bark brown
  rejected:           { hex: 0x8B3A3A, label: 'Rejected',    css: '#8B3A3A' },   // dark red wood
  failed:             { hex: 0x8B3A3A, label: 'Failed',      css: '#8B3A3A' },
} as const;

function getStatus(s: string) {
  return STATUS[s as keyof typeof STATUS] ?? STATUS.pending_submission;
}

// ── Block Detail Panel ────────────────────────────────────────────────────────
function BlockDetailPanel({ block, onClose }: { block: SelectedBlock; onClose: () => void }) {
  const { data } = block;
  const st = getStatus(data.status);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(panelRef.current,
      { opacity: 0, scale: 0.88, y: 16 },
      { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: 'back.out(1.6)' }
    );
  }, []);

  const close = () => {
    gsap.to(panelRef.current, {
      opacity: 0, scale: 0.88, y: 8, duration: 0.18,
      ease: 'power2.in', onComplete: onClose
    });
  };

  const timeLeft = data.challengeEndsAt
    ? Math.max(0, data.challengeEndsAt * 1000 - Date.now()) : 0;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: Math.min(block.screenX + 20, window.innerWidth - 350),
        top:  Math.min(block.screenY - 90, window.innerHeight - 340),
        zIndex: 1000, width: 330, opacity: 0,
      }}
    >
      <div style={{
        background: 'linear-gradient(145deg, rgba(24,18,12,0.97) 0%, rgba(15,10,6,0.99) 100%)',
        border: `1px solid ${st.css}50`,
        borderRadius: 14, padding: 22,
        boxShadow: `0 28px 70px rgba(0,0,0,0.75), 0 0 0 1px ${st.css}25, inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${st.css}18`, border: `1px solid ${st.css}35`,
              borderRadius: 20, padding: '3px 10px', marginBottom: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.css, display: 'inline-block' }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: st.css, fontFamily: "'Barlow Condensed', sans-serif" }}>
                {st.label}
              </span>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#f0e8d8' }}>
              Block {data.onChainId ? `#${data.onChainId}` : 'Uncommitted'}
            </div>
          </div>
          <button onClick={close} style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8,
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#6b5f52',
          }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Transactions', value: String(data.txCount) },
            { label: 'Created', value: data.createdAt ? formatDistanceToNow(new Date(data.createdAt * 1000), { addSuffix: true }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '9px 11px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b5f52', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0e8d8', fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>

        {data.stateRoot && (
          <div style={{ background: 'rgba(196,122,43,0.07)', borderRadius: 9, padding: '9px 11px', marginBottom: 12, border: '1px solid rgba(196,122,43,0.2)' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b5f52', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 4 }}>State Root</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#C47A2B', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {data.stateRoot.slice(0, 20)}...{data.stateRoot.slice(-8)}
            </div>
          </div>
        )}

        {data.status === 'challenge_period' && timeLeft > 0 && (
          <div style={{ background: 'rgba(196,122,43,0.08)', borderRadius: 9, padding: '9px 11px', border: '1px solid rgba(196,122,43,0.22)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={13} color="#C47A2B" />
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#C47A2B', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 2 }}>Challenge Window</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#C47A2B', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {Math.floor(timeLeft / 60000)}m {Math.floor((timeLeft % 60000) / 1000)}s remaining
              </div>
            </div>
          </div>
        )}

        {data.status === 'finalized' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: 'rgba(107,143,94,0.07)', borderRadius: 9, border: '1px solid rgba(107,143,94,0.22)' }}>
            <CheckCircle size={13} color="#6B8F5E" />
            <span style={{ fontSize: 12, color: '#6B8F5E', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Committed to L1</span>
          </div>
        )}

        <div style={{ marginTop: 12, padding: '8px 11px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 9, color: '#4a3f35', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Click block to spin · Click again to stop
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Three.js Block Tower ──────────────────────────────────────────────────────


function BlockTowerScene({ batches, onBlockClick }: {
  batches: BlockData[];
  onBlockClick: (block: BlockData, screenX: number, screenY: number) => void;
}) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const frameRef    = useRef<number>(0);
  const meshesRef = useRef<Array<{
  mesh: THREE.Mesh;
  data: BlockData;
  spinning: boolean;
  spinSpeed: number;
}>>([]);
  const groupRef    = useRef<THREE.Group | null>(null);
  const clockRef    = useRef(new THREE.Clock());
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Drag / inertia state — stored in ref so animation loop reads latest
  const drag = useRef({
    active: false,
    lastX: 0,
    velocityX: 0,
    rotationY: 0,
    moved: false, // distinguish click vs drag
  });

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(8, 10, 14);
    camera.lookAt(0, 3, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lights ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    keyLight.position.set(10, 18, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far  = 100;
    Object.assign(keyLight.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 });
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xe8611a, 0.3);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0x4ade80, 0.8, 30);
    rimLight.position.set(-5, 8, -8);
    scene.add(rimLight);

    // ── Group + ground ────────────────────────────────────────────────────
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.8, metalness: 0.2 })
    );
    ground.receiveShadow = true;
    ground.position.y = -0.05;
    group.add(ground);
    const grid = new THREE.GridHelper(8, 8, 0x222228, 0x1a1a20);
    grid.position.y = 0.02;
    group.add(grid);

    buildTower(batches, group, meshesRef);
    buildParticles(scene);

    // ── Animation loop ────────────────────────────────────────────────────
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clockRef.current.getElapsedTime();
      const d = drag.current;

      if (d.active) {
        // Dragging: rotation follows pointer directly
        group.rotation.y = d.rotationY;
      } else {
        // Inertia decay
        d.velocityX *= 0.94;
        // Once velocity is small, blend in gentle auto-rotate
        if (Math.abs(d.velocityX) < 0.0015) {
          d.velocityX = 0;
          d.rotationY += 0.003; // very slow auto-spin
        } else {
          d.rotationY += d.velocityX;
        }
        group.rotation.y = d.rotationY;
      }

      // Gentle static tilt — NO mouse-Y influence
      group.rotation.x = Math.sin(t * 0.07) * 0.035;

      // Pulsing blocks
      meshesRef.current.forEach(({ mesh }, i) => {
        const phase = i * 0.7 + t * 0.8;
        mesh.position.y += Math.sin(phase) * 0.0008;
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          0.15 + Math.sin(phase) * 0.06;
      });

      rimLight.position.x = Math.sin(t * 0.4) * 8;
      rimLight.position.z = Math.cos(t * 0.4) * 8;

      renderer.render(scene, camera);
    };
    animate();

    // ── Pointer drag (horizontal spin only) ──────────────────────────────
    const el = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      drag.current.active  = true;
      drag.current.lastX   = e.clientX;
      drag.current.moved   = false;
      drag.current.velocityX = 0;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      if (Math.abs(dx) > 2) drag.current.moved = true;
      drag.current.velocityX  = dx * 0.012; // speed factor
      drag.current.rotationY += dx * 0.012;
      drag.current.lastX = e.clientX;
    };

    const onPointerUp = (e: PointerEvent) => {
      drag.current.active = false;
      el.style.cursor = 'crosshair';
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);

    // ── Click = block detail (only if not a drag) ────────────────────────
    const raycaster  = new THREE.Raycaster();
    const clickPoint = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      if (drag.current.moved) return; // was a drag, ignore
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      clickPoint.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      clickPoint.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(clickPoint, camera);
      const hits = raycaster.intersectObjects(meshesRef.current.map(m => m.mesh));
      if (hits.length > 0) {
        const item = meshesRef.current.find(m => m.mesh === hits[0].object);
        if (item) onBlockClick(item.data, e.clientX, e.clientY);
      }
    };
    el.addEventListener('click', onClick);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mountRef.current) return;
      const W2 = mountRef.current.clientWidth;
      const H2 = mountRef.current.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
      el.removeEventListener('click', onClick);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [batches]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
    />
  );
}

function buildTower(
  batches: BlockData[],
  group: THREE.Group,
  meshesRef: React.MutableRefObject<Array<{ mesh: THREE.Mesh; data: BlockData; spinning: boolean; spinSpeed: number }>>
) {
  meshesRef.current = [];
  group.children.filter(c => (c as any).__isBlock).forEach(c => group.remove(c));

  const displayed = batches.slice(0, 14);
  let stackY = 0;

  displayed.forEach((batch, i) => {
    const st = getStatus(batch.status);

    // BIGGER blocks (1.3x from previous)
    const w = 2.1 + Math.sin(i * 2.1) * 0.2;
    const h = 0.72 + Math.sin(i * 1.6) * 0.1;
    const d = 2.1 + Math.cos(i * 1.8) * 0.2;

    const geo = new THREE.BoxGeometry(w, h, d);

    // Wood-toned material — base is warm brown, status tints the emissive
    const woodBase = new THREE.Color(0x5C3D1E).lerp(new THREE.Color(st.hex), 0.35);
    const mat = new THREE.MeshStandardMaterial({
      color:             woodBase,
      emissive:          new THREE.Color(st.hex),
      emissiveIntensity: 0.14,
      roughness:         0.82,   // matte wood look
      metalness:         0.08,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;

    const xOff = (Math.random() - 0.5) * 0.22;
    const zOff = (Math.random() - 0.5) * 0.22;
    stackY += h / 2;
    mesh.position.set(xOff, stackY, zOff);
    mesh.userData.baseY = stackY;
    stackY += h / 2 + 0.08;

    mesh.rotation.y = (Math.random() - 0.5) * 0.1;

    (mesh as any).__isBlock = true;
    group.add(mesh);

    // Edge highlight — warm gold lines
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0xD4A55A),
      transparent: true, opacity: 0.35,
    });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    (edges as any).__isBlock = true;
    group.add(edges);

    // Entrance animation — drop in from above
    const targetY = mesh.position.y;
    mesh.position.y = targetY + 18;
    edges.position.y = targetY + 18;
    gsap.to(mesh.position,  { y: targetY, duration: 0.85, delay: i * 0.07, ease: 'back.out(1.3)' });
    gsap.to(edges.position, { y: targetY, duration: 0.85, delay: i * 0.07, ease: 'back.out(1.3)' });

    meshesRef.current.push({ mesh, data: batch, spinning: false, spinSpeed: 0.04 });
  });
}

function buildParticles(scene: THREE.Scene) {
  const count  = 80;
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    posArr[i*3]   = (Math.random() - 0.5) * 28;
    posArr[i*3+1] = Math.random() * 22;
    posArr[i*3+2] = (Math.random() - 0.5) * 28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xC47A2B, size: 0.07, transparent: true, opacity: 0.45
  });
  scene.add(new THREE.Points(geo, mat));
}

// ── Stat facts ────────────────────────────────────────────────────────────────
const BATCH_FACTS = [
  { stat: '100+', label: 'Txs per batch' },
  { stat: '<1s',  label: 'L2 finality' },
  { stat: '~95%', label: 'Gas saving' },
  { stat: 'L1',   label: 'Security anchor' },
];

// ── Scroll fade utility ───────────────────────────────────────────────────────
function useScrollFadeIn(ref: React.RefObject<HTMLElement>, delay = 0) {
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 36 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay,
        scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true },
      }
    );
  }, []);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchesPage() {
  const pageRef     = useRef<HTMLDivElement>(null);
  const towerRef    = useRef<HTMLDivElement>(null);
  const statsRef    = useRef<HTMLDivElement>(null);
  const howRef      = useRef<HTMLDivElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);

  const [batches, setBatches]         = useState<BlockData[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null);
  const [blockHeight, setBlockHeight] = useState<number>(0);
  const [loading, setLoading]         = useState(true);

  const fetchBatches = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/batches`);
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchBlockHeight = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/block-height`);
      const data = await res.json();
      setBlockHeight(data.blockNumber || 0);
    } catch {
      setBlockHeight(h => h + 1);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchBlockHeight();
    const bi = setInterval(fetchBatches, 10_000);
    const bh = setInterval(fetchBlockHeight, 12_000);
    return () => { clearInterval(bi); clearInterval(bh); };
  }, []);

  // GSAP entrance + scroll fade-ins
  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      // Header
      gsap.fromTo('.bat-header',
        { opacity: 0, y: 44 },
        { opacity: 1, y: 0, duration: 0.85, ease: 'power4.out', stagger: 0.11 }
      );
      // Tower
      gsap.fromTo(towerRef.current,
        { opacity: 0, scale: 0.93 },
        { opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out', delay: 0.25 }
      );
      // Stats scroll fade
      gsap.fromTo('.bat-fact',
        { opacity: 0, y: 28, scale: 0.93 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', stagger: 0.09,
          scrollTrigger: { trigger: statsRef.current, start: 'top 88%', once: true },
        }
      );
      // How it works scroll fade
      gsap.fromTo('.bat-step',
        { opacity: 0, x: -32 },
        {
          opacity: 1, x: 0, duration: 0.65, ease: 'power3.out', stagger: 0.13,
          scrollTrigger: { trigger: howRef.current, start: 'top 85%', once: true },
        }
      );
      // Batch list scroll fade
      gsap.fromTo(listRef.current,
        { opacity: 0, y: 44 },
        {
          opacity: 1, y: 0, duration: 0.75, ease: 'power3.out',
          scrollTrigger: { trigger: listRef.current, start: 'top 88%', once: true },
        }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [loading]);

  const handleBlockClick = useCallback((data: BlockData, screenX: number, screenY: number) => {
    setSelectedBlock(prev => prev?.data.id === data.id ? null : { data, screenX, screenY });
  }, []);

  const finalized   = batches.filter(b => b.status === 'finalized').length;
  const inChallenge = batches.filter(b => b.status === 'challenge_period').length;
  const totalTxs    = batches.reduce((s, b) => s + (b.txCount || 0), 0);

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem', paddingBottom: '6rem' }}>

      {/* Header */}
      <div className="mb-8">
        <div className="bat-header tag mb-4" style={{ opacity: 0 }}>Rollup Engine</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <h1 className="bat-header ln-title text-[clamp(3.5rem,7vw,8rem)] leading-none" style={{ opacity: 0 }}>
            Block<span style={{ color: 'var(--orange)' }}>Tower.</span>
          </h1>
          <div className="bat-header flex flex-col gap-1 mb-2" style={{ opacity: 0 }}>
            <p className="text-sm" style={{ color: 'var(--muted)', maxWidth: 380, lineHeight: 1.6 }}>
              Live view of your optimistic rollup. Each block is a batch committed to Ethereum L1. Click any block to spin it and inspect details.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B8F5E', display: 'inline-block', boxShadow: '0 0 8px #6B8F5E' }} />
              <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                L1 Block Height: <span style={{ color: '#6B8F5E' }}>#{blockHeight.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)' }} />
      </div>

      {/* Three.js tower — scrollable container */}
      <div
        ref={towerRef}
        style={{
          position: 'relative',
          height: 540,
          borderRadius: 14, overflow: 'hidden', opacity: 0,
          background: 'radial-gradient(ellipse at 50% 35%, rgba(196,122,43,0.07) 0%, rgba(8,5,2,0.97) 65%)',
          border: '1px solid rgba(196,122,43,0.12)',
          marginBottom: 10,
        }}
      >
        {/* Gradient overlays */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to bottom, transparent 50%, rgba(8,5,2,0.88) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(8,5,2,0.35) 0%, transparent 25%, transparent 75%, rgba(8,5,2,0.35) 100%)' }} />

        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {!loading && <BlockTowerScene batches={batches} onBlockClick={handleBlockClick} />}
        </div>

        {/* Stats overlay */}
        <div style={{ position: 'absolute', top: 20, left: 24, zIndex: 2 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(240,220,180,0.35)', marginBottom: 6 }}>
            Network State
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            {[
              { label: 'Batches',      value: batches.length, color: '#f0e8d8' },
              { label: 'Finalized',    value: finalized,      color: '#6B8F5E' },
              { label: 'In Challenge', value: inChallenge,    color: '#C47A2B' },
              { label: 'Total Txs',    value: totalTxs,       color: '#f0e8d8' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(240,220,180,0.3)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {Object.entries(STATUS).slice(0, 3).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: val.css, display: 'inline-block', boxShadow: `0 0 6px ${val.css}90` }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(240,220,180,0.4)' }}>
                {val.label}
              </span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(240,220,180,0.22)' }}>
            Click blocks to spin · Scroll for details
          </span>
          <ChevronDown size={14} style={{ color: 'rgba(240,220,180,0.18)', animation: 'bounce 2s ease-in-out infinite' }} />
        </div>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(196,122,43,0.3)', borderTop: '2px solid #C47A2B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(240,220,180,0.3)' }}>
              Syncing blocks...
            </span>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {BATCH_FACTS.map(({ stat, label }, i) => (
          <div key={i} className="bat-fact ln-stat-card" style={{ opacity: 0 }}>
            <div className="ln-number text-4xl mb-1" style={{ color: i === 0 ? 'var(--orange)' : 'var(--text)' }}>{stat}</div>
            <div className="ln-label">{label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div ref={howRef} className="mb-12 glass rounded-sm p-8 stripe-left pl-10" style={{ position: 'relative' }}>
        <div className="ln-label mb-3">How it works</div>
        <h2 className="ln-title text-4xl mb-8">
          Optimistic <span style={{ color: 'var(--orange)' }}>Rollup Batching</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Collect Txs',    desc: 'Aggregate pending L2 transactions from the mempool into a candidate batch.' },
            { step: '02', title: 'Submit to L1',   desc: 'Compress and commit to the L1 rollup contract as a single batched transaction with a state root.' },
            { step: '03', title: 'Challenge Window', desc: 'Contract opens a challenge window. No valid fraud proof = auto-finalize as a single L1 tx.' },
          ].map(({ step, title, desc }, i) => (
            <div key={i} className="bat-step flex gap-4 items-start" style={{ opacity: 0 }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center font-black text-sm"
                style={{ background: 'var(--orange)', color: '#0a0a0a', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {step}
              </div>
              <div>
                <p className="font-bold text-sm mb-1" style={{ fontFamily: "'Barlow Condensed',sans-serif", textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {title}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Batch List */}
      <div ref={listRef} style={{ opacity: 0 }}>
        <div className="section-header mb-6">
          <div>
            <div className="ln-label mb-1">Active</div>
            <h2 className="ln-title text-4xl">Live Batches</h2>
          </div>
          <Package size={20} style={{ color: 'var(--muted)' }} />
        </div>
        <div className="glass rounded-sm p-6">
          <BatchManager />
        </div>
      </div>

      {/* Block detail panel */}
      {selectedBlock && (
        <BlockDetailPanel block={selectedBlock} onClose={() => setSelectedBlock(null)} />
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.22; }
          50%       { transform: translateY(7px); opacity: 0.48; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}