import React, { useState } from 'react';
import { Button } from './ui/button';
<<<<<<< HEAD
=======
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';
import { MerkleTree } from 'merkletreejs';
import SHA256 from 'crypto-js/sha256';
<<<<<<< HEAD
import { ShieldAlert, FileSearch, Zap, Loader2, CheckCircle } from 'lucide-react';
=======
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d

const FraudProof: React.FC = () => {
    const { address } = useWallet();
    const { toast } = useToast();
    const [batchId, setBatchId] = useState('');
    const [fraudProof, setFraudProof] = useState('');
    const [merkleProof, setMerkleProof] = useState('');
<<<<<<< HEAD
    const [batchData, setBatchData] = useState<string[]>([]);
=======
    const [batchData, setBatchData] = useState<string[]>([]); // Array of batch data
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
    const [generatedMerkleProof, setGeneratedMerkleProof] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateMerkleProof = () => {
        if (!fraudProof || batchData.length === 0) {
<<<<<<< HEAD
            toast({ title: 'Error', description: 'Evidence required', variant: 'destructive' });
            return;
        }
        try {
=======
            toast({
                title: 'Error',
                description: 'Fraud proof and batch data are required to generate Merkle proof',
                variant: 'destructive',
            });
            return;
        }

        try {
            // Hash each batch data item
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
            const leaves = batchData.map((data) => SHA256(data).toString());
            const tree = new MerkleTree(leaves, SHA256);
            const leaf = SHA256(fraudProof).toString();
            const proof = tree.getProof(leaf).map((p) => p.data.toString('hex'));
<<<<<<< HEAD
            setGeneratedMerkleProof(proof);
            toast({ title: 'Success', description: 'Merkle proof generated' });
        } catch (error) {
            toast({ title: 'Error', description: 'Generation failed', variant: 'destructive' });
=======

            setGeneratedMerkleProof(proof);

            toast({
                title: 'Success',
                description: 'Merkle proof generated successfully',
            });
        } catch (error) {
            console.error('Error generating Merkle proof:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate Merkle proof',
                variant: 'destructive',
            });
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
<<<<<<< HEAD
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
=======

        if (!address) {
            toast({
                title: 'Error',
                description: 'Please connect your wallet first',
                variant: 'destructive',
            });
            return;
        }

        if (!batchId || !fraudProof || !merkleProof) {
            toast({
                title: 'Error',
                description: 'Batch ID, fraud proof, and Merkle proof are required',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const verificationResponse = await fetch('http://localhost:5500/api/rollup/fraud-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    batchId,
                    fraudProof,
                    merkleProof,
                }),
            });

            const verificationResult = await verificationResponse.json();

            if (!verificationResult.isValid) {
                toast({
                    title: 'Error',
                    description: 'Fraud proof is invalid',
                    variant: 'destructive',
                });
                return;
            }

            toast({
                title: 'Success',
                description: 'Fraud proof verified successfully',
            });

            setBatchId('');
            setFraudProof('');
            setMerkleProof('');
        } catch (error) {
            console.error('Error:', error);
            toast({
                title: 'Error',
                description: 'Failed to verify fraud proof',
                variant: 'destructive',
            });
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
<<<<<<< HEAD
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
=======
        <Card className="w-full max-w-2xl mx-auto glass-card border border-white/10 backdrop-blur-md bg-black/30">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
            <CardHeader className="relative">
                <CardTitle className="text-xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Submit Fraud Proof</CardTitle>
                <CardDescription className="text-white/70">
                    Submit a fraud proof to challenge a batch of transactions
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 relative">
                    <div className="space-y-2">
                        <Label htmlFor="batchId" className="text-white/70">Batch ID</Label>
                        <Input
                            id="batchId"
                            placeholder="Enter the batch ID to challenge"
                            value={batchId}
                            onChange={(e) => setBatchId(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fraudProof" className="text-white/70">Fraud Proof</Label>
                        <Textarea
                            id="fraudProof"
                            placeholder="Enter the fraud proof data"
                            value={fraudProof}
                            onChange={(e) => setFraudProof(e.target.value)}
                            className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/50"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="merkleProof" className="text-white/70">Merkle Proof</Label>
                        <Textarea
                            id="merkleProof"
                            placeholder="Enter the Merkle proof"
                            value={merkleProof}
                            onChange={(e) => setMerkleProof(e.target.value)}
                            className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-white/50"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="batchData" className="text-white/70">Batch Data</Label>
                        <Textarea
                            id="batchData"
                            placeholder="Enter batch data (comma-separated)"
                            value={batchData.join(',')}
                            onChange={(e) => setBatchData(e.target.value.split(','))}
                            className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <Button
                            type="button"
                            onClick={generateMerkleProof}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                            Generate Merkle Proof
                        </Button>
                    </div>
                    {generatedMerkleProof.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-white/70">Generated Merkle Proof</Label>
                            <Textarea
                                readOnly
                                value={generatedMerkleProof.join('\n')}
                                className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/50"
                            />
                        </div>
                    )}
                </CardContent>
                <CardFooter className="relative">
                    <Button
                        type="submit"
                        disabled={isSubmitting || !address}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Fraud Proof'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
    );
};

export default FraudProof;