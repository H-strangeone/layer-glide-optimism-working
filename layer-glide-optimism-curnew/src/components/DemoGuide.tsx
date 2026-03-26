/**
 * DemoGuide.tsx
 * Interactive step-by-step guide for demonstrating:
 * - Signature verification
 * - Nonce enforcement (replay attack prevention)
 * - Double spend prevention
 * - Merkle tree & fraud proofs
 * - Batch lifecycle
 */

import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { toast } from '@/components/ui/use-toast';
import gsap from 'gsap';
import {
  Shield, Key, Hash, Layers, AlertTriangle, CheckCircle,
  ChevronRight, ChevronDown, Terminal, Copy, ExternalLink,
  Zap, Lock, RefreshCw, Play, GitBranch, Eye
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const DEMO_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Hardhat account 1

interface StepProps {
  num: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  actions: ActionItem[];
  note?: string;
  codeBlock?: string;
}

interface ActionItem {
  label: string;
  description: string;
  type: 'manual' | 'auto' | 'warning' | 'info';
  action?: () => Promise<void>;
}

function CopyBox({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between p-3 rounded-sm"
      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
        <code className="text-xs" style={{ color: 'var(--amber)', fontFamily: "'Space Mono', monospace" }}>{text}</code>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="ml-3 p-1.5 rounded-sm transition-all"
        style={{ color: copied ? 'var(--green)' : 'var(--muted)', background: 'rgba(255,255,255,0.05)' }}
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="p-4 rounded-sm overflow-x-auto" style={{ background: '#0a0906', border: '1px solid var(--border)' }}>
      <pre className="text-xs leading-relaxed" style={{ fontFamily: "'Space Mono', monospace", color: '#c4b99a' }}>
        <code dangerouslySetInnerHTML={{ __html: code
          .replace(/^#.*/gm, m => `<span style="color:#7a6e5e">${m}</span>`)
          .replace(/"[^"]*"/g, m => `<span style="color:#f59e0b">${m}</span>`)
          .replace(/\b(curl|POST|GET)\b/g, m => `<span style="color:#14b8a6">${m}</span>`)
        }} />
      </pre>
    </div>
  );
}

export default function DemoGuide() {
  const { address, isConnected } = useWallet();
  const [activeStep, setActiveStep] = useState(0);
  const [nonce, setNonce] = useState<number | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo('.demo-header', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', stagger: 0.1 });
    gsap.fromTo('.demo-step', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08, delay: 0.3 });
  }, []);

  useEffect(() => {
    if (address) {
      fetch(`${API}/api/nonce/${address}`).then(r => r.json()).then(d => setNonce(d.nonce));
    }
    fetch(`${API}/api/batches`).then(r => r.json()).then(setBatches).catch(() => {});
  }, [address]);

  const refreshNonce = async () => {
    if (!address) return;
    const d = await fetch(`${API}/api/nonce/${address}`).then(r => r.json());
    setNonce(d.nonce);
  };

  const refreshBatches = async () => {
    const b = await fetch(`${API}/api/batches`).then(r => r.json()).catch(() => []);
    setBatches(b);
  };

  const challengeableBatches = batches.filter(b => b.status === 'challenge_period');
  const latestBatch = batches[0];

  const steps: StepProps[] = [
    {
      num: '01',
      title: 'Send a Signed L2 Transfer',
      description: 'Every L2 transaction requires an EIP-712 signature. This proves YOU authorized it — no one can forge your signature or replay an old one.',
      icon: <Key size={18} />,
      color: 'var(--amber)',
      note: '✅ What you\'ll see: MetaMask pops up asking you to sign. The system verifies your signature, increments your nonce, deducts your L2 balance instantly.',
      actions: [
        { type: 'manual', label: 'Go to Home → "L2 Transfer" tab', description: 'Click the "L2 Transfer" button in the Platform Actions section' },
        { type: 'manual', label: `Type recipient: ${DEMO_ADDRESS.slice(0,10)}...`, description: 'Use the second Hardhat account as recipient' },
        { type: 'manual', label: 'Enter amount: 0.001 ETH', description: 'Small amount for testing' },
        { type: 'manual', label: 'Click "Transfer" → Sign in MetaMask', description: 'MetaMask will ask you to sign a message (not a transaction — no gas!)' },
      ]
    },
    {
      num: '02',
      title: 'Watch Your Nonce Increment',
      description: 'After each transaction your nonce goes up by 1. If someone tries to replay an old signed message with nonce=0, the system will reject it with "Bad nonce: expected 1, got 0".',
      icon: <Hash size={18} />,
      color: 'var(--teal)',
      note: '🛡️ Replay attack protection: Each signature is bound to a specific nonce. An old signature can NEVER be reused.',
      codeBlock: `# After your transfer, check your nonce:
curl http://localhost:5500/api/nonce/${address || '0xYourAddress'}

# You'll see: { "nonce": 1 }
# Try sending the SAME signed tx again → backend rejects it:
# "Bad nonce: expected 1, got 0"`,
      actions: [
        { type: 'info', label: `Your current nonce: ${nonce ?? '...'}`, description: 'This number goes up after every transaction you send' },
        { type: 'manual', label: 'Send 2 more transfers', description: 'Watch the nonce increase: 0 → 1 → 2 → 3' },
      ]
    },
    {
      num: '03',
      title: 'Attempt a Double Spend',
      description: 'If you send 0.5 ETH but only have 0.3 ETH, the backend rejects it immediately — your pending balance is checked BEFORE accepting the transaction.',
      icon: <AlertTriangle size={18} />,
      color: 'var(--red)',
      note: '❌ Expected result: "Insufficient L2 balance for 0x..." — The system protects against double spends optimistically.',
      codeBlock: `# Try sending more than your balance:
# Go to L2 Transfer and enter an amount > your L2 balance
# The error message will be:
# "Insufficient L2 balance for 0x..."

# This works because pendingWei is updated immediately
# on every accepted tx — double spend is impossible`,
      actions: [
        { type: 'manual', label: 'Check your L2 balance on the dashboard', description: 'Note your current balance' },
        { type: 'manual', label: 'Try to send MORE than your balance', description: 'Enter an amount larger than your L2 balance in the Transfer form' },
        { type: 'warning', label: '→ You\'ll see: "Insufficient L2 balance"', description: 'The system prevents double spends before they reach the mempool' },
      ]
    },
    {
      num: '04',
      title: 'Watch a Batch Get Created',
      description: 'The sequencer bundles pending transactions every 10 seconds. Each batch computes a Merkle tree of all transactions and a state root of all balances.',
      icon: <Layers size={18} />,
      color: 'var(--amber)',
      note: '⏱️ Wait up to 10 seconds after your transfer. The sequencer will pick it up and create a batch with a txRoot (Merkle root of transactions) and stateRoot (Merkle root of balances).',
      actions: [
        { type: 'manual', label: 'Go to the Batches page', description: 'Navigate to /batches' },
        { type: 'manual', label: 'Wait 10 seconds after your transfer', description: 'The sequencer runs every 10s' },
        { type: 'manual', label: 'Refresh — you\'ll see a new batch', description: 'Status: "Challenge" with a 5-minute countdown' },
        { type: 'info', label: `Current batches: ${batches.length} | Challengeable: ${challengeableBatches.length}`, description: 'Batches in challenge window can be fraud-proofed' },
      ]
    },
    {
      num: '05',
      title: 'The Merkle Tree Explained',
      description: 'Each batch contains a txRoot: the Merkle root of all transaction hashes. This lets anyone prove a specific transaction IS in a batch using just a short proof path (O(log n) hashes).',
      icon: <GitBranch size={18} />,
      color: 'var(--teal)',
      note: '🌳 If the batch has 4 txs, the Merkle tree has 4 leaves. You only need 2 hashes (siblings) to prove your tx is in the root — not all 4. At 1000 txs you only need ~10 hashes.',
      codeBlock: `# Generate a fraud proof (this builds the Merkle tree):
curl -X POST http://localhost:5500/api/fraud-proof/generate \\
  -H "Content-Type: application/json" \\
  -d '{"batchId": "PASTE_BATCH_UUID_HERE", "txIndex": 0}'

# Response includes:
# - fraudulentTxHash: keccak256(from, to, value, nonce)
# - txProof: [sibling hashes up the tree]
# - computedTxRoot: what the root SHOULD be
# - correctStateRoot: what the state SHOULD be after execution`,
      actions: [
        { type: 'manual', label: 'Go to Fraud Proof page → Marketplace tab', description: 'You\'ll see batches in the challenge window' },
        { type: 'manual', label: 'Click "Generate Proof" on any batch', description: 'This re-executes all txs and computes the correct Merkle root' },
        { type: 'info', label: 'The proof verifies: tx IS in this batch\'s txRoot', description: 'Merkle proof = path from leaf to root' },
      ]
    },
    {
      num: '06',
      title: 'Submit a Fraud Proof',
      description: 'A batch is fraudulent when its submitted stateRoot ≠ the correct stateRoot from re-executing all transactions. To test this: a batch whose stateRoot was tampered shows isFraudulent: true.',
      icon: <Shield size={18} />,
      color: 'var(--red)',
      note: '⚡ In production: The sequencer gets slashed 0.05 ETH, you earn 0.025 ETH. In dev/DB-only mode: the batch is marked rejected and state is reverted.',
      codeBlock: `# Full fraud proof flow:
# 1. Find a batch in challenge period:
curl http://localhost:5500/api/fraud-proof/challengeable

# 2. Generate proof (copy the batchId UUID from step 1):
curl -X POST http://localhost:5500/api/fraud-proof/generate \\
  -H "Content-Type: application/json" \\
  -d '{"batchId": "UUID_HERE", "txIndex": 0}'

# 3. If isFraudulent: true, submit it:
curl -X POST http://localhost:5500/api/fraud-proof/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "batchId": "UUID_HERE",
    "fraudulentTxHash": "0x...",
    "txProof": ["0x...", "0x..."],
    "correctStateRoot": "0x...",
    "challengerAddress": "${address || '0xYourAddress'}"
  }'`,
      actions: [
        { type: 'manual', label: 'On Fraud Proof page → Marketplace', description: 'Find a batch in challenge window' },
        { type: 'manual', label: 'Click "Generate Proof"', description: 'System recomputes state and checks validity' },
        { type: 'manual', label: 'If fraud detected → click "Submit Fraud Proof"', description: 'In normal operation batches are valid — for demo use manual tab' },
        { type: 'info', label: 'For forced fraud demo: Use Manual Submit tab', description: 'Enter any batch UUID and a fake correctStateRoot' },
      ]
    },
    {
      num: '07',
      title: 'Batch Finalization',
      description: 'After 5 minutes (dev) with no valid challenge, the batch auto-finalizes. Only then does your finalizedBalance update — and only then can you withdraw to L1.',
      icon: <CheckCircle size={18} />,
      color: 'var(--green)',
      note: '🔒 After finalization: pendingBalance = finalizedBalance. You can now use "Withdraw" to exit back to L1 with a Merkle proof.',
      actions: [
        { type: 'info', label: 'Challenge period: 5 min (dev) / 7 days (prod)', description: 'Countdown visible on each batch card' },
        { type: 'manual', label: 'Wait 5 min → batch status changes to "Finalized"', description: 'Auto-finalizer runs every 30s' },
        { type: 'manual', label: 'Check balances: L2 Finalized now matches L2 Available', description: 'Go to Home page to see both balance columns' },
        { type: 'manual', label: 'Try Withdraw → enter your finalized amount', description: 'You\'ll get an L1 transaction with your ETH back' },
      ]
    },
  ];

  return (
    <div ref={pageRef} style={{ maxWidth: 1280, margin: '0 auto', paddingTop: '2rem' }}>
      {/* Header */}
      <div className="mb-12">
        <div className="demo-header tag mb-4" style={{ opacity: 0 }}>Interactive Walkthrough</div>
        <h1 className="demo-header ln-title text-[clamp(3rem,6vw,5rem)] mb-4" style={{ opacity: 0 }}>
          Demo <span style={{ color: 'var(--amber)' }}>Guide.</span>
        </h1>
        <p className="demo-header text-base leading-relaxed max-w-2xl" style={{ opacity: 0, color: 'var(--text-dim)' }}>
          Step-by-step demonstration of every security feature: signature verification, nonce enforcement,
          double-spend prevention, Merkle proofs, and fraud detection.
        </p>
        <div className="mt-5 h-px" style={{ background: 'linear-gradient(90deg, var(--amber), var(--teal), transparent)' }} />
      </div>

      {/* Wallet info box */}
      {isConnected && (
        <div className="demo-header mb-8 p-4 rounded-sm" style={{ opacity: 0, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CopyBox text={address || ''} label="Your Address (Account 0)" />
            <CopyBox text={DEMO_ADDRESS} label="Recipient (Account 1 — for transfers)" />
            <div className="flex items-center justify-between p-3 rounded-sm"
              style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)' }}>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--muted)' }}>Current Nonce</div>
                <div className="text-xl font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--teal)' }}>
                  {nonce ?? '...'}
                </div>
              </div>
              <button onClick={refreshNonce} className="p-1.5 rounded-sm" style={{ color: 'var(--muted)' }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isOpen = activeStep === idx;
          const Icon = step.icon;
          return (
            <div key={idx} className="demo-step rounded-sm overflow-hidden transition-all duration-300"
              style={{ opacity: 0, background: 'var(--card)', border: `1px solid ${isOpen ? 'var(--amber-line)' : 'var(--border)'}` }}>

              {/* Step header */}
              <button
                className="w-full p-5 flex items-center justify-between text-left transition-all"
                style={{ background: isOpen ? 'rgba(245,158,11,0.03)' : 'transparent' }}
                onClick={() => setActiveStep(isOpen ? -1 : idx)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      background: isOpen ? step.color : 'var(--subtle)',
                      color: isOpen ? '#000' : 'var(--muted)',
                    }}>
                    {step.num}
                  </div>
                  <div style={{ color: step.color }}>
                    {step.icon}
                  </div>
                  <div>
                    <div className="font-bold text-sm uppercase tracking-wide" style={{ fontFamily: "'Syne', sans-serif", color: isOpen ? 'var(--text)' : 'var(--text-dim)' }}>
                      {step.title}
                    </div>
                    {!isOpen && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {step.description.slice(0, 80)}...
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--muted)' }} />
              </button>

              {/* Step content */}
              {isOpen && (
                <div className="px-5 pb-6 space-y-5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm leading-relaxed pt-4" style={{ color: 'var(--text-dim)' }}>
                    {step.description}
                  </p>

                  {/* Actions */}
                  <div className="space-y-2">
                    <div className="ln-label mb-3">Steps to follow</div>
                    {step.actions.map((action, ai) => (
                      <div key={ai} className="flex gap-3 p-3 rounded-sm transition-all"
                        style={{
                          background: action.type === 'warning' ? 'rgba(248,113,113,0.06)'
                            : action.type === 'info' ? 'rgba(20,184,166,0.06)'
                            : action.type === 'auto' ? 'rgba(245,158,11,0.06)'
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${action.type === 'warning' ? 'rgba(248,113,113,0.15)'
                            : action.type === 'info' ? 'rgba(20,184,166,0.15)'
                            : action.type === 'auto' ? 'rgba(245,158,11,0.15)'
                            : 'var(--border)'}`,
                        }}>
                        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                          style={{ background: 'var(--amber)', color: '#000', fontFamily: "'Space Mono', monospace" }}>
                          {ai + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{action.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{action.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Code block */}
                  {step.codeBlock && (
                    <div>
                      <div className="ln-label mb-2 flex items-center gap-2">
                        <Terminal size={10} />
                        API Commands
                      </div>
                      <CodeBlock code={step.codeBlock} />
                    </div>
                  )}

                  {/* Note */}
                  {step.note && (
                    <div className="p-3 rounded-sm text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-dim)' }}>
                      {step.note}
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setActiveStep(Math.max(0, idx - 1))}
                      disabled={idx === 0}
                      className="btn-ghost text-xs"
                    >
                      ← Previous
                    </button>
                    {idx < steps.length - 1 ? (
                      <button onClick={() => setActiveStep(idx + 1)} className="btn-primary text-xs px-6 py-2">
                        Next Step <ChevronRight size={12} className="ml-1" />
                      </button>
                    ) : (
                      <div className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                        ✓ Demo Complete!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick reference */}
      <div className="mt-12 p-6 rounded-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="ln-label mb-4">Quick Reference — What Each Attack Looks Like</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Replay Attack',
              how: 'Reuse a signed tx from nonce 0',
              result: 'Error: Bad nonce: expected 1, got 0',
              color: 'var(--red)',
            },
            {
              title: 'Double Spend',
              how: 'Send 1 ETH when you only have 0.5',
              result: 'Error: Insufficient L2 balance',
              color: 'var(--red)',
            },
            {
              title: 'Bad Signature',
              how: 'Sign with wrong wallet / tamper sig',
              result: 'Error: Signature mismatch: expected 0x...',
              color: 'var(--red)',
            },
          ].map(item => (
            <div key={item.title} className="p-4 rounded-sm" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <div className="font-bold text-sm mb-2" style={{ fontFamily: "'Syne', sans-serif", color: item.color }}>
                {item.title}
              </div>
              <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--muted)' }}>How:</span> {item.how}
              </div>
              <div className="text-xs font-mono p-2 rounded-sm" style={{ background: 'rgba(0,0,0,0.3)', color: item.color }}>
                {item.result}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}