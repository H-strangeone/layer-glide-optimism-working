import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';

const FraudProof: React.FC = () => {
    const { address } = useWallet();
    const { toast } = useToast();
    const [batchId, setBatchId] = useState('');
    const [fraudProof, setFraudProof] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

        if (!batchId || !fraudProof) {
            toast({
                title: 'Error',
                description: 'Batch ID and fraud proof are required',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('http://localhost:5500/api/rollup/fraud-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    batchId,
                    challengerAddress: address,
                    fraudProof,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit fraud proof');
            }

            const data = await response.json();

            toast({
                title: 'Success',
                description: 'Fraud proof submitted successfully',
            });

            setBatchId('');
            setFraudProof('');
        } catch (error) {
            console.error('Error submitting fraud proof:', error);
            toast({
                title: 'Error',
                description: 'Failed to submit fraud proof',
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