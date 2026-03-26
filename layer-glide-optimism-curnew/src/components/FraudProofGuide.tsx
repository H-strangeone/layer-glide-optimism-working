/**
 * FraudProofGuide
 * 
 * Feature 9: Educational popup explaining the fraud proof process.
 * Opens when user clicks the ℹ icon on the fraud proof page.
 */

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Shield, ShieldAlert, GitBranch, Hash, AlertTriangle, CheckCircle, ChevronRight, Info } from 'lucide-react';

const STEPS = [
  {
    n: '01', icon: GitBranch, color: '#e8611a',
    title: 'How Optimistic Rollups Work',
    body: `LayerGlide assumes all transactions are VALID by default (optimistic). 
Transactions are batched and submitted to Ethereum L1 with a state root — 
a single hash that represents ALL account balances.

The challenge period (5 min dev / 7 days prod) gives anyone time to dispute.`
  },
  {
    n: '02', icon: Hash, color: '#5db87a',
    title: 'What is a Merkle Tree?',
    body: `A Merkle tree is a binary tree where every leaf is a hash of a transaction,
and every parent is a hash of its children.

The ROOT of the tree (txRoot) uniquely represents the entire batch.
If ANY single transaction changes — the root changes entirely.

This means you can PROVE a specific transaction is in a batch using only
a short "proof path" (O(log n) hashes), not the entire batch.`
  },
  {
    n: '03', icon: ShieldAlert, color: '#d96060',
    title: 'Detecting Fraud',
    body: `Fraud occurs when the submitted stateRoot doesn't match what you compute
by re-executing the transactions.

LayerGlide generates a fraud proof by:
1. Re-executing all transactions in the batch locally
2. Computing what the stateRoot SHOULD be
3. Comparing against the claimed stateRoot on-chain

If they differ → the sequencer lied → fraud confirmed.`
  },
  {
    n: '04', icon: CheckCircle, color: '#5db87a',
    title: 'Submitting a Fraud Proof',
    body: `To challenge a batch:
1. Find a batch in the "Challenge Period" tab
2. Click "Generate Proof" — LayerGlide recomputes the state
3. If fraud is detected, click "Submit Fraud Proof On-Chain"

The contract verifies:
• The disputed tx IS in the batch (via Merkle proof)
• The claimed stateRoot DIFFERS from correct execution
• The challenge is within the time window

If valid: operator is slashed 0.05 ETH, you get 50% (~0.025 ETH).`
  },
  {
    n: '05', icon: AlertTriangle, color: '#e8611a',
    title: 'Important Notes',
    body: `• False challenges cost gas with no reward — only challenge with evidence
• The challenge window is 5 minutes in dev mode, 7 days in production
• State roots chain together: each batch references the previous root
• Balances only become FINAL after the challenge period passes
• Withdrawals require a Merkle proof from the FINALIZED state root`
  }
];

interface FraudProofGuideProps {
  open:    boolean;
  onClose: () => void;
}

export default function FraudProofGuide({ open, onClose }: FraudProofGuideProps) {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const Icon = cur.icon;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setStep(0); } }}>
      <DialogContent className="max-w-2xl border border-orange/20 bg-[#0f0f0f]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-sm bg-orange/10 border border-orange/20">
              <Shield size={20} className="text-orange" />
            </div>
            <div>
              <DialogTitle className="ln-title text-2xl tracking-tight">
                Fraud Proof Guide
              </DialogTitle>
              <DialogDescription className="ln-label text-[10px]">
                How to protect the network and earn rewards
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="flex-1 h-1 rounded-full transition-all"
              style={{ background: i === step ? 'var(--orange)' : i < step ? 'rgba(232,97,26,0.4)' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center font-black text-sm"
              style={{ background: `${cur.color}20`, border: `1px solid ${cur.color}40`, color: cur.color, fontFamily: "'Barlow Condensed',sans-serif" }}
            >
              {cur.n}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} style={{ color: cur.color }} />
                <h3 className="font-black text-base uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed',sans-serif" }}>
                  {cur.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                {cur.body}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-ghost text-xs"
          >
            ← Previous
          </button>

          <span className="ln-label text-[10px]">
            {step + 1} / {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary text-xs px-6 py-2">
              Next <ChevronRight size={12} className="ml-1" />
            </button>
          ) : (
            <button onClick={() => { onClose(); setStep(0); }} className="btn-primary text-xs px-6 py-2">
              Got it ✓
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button to open the guide — drop this anywhere on the fraud proof page
 */
export function FraudProofGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors"
        style={{ color: 'var(--muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        title="How does fraud proof work?"
      >
        <Info size={12} />
        How it works
      </button>
      <FraudProofGuide open={open} onClose={() => setOpen(false)} />
    </>
  );
}