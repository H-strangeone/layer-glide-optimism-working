import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';
import { MerkleTree } from 'merkletreejs';
import SHA256 from 'crypto-js/sha256';

const FraudProof: React.FC = () => {
    const { address } = useWallet();
    const { toast } = useToast();
    const [batchId, setBatchId] = useState('');
    const [fraudProof, setFraudProof] = useState('');
    const [merkleProof, setMerkleProof] = useState('');
    const [batchData, setBatchData] = useState<string[]>([]); // Array of batch data
    const [generatedMerkleProof, setGeneratedMerkleProof] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateMerkleProof = () => {
        if (!fraudProof || batchData.length === 0) {
            toast({
                title: 'Error',
                description: 'Fraud proof and batch data are required to generate Merkle proof',
                variant: 'destructive',
            });
            return;
        }

        try {
            // Hash each batch data item
            const leaves = batchData.map((data) => SHA256(data).toString());
            const tree = new MerkleTree(leaves, SHA256);
            const leaf = SHA256(fraudProof).toString();
            const proof = tree.getProof(leaf).map((p) => p.data.toString('hex'));

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
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
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
    );
};

export default FraudProof;