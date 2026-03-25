import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';
import { generateFraudProof, submitFraudProofFromBackend } from '../lib/ethers';
import { ShieldAlert, ShieldCheck, Clock, Trophy, Zap, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChallengeableBatch {
  id: string;
  onChainId: string;
  transactionsRoot: string;
  stateRoot: string;
  txCount: number;
  timeLeftMs: number;
  challengeEndsAt: string;
  submitter: string;
  status: string;
}

interface FraudProofResult {
  isFraudulent: boolean;
  fraudulentTxHash: string;
  txProof: string[];
  correctStateRoot: string;
  claimedStateRoot: string;
  explanation: string;
  disputedTransaction: any;
  contractCallParams: any;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

export default function FraudProofMarketplace() {
  const { address } = useWallet();
  const { toast }   = useToast();

  const [batches,       setBatches]       = useState<ChallengeableBatch[]>([]);
  const [challenges,    setChallenges]    = useState<any[]>([]);
  const [generating,    setGenerating]    = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState<string | null>(null);
  const [proofResult,   setProofResult]   = useState<FraudProofResult | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        fetch(`${API}/api/fraud-proof/challengeable`),
        fetch(`${API}/api/fraud-proof/challenges`),
      ]);
      if (bRes.ok) setBatches(await bRes.json());
      if (cRes.ok) setChallenges(await cRes.json());
    } catch {}
    setLoading(false);
  };

  const handleGenerate = async (batchId: string) => {
    setGenerating(batchId);
    setSelectedBatch(batchId);
    setProofResult(null);
    try {
      const proof = await generateFraudProof(batchId);
      setProofResult(proof);
      toast({
        title: proof.isFraudulent ? '🚨 Fraud Detected!' : '✅ Batch Appears Valid',
        description: proof.explanation,
        variant: proof.isFraudulent ? 'destructive' : 'default',
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const handleSubmit = async () => {
    if (!proofResult || !selectedBatch || !address) return;
    setSubmitting(selectedBatch);
    try {
      await submitFraudProofFromBackend(selectedBatch, address, proofResult);
      toast({ title: '⚡ Fraud Proof Submitted!', description: 'The batch has been challenged on-chain. If accepted, you earn 50% of the slashed bond.' });
      setProofResult(null);
      setSelectedBatch(null);
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Submission Failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  };

  const formatTimeLeft = (ms: number) => {
    if (ms <= 0) return 'Expired';
    const s = Math.floor(ms / 1000);
    if (s < 60)  return `${s}s left`;
    if (s < 3600) return `${Math.floor(s/60)}m left`;
    return `${Math.floor(s/3600)}h left`;
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <div className="p-3 rounded-sm bg-orange/10 border border-orange/20">
          <ShieldAlert size={24} className="text-orange" />
        </div>
        <div>
          <h3 className="ln-title text-2xl tracking-tight">Fraud Proof Marketplace</h3>
          <p className="ln-label text-xs">Challenge invalid batches · Earn 50% of slashed bonds</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/20">
          <Trophy size={12} className="text-orange" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange">
            {challenges.filter(c => c.status === 'accepted').length} Successful Challenges
          </span>
        </div>
      </div>

      {/* How It Works */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Eye,          n: '01', title: 'Scan Batches',    desc: 'Browse batches in the challenge window' },
          { icon: ShieldAlert,  n: '02', title: 'Generate Proof',  desc: 'Auto-compute if state root is wrong' },
          { icon: Zap,          n: '03', title: 'Submit On-Chain', desc: 'Submit fraud proof to L1 contract' },
          { icon: Trophy,       n: '04', title: 'Earn Reward',     desc: '50% of 0.05 ETH slashed bond = 0.025 ETH' },
        ].map(({ icon: Icon, n, title, desc }, i) => (
          <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-7 h-7 rounded-sm bg-orange flex items-center justify-center text-[10px] font-black text-black">{n}</div>
              <Icon size={14} className="text-orange" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-text mb-1">{title}</p>
            <p className="text-[10px] text-muted leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Challengeable Batches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="ln-label uppercase tracking-widest">Challengeable Batches ({batches.length})</h4>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <div className="w-2 h-2 rounded-full bg-orange anim-pulse-orange" />
            Live · updates every 10s
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="anim-spin text-orange" />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 bg-white/5 rounded-sm border border-white/5">
            <ShieldCheck size={40} className="text-green-500 opacity-40" />
            <p className="ln-label text-xs text-center">No batches in challenge window<br/>All submitted batches have been finalized or are not yet challengeable</p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map(batch => (
              <div key={batch.id} className={`bg-white/5 border rounded-sm p-5 transition-colors ${selectedBatch === batch.id ? 'border-orange/40' : 'border-white/5 hover:border-orange/20'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-widest">
                        Batch #{batch.onChainId || batch.id.slice(0, 8)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                        batch.timeLeftMs < 60_000
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : 'bg-orange/10 text-orange border-orange/20'
                      }`}>
                        <Clock size={8} className="inline mr-1" />
                        {formatTimeLeft(batch.timeLeftMs)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] text-muted mt-2">
                      <div><span className="text-white/40">TxRoot:</span> <span className="font-mono">{batch.transactionsRoot.slice(0, 10)}...</span></div>
                      {batch.stateRoot && <div><span className="text-white/40">StateRoot:</span> <span className="font-mono">{batch.stateRoot.slice(0, 10)}...</span></div>}
                      <div><span className="text-white/40">Txs:</span> {batch.txCount}</div>
                      <div><span className="text-white/40">Submitter:</span> <span className="font-mono">{batch.submitter?.slice(0,6)}...{batch.submitter?.slice(-4)}</span></div>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleGenerate(batch.id)}
                    disabled={generating === batch.id}
                    className="btn-outline text-xs px-6"
                  >
                    {generating === batch.id
                      ? <><Loader2 size={14} className="anim-spin mr-2" />Analyzing...</>
                      : <><Eye size={14} className="mr-2" />Generate Proof</>}
                  </Button>
                </div>

                {/* Proof Result */}
                {selectedBatch === batch.id && proofResult && (
                  <div className={`mt-4 p-4 rounded-sm border ${
                    proofResult.isFraudulent
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-green-500/10 border-green-500/20'
                  }`}>
                    <div className="flex items-start gap-3">
                      {proofResult.isFraudulent
                        ? <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                        : <ShieldCheck size={18} className="text-green-400 mt-0.5 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm font-bold mb-1">
                          {proofResult.isFraudulent ? '🚨 Fraud Detected!' : '✅ Batch Appears Valid'}
                        </p>
                        <p className="text-[11px] text-muted mb-3">{proofResult.explanation}</p>

                        {proofResult.isFraudulent && (
                          <div className="space-y-2 text-[10px] font-mono mb-4">
                            <div><span className="text-white/40">Claimed root: </span>{proofResult.claimedStateRoot?.slice(0, 20)}...</div>
                            <div><span className="text-white/40">Correct root: </span>{proofResult.correctStateRoot?.slice(0, 20)}...</div>
                            <div><span className="text-white/40">Proof length: </span>{proofResult.txProof?.length} nodes</div>
                          </div>
                        )}

                        {proofResult.isFraudulent && (
                          <Button
                            onClick={handleSubmit}
                            disabled={!!submitting || !address}
                            className="btn-primary text-xs px-8"
                          >
                            {submitting
                              ? <><Loader2 size={14} className="anim-spin mr-2" />Submitting On-Chain...</>
                              : <><ShieldAlert size={14} className="mr-2" />Submit Fraud Proof & Earn Reward</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenge History */}
      {challenges.length > 0 && (
        <div>
          <h4 className="ln-label uppercase tracking-widest mb-4">Challenge History ({challenges.length})</h4>
          <div className="space-y-2">
            {challenges.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-sm text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${c.status === 'accepted' ? 'bg-green-500' : c.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <span className="font-mono text-muted">{c.challengerAddress?.slice(0,6)}...{c.challengerAddress?.slice(-4)}</span>
                  <span className="text-muted">challenged batch</span>
                  <span className="font-mono">{c.batch?.onChainId || c.batchId?.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    c.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                    c.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>{c.status}</span>
                  <span className="text-muted">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}