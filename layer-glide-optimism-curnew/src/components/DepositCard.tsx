import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { depositFunds, getLayer1Balance, getLayer2Balance } from "@/lib/ethers";
import { toast } from "@/components/ui/use-toast";
import { Loader2, ArrowRightLeft, Wallet, Shield } from "lucide-react";

interface DepositCardProps {
  onSuccess?: (transaction: any) => void;
}

export default function DepositCard({ onSuccess }: DepositCardProps) {
  const { address, isConnected } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [layer1Balance, setLayer1Balance] = useState("0");
  const [layer2Balance, setLayer2Balance] = useState("0");

  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !address) return;

      try {
        const l1Balance = await getLayer1Balance(address);
        const l2Balance = await getLayer2Balance(address);
        setLayer1Balance(l1Balance || "0");
        setLayer2Balance(l2Balance || "0");
      } catch (error) {
        console.error("Error fetching balances:", error);
        setLayer1Balance("0");
        setLayer2Balance("0");
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  const handleDeposit = async () => {
    if (!amount) {
      toast({
        title: "Invalid Input",
        description: "Please enter an amount to deposit",
        variant: "destructive",
      });
      return;
    }

    if (Number(amount) > Number(layer1Balance)) {
      toast({
        title: "Insufficient Balance",
        description: `Your Layer 1 balance (${Number(layer1Balance).toFixed(4)} ETH) is less than the requested amount`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const tx = await depositFunds(amount);
      toast({
        title: "Success",
        description: "Funds deposited successfully",
      });

      const transaction = {
        from: address,
        to: address,
        value: amount,
        status: 'pending',
        timestamp: Math.floor(Date.now() / 1000)
      };

      if (onSuccess) {
        onSuccess(transaction);
      }

      setAmount("");
    } catch (error) {
      console.error("Deposit error:", error);
      toast({
        title: "Error",
        description: "Failed to deposit funds",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(layer1Balance);
  };

  /* No connected state handled at higher level in Index.tsx already */

  return (
    <div className="space-y-8 p-1">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex-1 space-y-4">
          <div className="p-4 rounded-sm bg-white/5 border border-white/5 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-orange/10 border border-orange/20">
                <Wallet size={16} className="text-orange" />
              </div>
              <div>
                <div className="ln-label text-[10px] mb-0.5">L1 Source Balance</div>
                <div className="text-xl font-bold font-mono">{Number(layer1Balance).toFixed(4)} ETH</div>
              </div>
            </div>
          </div>
          <div className="flex justify-center -my-2 relative z-10">
            <div className="p-1 px-3 bg-subtle border border-border rounded-full text-[10px] font-bold text-orange uppercase tracking-widest flex items-center gap-2">
              <ArrowRightLeft size={10} /> To Layer 2
            </div>
          </div>
          <div className="p-4 rounded-sm bg-white/5 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-white/10 border border-white/20">
                <Shield size={16} className="text-muted" />
              </div>
              <div>
                <div className="ln-label text-[10px] mb-0.5">L2 Target Balance</div>
                <div className="text-xl font-bold font-mono">{Number(layer2Balance).toFixed(4)} ETH</div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-6 bg-white/5 p-6 rounded-sm border border-white/5 relative">
          <div className="flex justify-between items-center mb-1">
            <label className="ln-label text-[10px]">Enter Amount</label>
            <button
              onClick={setMaxAmount}
              className="text-[10px] font-bold uppercase tracking-wider text-orange hover:text-orange/80 transition-colors"
            >
              Max
            </button>
          </div>
          <Input
            type="number"
            placeholder="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.0001"
            className="ln-input text-xl h-14 font-mono font-bold"
            disabled={isLoading}
          />
          <Button
            onClick={handleDeposit}
            disabled={isLoading || !amount}
            className="btn-primary w-full py-6 text-base justify-center"
          >
            {isLoading ? (
              <><Loader2 size={18} className="anim-spin" /> Processing...</>
            ) : (
              "Complete Bridge"
            )}
          </Button>
          <div className="text-center">
            <span className="text-[10px] text-muted font-bold uppercase tracking-widest leading-none">
              Estimated wait: ~12s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
