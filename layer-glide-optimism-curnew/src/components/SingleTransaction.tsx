import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { executeL2Transaction } from "@/lib/ethers";
import { Loader2, Send, Zap, User } from "lucide-react";
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
            toast({ title: "Error", description: "All fields required", variant: "destructive" });
            return;
        }

        if (!address) {
            toast({ title: "Error", description: "Connect wallet first", variant: "destructive" });
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

            if (onSuccess) await onSuccess(transaction);
            toast({ title: "Success", description: "L2 Transfer submitted" });
            setTo(""); setAmount("");
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Transfer failed",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
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
    );
} 