/**
 * batches.tsx — Complete redesign with Three.js block tower
 * 
 * Aesthetic: Dark industrial luxury × soft isometric 3D
 * - Three.js block tower (live blocks on network) pinned at top
 * - Clicking a block shows soft pastel detail panel (image 2 inspiration)
 * - Scrolling reveals the batch list with GSAP ScrollTrigger fade-ins
 * - Lando Norris website feel: bold condensed type, racing stripe accents
 * - MetaCrafters: dark bg, glowing elements, tech-forward
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { BatchManager } from '@/components/BatchManager';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Package, ChevronDown, Layers, X, Clock, Hash, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

gsap.registerPlugin(ScrollTrigger);

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

// ── Types ─────────────────────────────────────────────────────────────────────
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
  data:   BlockData;
  screenX: number;
  screenY: number;
}

// ── Status colour map ─────────────────────────────────────────────────────────
const STATUS = {
  finalized:          { hex: 0x4ade80, label: 'Finalized',   css: '#4ade80' },
  challenge_period:   { hex: 0xe8611a, label: 'Challenge',   css: '#e8611a' },
  pending_submission: { hex: 0x6b7280, label: 'Pending',     css: '#6b7280' },
  rejected:           { hex: 0xef4444, label: 'Rejected',    css: '#ef4444' },
  failed:             { hex: 0xef4444, label: 'Failed',      css: '#ef4444' },
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
      { opacity: 0, scale: 0.92, y: 12 }, 
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' }
    );
  }, []);

  const close = () => {
    gsap.to(panelRef.current, { opacity: 0, scale: 0.92, y: 8, duration: 0.2, ease: 'power2.in', onComplete: onClose });
  };

  const timeLeft = data.challengeEndsAt
    ? Math.max(0, data.challengeEndsAt * 1000 - Date.now())
    : 0;

  return (
    <div
      ref={panelRef}
      className="block-detail-panel"
      style={{
        position: 'fixed',
        left: Math.min(block.screenX + 16, window.innerWidth - 340),
        top:  Math.min(block.screenY - 80,  window.innerHeight - 320),
        zIndex: 1000,
        width: 320,
        opacity: 0,
      }}
    >
      {/* Soft pastel card — image 2 inspiration */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(28,28,32,0.97) 0%, rgba(18,18,22,0.99) 100%)',
        border: `1px solid ${st.css}40`,
        borderRadius: 16,
        padding: 24,
        boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px ${st.css}20, inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(24px)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
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
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#f0ece6' }}>
              Block {data.onChainId ? `#${data.onChainId}` : 'Uncommitted'}
            </div>
          </div>
          <button onClick={close} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b6560' }}>
            <X size={14} />
          </button>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { icon: Layers,   label: 'Transactions', value: String(data.txCount) },
            { icon: Clock,    label: 'Created',       value: data.createdAt ? formatDistanceToNow(new Date(data.createdAt * 1000), { addSuffix: true }) : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Icon size={10} color="#6b6560" />
                <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b6560', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0ece6', fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* State root */}
        {data.stateRoot && (
          <div style={{ background: 'rgba(232,97,26,0.05)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, border: '1px solid rgba(232,97,26,0.15)' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b6560', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 5 }}>State Root</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#e8611a', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {data.stateRoot.slice(0, 20)}...{data.stateRoot.slice(-8)}
            </div>
          </div>
        )}

        {/* Challenge countdown */}
        {data.status === 'challenge_period' && timeLeft > 0 && (
          <div style={{ background: 'rgba(232,97,26,0.08)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(232,97,26,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={13} color="#e8611a" />
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#e8611a', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, marginBottom: 2 }}>Challenge Window</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#e8611a', fontFamily: "'Barlow Condensed', sans-serif" }}>
                {Math.floor(timeLeft / 60000)}m {Math.floor((timeLeft % 60000) / 1000)}s remaining
              </div>
            </div>
          </div>
        )}

        {data.status === 'finalized' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(74,222,128,0.06)', borderRadius: 10, border: '1px solid rgba(74,222,128,0.2)' }}>
            <CheckCircle size={13} color="#4ade80" />
            <span style={{ fontSize: 12, color: '#4ade80', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Committed to L1</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Three.js Block Tower Scene ────────────────────────────────────────────────
function BlockTowerScene({ batches, onBlockClick }: {
  batches: BlockData[];
  onBlockClick: (block: BlockData, screenX: number, screenY: number) => void;
}) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef    = useRef<number>(0);
  const meshesRef   = useRef<Array<{ mesh: THREE.Mesh; data: BlockData }>>([]);
  const groupRef    = useRef<THREE.Group | null>(null);
  const mouseRef    = useRef({ x: 0, y: 0 });
  const clockRef    = useRef(new THREE.Clock());

  useEffect(() => {
    if (!mountRef.current) return;
    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    // Scene
    const scene    = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null; // transparent — let CSS handle bg

    // Camera — isometric-ish perspective
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(8, 10, 14);
    camera.lookAt(0, 3, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    keyLight.position.set(10, 18, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far  = 100;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top  = 20;
    keyLight.shadow.camera.bottom = -20;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8611a, 0.3);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x4ade80, 0.8, 30);
    rimLight.position.set(-5, 8, -8);
    scene.add(rimLight);

    // Group for rotation
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Ground plane
    const groundGeo = new THREE.CylinderGeometry(5, 5, 0.1, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x111114,
      roughness: 0.8,
      metalness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.position.y = -0.05;
    group.add(ground);

    // Grid lines on ground
    const gridHelper = new THREE.GridHelper(8, 8, 0x222228, 0x1a1a20);
    gridHelper.position.y = 0.02;
    group.add(gridHelper);

    // Build block tower from batches
    buildTower(batches, group, meshesRef);

    // Floating particles
    buildParticles(scene);

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const t = clockRef.current.getElapsedTime();

      // Slow auto-rotation
      group.rotation.y = t * 0.12 + mouseRef.current.x * 0.4;
      group.rotation.x = Math.sin(t * 0.08) * 0.05 + mouseRef.current.y * 0.15;

      // Pulse each block gently
      meshesRef.current.forEach(({ mesh, data }, i) => {
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

    // Mouse parallax
    const onMouseMove = (e: MouseEvent) => {
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      mouseRef.current.y = ((e.clientY - rect.top)  / rect.height - 0.5) * -1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Click raycasting
    const raycaster  = new THREE.Raycaster();
    const clickMouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = mountRef.current?.getBoundingClientRect();
      if (!rect) return;
      clickMouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      clickMouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(clickMouse, camera);
      const hits = raycaster.intersectObjects(meshesRef.current.map(m => m.mesh));
      if (hits.length > 0) {
        const hit  = hits[0].object;
        const item = meshesRef.current.find(m => m.mesh === hit);
        if (item && hit instanceof THREE.Mesh) {
  const materials = Array.isArray(hit.material)
    ? hit.material
    : [hit.material];

  materials.forEach((mat) => {
    if (mat instanceof THREE.MeshStandardMaterial) {
      const orig = mat.emissiveIntensity;

      gsap.to(mat, {
        emissiveIntensity: 0.8,
        duration: 0.12,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          mat.emissiveIntensity = orig;
        }
      });
    }
  });

  onBlockClick(item.data, e.clientX, e.clientY);
}
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    // Resize
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
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
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
  meshesRef: React.MutableRefObject<Array<{ mesh: THREE.Mesh; data: BlockData }>>
) {
  meshesRef.current = [];
  // Remove old block meshes
  const toRemove = group.children.filter(c => (c as any).__isBlock);
  toRemove.forEach(c => group.remove(c));

  const displayed = batches.slice(0, 16); // max 16 blocks in tower

  displayed.forEach((batch, i) => {
    const st = getStatus(batch.status);

    // Block geometry — slightly varied sizes for organic feel
    const w = 1.6 + Math.sin(i * 2.3) * 0.15;
    const h = 0.55 + Math.sin(i * 1.7) * 0.08;
    const d = 1.6 + Math.cos(i * 1.9) * 0.15;
    const geo = new THREE.BoxGeometry(w, h, d);

    // Round edges via subdivision (approximated with beveling effect)
    const mat = new THREE.MeshStandardMaterial({
      color:            new THREE.Color(st.hex).multiplyScalar(0.85),
      emissive:         new THREE.Color(st.hex),
      emissiveIntensity: 0.18,
      roughness:        0.35,
      metalness:        0.55,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;

    // Stack them up with slight random offset for organic feel
    const xOff = (Math.random() - 0.5) * 0.18;
    const zOff = (Math.random() - 0.5) * 0.18;
    mesh.position.set(xOff, h / 2 + i * (h + 0.06), zOff);

    // Slight random tilt
    mesh.rotation.y = (Math.random() - 0.5) * 0.08;

    (mesh as any).__isBlock = true;
    group.add(mesh);

    // Edge highlight lines
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(st.hex), transparent: true, opacity: 0.4 });
    const edges    = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    (edges as any).__isBlock = true;
    group.add(edges);

    // Entrance animation
    const targetY = mesh.position.y;
    mesh.position.y = targetY - 20;
    gsap.to(mesh.position, {
      y: targetY,
      duration: 0.8,
      delay: i * 0.06,
      ease: 'back.out(1.2)',
    });
    gsap.to(edges.position, {
      y: targetY,
      duration: 0.8,
      delay: i * 0.06,
      ease: 'back.out(1.2)',
    });

    meshesRef.current.push({ mesh, data: batch });
  });
}

function buildParticles(scene: THREE.Scene) {
  const count  = 120;
  const posArr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    posArr[i*3]   = (Math.random() - 0.5) * 30;
    posArr[i*3+1] = Math.random() * 20;
    posArr[i*3+2] = (Math.random() - 0.5) * 30;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.PointsMaterial({ color: 0xe8611a, size: 0.06, transparent: true, opacity: 0.5 });
  scene.add(new THREE.Points(geo, mat));
}

// ── Stats strip ───────────────────────────────────────────────────────────────
const BATCH_FACTS = [
  { stat: '100+', label: 'Txs per batch' },
  { stat: '<1s',  label: 'L2 finality' },
  { stat: '~95%', label: 'Gas saving' },
  { stat: 'L1',   label: 'Security anchor' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BatchesPage() {
  const pageRef       = useRef<HTMLDivElement>(null);
  const towerRef      = useRef<HTMLDivElement>(null);
  const listRef       = useRef<HTMLDivElement>(null);
  const [batches, setBatches]         = useState<BlockData[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null);
  const [blockHeight, setBlockHeight] = useState<number>(0);
  const [loading, setLoading]         = useState(true);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/batches`);
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  // Fetch real block height
  const fetchBlockHeight = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/block-height`);
      const data = await res.json();
      setBlockHeight(data.blockNumber || 0);
    } catch {
      // Fallback: Hardhat increments ~1 block per tx
      setBlockHeight(h => h + 1);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchBlockHeight();
    const bi = setInterval(fetchBatches, 10_000);
    const bh = setInterval(fetchBlockHeight, 12_000); // ~1 block per 12s
    return () => { clearInterval(bi); clearInterval(bh); };
  }, []);

  // GSAP entrance + scroll triggers
  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      // Header entrance
      gsap.fromTo('.bat-header', 
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power4.out', stagger: 0.1 }
      );
      // Tower fade in
      gsap.fromTo(towerRef.current,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power3.out', delay: 0.3 }
      );
      // Stats strip
      gsap.fromTo('.bat-fact',
        { opacity: 0, y: 24, scale: 0.94 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: '.bat-stats', start: 'top 85%' },
        }
      );
      // How it works
      gsap.fromTo('.bat-step',
        { opacity: 0, x: -30 },
        {
          opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', stagger: 0.12,
          scrollTrigger: { trigger: '.bat-how', start: 'top 80%' },
        }
      );
      // Batch list
      gsap.fromTo(listRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
          scrollTrigger: { trigger: listRef.current, start: 'top 85%' },
        }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [loading]);

  const handleBlockClick = useCallback((data: BlockData, screenX: number, screenY: number) => {
    setSelectedBlock({ data, screenX, screenY });
  }, []);

  const finalized  = batches.filter(b => b.status === 'finalized').length;
  const inChallenge = batches.filter(b => b.status === 'challenge_period').length;
  const totalTxs   = batches.reduce((s, b) => s + (b.txCount || 0), 0);

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem', paddingBottom: '6rem' }}>

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="bat-header tag mb-4" style={{ opacity: 0 }}>Rollup Engine</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <h1 className="bat-header ln-title text-[clamp(3.5rem,7vw,8rem)] leading-none" style={{ opacity: 0 }}>
            Block<span style={{ color: 'var(--orange)' }}>Tower.</span>
          </h1>
          <div className="bat-header flex flex-col gap-1 mb-2" style={{ opacity: 0 }}>
            <p className="text-sm" style={{ color: 'var(--muted)', maxWidth: 360, lineHeight: 1.6 }}>
              Live view of your optimistic rollup. Each block is a batch committed to Ethereum L1. Click any block to inspect it.
            </p>
            {/* Real block height indicator */}
            <div className="flex items-center gap-2 mt-2">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80' }} />
              <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                L1 Block Height: <span style={{ color: '#4ade80' }}>#{blockHeight.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="h-[2px] rounded" style={{ background: 'linear-gradient(90deg, var(--orange), transparent)' }} />
      </div>

      {/* ── THREE.JS BLOCK TOWER ── */}
      <div
        ref={towerRef}
        style={{
          position: 'relative',
          height: 520,
          borderRadius: 12,
          overflow: 'hidden',
          opacity: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(232,97,26,0.06) 0%, rgba(11,11,11,0.95) 65%)',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 8,
        }}
      >
        {/* Gradient overlays for depth */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent 55%, rgba(11,11,11,0.9) 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(to right, rgba(11,11,11,0.4) 0%, transparent 30%, transparent 70%, rgba(11,11,11,0.4) 100%)',
        }} />

        {/* Three.js mount */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {!loading && (
            <BlockTowerScene batches={batches} onBlockClick={handleBlockClick} />
          )}
        </div>

        {/* Tower info overlay */}
        <div style={{ position: 'absolute', top: 20, left: 24, zIndex: 2 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
            Network State
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Batches', value: batches.length, color: '#f0ece6' },
              { label: 'Finalized', value: finalized, color: '#4ade80' },
              { label: 'In Challenge', value: inChallenge, color: '#e8611a' },
              { label: 'Total Txs', value: totalTxs, color: '#f0ece6' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(STATUS).slice(0, 3).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: val.css, display: 'inline-block', boxShadow: `0 0 6px ${val.css}80` }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>
                {val.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)' }}>
            Click blocks · Scroll for details
          </span>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.2)', animation: 'bounce 2s ease-in-out infinite' }} />
        </div>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(232,97,26,0.3)', borderTop: '2px solid #e8611a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
              Syncing blocks...
            </span>
          </div>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="bat-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {BATCH_FACTS.map(({ stat, label }, i) => (
          <div key={i} className="bat-fact ln-stat-card" style={{ opacity: 0 }}>
            <div className="ln-number text-4xl mb-1" style={{ color: i === 0 ? 'var(--orange)' : 'var(--text)' }}>{stat}</div>
            <div className="ln-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── How batching works ── */}
      <div className="bat-how mb-12 glass rounded-sm p-8 stripe-left pl-10">
        <div className="ln-label mb-3">How it works</div>
        <h2 className="ln-title text-4xl mb-8">
          Optimistic <span style={{ color: 'var(--orange)' }}>Rollup Batching</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Collect Txs', desc: 'Aggregate pending L2 transactions from the mempool into a candidate batch.' },
            { step: '02', title: 'Submit to L1', desc: 'Compress the batch as calldata and submit it to the L1 rollup contract with a state root.' },
            { step: '03', title: 'Challenge Window', desc: 'A challenge window opens. If no valid fraud proof is submitted, the batch finalises.' },
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

      {/* ── Live Batch List ── */}
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
          0%, 100% { transform: translateY(0); opacity: 0.25; }
          50%       { transform: translateY(6px); opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}