import { useState } from "react";
<<<<<<< HEAD
=======
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { executeL2Transaction } from "@/lib/ethers";
<<<<<<< HEAD
import { Loader2, Send, Zap, User } from "lucide-react";
=======
import { Loader2, Send } from "lucide-react";
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
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
<<<<<<< HEAD
            toast({ title: "Error", description: "All fields required", variant: "destructive" });
=======
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive",
            });
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
            return;
        }

        if (!address) {
<<<<<<< HEAD
            toast({ title: "Error", description: "Connect wallet first", variant: "destructive" });
=======
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
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

<<<<<<< HEAD
            if (onSuccess) await onSuccess(transaction);
            toast({ title: "Success", description: "L2 Transfer submitted" });
            setTo(""); setAmount("");
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Transfer failed",
=======
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
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
<<<<<<< HEAD
        <div className="relative overflow-hidden w-full max-w-xl mx-auto">
            <div className="p-1">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-sm bg-orange/10 border border-orange/20">
                    <Zap size={20} className="text-orange" />
                  </div>
                  <div>
                    <h3 className="ln-title text-2xl tracking-normal">Direct Transfer</h3>
                    <p className="ln-label text-[10px]">Instant peer-to-peer L2 transaction</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 rounded-sm bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <User size={12} className="text-muted" />
                              <label htmlFor="to" className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                  Recipient
                              </label>
                            </div>
                            <Input
                                id="to"
                                type="text"
                                placeholder="0x..."
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="ln-input text-xs h-10 font-mono"
                                disabled={isLoading}
                            />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-sm bg-white/5 border border-white/5 space-y-2">
                             <div className="flex items-center gap-2 mb-1">
                              <Zap size={12} className="text-orange" />
                              <label htmlFor="amount" className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                  ETH Amount
                              </label>
                            </div>
                            <Input
                                id="amount"
                                type="number"
                                step="0.000001"
                                placeholder="0.0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="ln-input text-xl h-10 font-mono font-bold"
                                disabled={isLoading}
                            />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col md:flex-row items-center gap-6 border-t border-white/5 mt-6">
                        <div className="flex-1">
                          <p className="text-[10px] text-muted leading-relaxed">
                            Peer-to-peer transfers are finalized instantly on L2 and bundled for L1 commitment. Complete asset ownership maintained by smart contract.
                          </p>
                        </div>
                        <Button
                            type="submit"
                            className="btn-primary px-12 py-6 text-base group min-w-[200px]"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Committing...</>
                            ) : (
                                <>Transfer <Send className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
=======
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
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
    );
} 