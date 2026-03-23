import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';
import { MerkleTree } from 'merkletreejs';
import SHA256 from 'crypto-js/sha256';
import { ShieldAlert, FileSearch, Zap, Loader2, CheckCircle } from 'lucide-react';

const FraudProof: React.FC = () => {
    const { address } = useWallet();
    const { toast } = useToast();
    const [batchId, setBatchId] = useState('');
    const [fraudProof, setFraudProof] = useState('');
    const [merkleProof, setMerkleProof] = useState('');
    const [batchData, setBatchData] = useState<string[]>([]);
    const [generatedMerkleProof, setGeneratedMerkleProof] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateMerkleProof = () => {
        if (!fraudProof || batchData.length === 0) {
            toast({ title: 'Error', description: 'Evidence required', variant: 'destructive' });
            return;
        }
        try {
            const leaves = batchData.map((data) => SHA256(data).toString());
            const tree = new MerkleTree(leaves, SHA256);
            const leaf = SHA256(fraudProof).toString();
            const proof = tree.getProof(leaf).map((p) => p.data.toString('hex'));
            setGeneratedMerkleProof(proof);
            toast({ title: 'Success', description: 'Merkle proof generated' });
        } catch (error) {
            toast({ title: 'Error', description: 'Generation failed', variant: 'destructive' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) { toast({ title: 'Error', description: 'Connect wallet', variant: 'destructive' }); return; }
        if (!batchId || !fraudProof || !merkleProof) {
            toast({ title: 'Error', description: 'Missing fields', variant: 'destructive' }); return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('http://localhost:5500/api/rollup/fraud-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId, fraudProof, merkleProof }),
            });
            const result = await response.json();
            if (!result.isValid) throw new Error('Proof is invalid');

            toast({ title: 'Verified', description: 'Fraud proof accepted' });
            setBatchId(''); setFraudProof(''); setMerkleProof('');
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Verification failed', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="p-3 rounded-sm bg-orange/10 border border-orange/20">
                    <ShieldAlert size={24} className="text-orange" />
                </div>
                <div>
                    <h3 className="ln-title text-2xl tracking-tight">Dispute Resolution</h3>
                    <p className="ln-label text-xs">Cryptographic challenge system</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="batchId" className="ln-label text-[10px]">Target Batch ID</Label>
                            <Input
                                id="batchId"
                                placeholder="0x..."
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                                className="ln-input font-mono text-xs"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fraudProof" className="ln-label text-[10px]">Challenge Evidence (Data)</Label>
                            <Textarea
                                id="fraudProof"
                                placeholder="Raw transaction or state data..."
                                value={fraudProof}
                                onChange={(e) => setFraudProof(e.target.value)}
                                className="ln-input min-h-[120px] text-xs font-mono"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="merkleProof" className="ln-label text-[10px]">Merkle Proof</Label>
                            <div className="relative">
                                <Textarea
                                    id="merkleProof"
                                    placeholder="Serialized proof path..."
                                    value={merkleProof}
                                    onChange={(e) => setMerkleProof(e.target.value)}
                                    className="ln-input min-h-[120px] text-xs font-mono"
                                    disabled={isSubmitting}
                                />
                                <Button
                                    type="button"
                                    onClick={generateMerkleProof}
                                    variant="outline"
                                    className="absolute bottom-3 right-3 h-8 text-[10px] font-bold border-orange/20 hover:bg-orange/10 hover:text-orange"
                                >
                                    Auto-Generate
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batchData" className="ln-label text-[10px]">Full Batch Leaves (Optional)</Label>
                            <Textarea
                                id="batchData"
                                placeholder="Leaf1, Leaf2, ..."
                                value={batchData.join(',')}
                                onChange={(e) => setBatchData(e.target.value.split(',').filter(x => x.trim()))}
                                className="ln-input min-h-[80px] text-xs font-mono"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                {generatedMerkleProof.length > 0 && (
                    <div className="p-4 bg-orange/5 border border-orange/10 rounded-sm anim-fade-up">
                        <div className="ln-label text-[9px] mb-2 uppercase tracking-widest text-orange flex items-center gap-2">
                           <FileSearch size={12} /> Generated Path
                        </div>
                        <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted max-h-32 overflow-y-auto">
                            {generatedMerkleProof.join('\n')}
                        </pre>
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-center gap-6 pt-6 border-t border-white/5">
                    <div className="flex-1">
                        <p className="text-[10px] text-muted italic">
                            Challenges are processed by the Layer 1 Rollup contract. If the proof is valid, the batch is reverted and the proposer is slashed.
                        </p>
                    </div>
                    <Button
                        type="submit"
                        disabled={isSubmitting || !address}
                        className="btn-primary px-12 py-6 text-base group"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                        ) : (
                            <>Submit Challenge <ShieldAlert className="ml-2 h-4 w-4 group-hover:scale-125 transition-transform" /></>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default FraudProof;