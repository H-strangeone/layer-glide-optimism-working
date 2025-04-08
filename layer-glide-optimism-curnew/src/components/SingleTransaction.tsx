import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { executeL2Transaction } from "@/lib/ethers";
import { Loader2, Send } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

interface SingleTransactionProps {
    onSuccess?: (transaction: any) => void;
}

export function SingleTransaction({ onSuccess }: SingleTransactionProps) {
    const [to, setTo] = useState("");
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { address } = useWallet();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!to || !amount) {
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        if (!address) {
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            const tx = await executeL2Transaction(to, amount);
            const transaction = {
                hash: tx.hash,
                from: address,
                to: to,
                value: amount,
                status: "pending",
                createdAt: Math.floor(Date.now() / 1000),
            };

            if (onSuccess) {
                await onSuccess(transaction);
            }

            toast({
                title: "Success",
                description: "Transaction submitted successfully",
            });

            setTo("");
            setAmount("");
        } catch (error) {
            console.error("Transaction error:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to submit transaction",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
            <CardHeader className="relative">
                <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    Send Funds
                </CardTitle>
                <CardDescription className="text-white/70">
                    Transfer ETH to another address on Layer 2
                </CardDescription>
            </CardHeader>
            <CardContent className="relative">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="to" className="text-sm font-medium text-white/70">
                            Recipient Address
                        </label>
                        <Input
                            id="to"
                            type="text"
                            placeholder="0x..."
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="amount" className="text-sm font-medium text-white/70">
                            Amount (ETH)
                        </label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.000000000000000001"
                            placeholder="0.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                            disabled={isLoading}
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Transaction
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
} 