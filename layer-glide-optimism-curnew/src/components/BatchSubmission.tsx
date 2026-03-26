import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import { executeL2BatchTransaction, executeL2Transaction } from "@/lib/ethers";
import { Plus, Trash2, Loader2, PlayCircle, Layers } from "lucide-react";

interface Transaction {
  recipient: string;
  amount: string;
}

interface BatchSubmissionProps {
  onSuccess?: (transaction: any) => void;
}

export default function BatchSubmission({ onSuccess }: BatchSubmissionProps) {
  const { address } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([{ recipient: "", amount: "" }]);
  const [isLoading, setIsLoading] = useState(false);

  const addTransaction = () => {
    setTransactions([...transactions, { recipient: "", amount: "" }]);
  };

  const removeTransaction = (index: number) => {
    const newTransactions = transactions.filter((_, i) => i !== index);
    setTransactions(newTransactions);
  };

  const updateTransaction = (index: number, field: keyof Transaction, value: string) => {
    const newTransactions = [...transactions];
    newTransactions[index] = { ...newTransactions[index], [field]: value };
    setTransactions(newTransactions);
  };

  const handleSubmitBatch = async () => {
    if (!address) {
      toast({ title: "Error", description: "Connect wallet first", variant: "destructive" });
      return;
    }
    if (transactions.length === 0) return;

    // Validate
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!tx.recipient || !tx.amount || Number(tx.amount) <= 0) {
        toast({ title: "Error", description: `Transaction ${i + 1} is missing required fields`, variant: "destructive" });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Use the proper L2 signing flow
      const recipients = transactions.map(tx => tx.recipient);
      const amounts = transactions.map(tx => tx.amount);

      if (transactions.length === 1) {
        await executeL2Transaction(recipients[0], amounts[0]);
      } else {
        await executeL2BatchTransaction(recipients, amounts);
      }

      toast({
        title: "✅ Batch Submitted",
        description: `${transactions.length} transaction(s) signed and sent to mempool`,
      });

      if (onSuccess) onSuccess(transactions);
      setTransactions([{ recipient: "", amount: "" }]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed batch submission",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-orange/10">
            <Layers size={18} className="text-orange" />
          </div>
          <div>
            <h3 className="ln-title text-xl">Batch Bundle</h3>
            <p className="ln-label text-[10px]">Optimize security and gas efficiency</p>
          </div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Bundle size: {transactions.length}
        </div>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
        {transactions.map((tx, index) => (
          <div key={index} className="flex gap-3 bg-white/5 p-4 rounded-sm border border-white/5 relative group">
            <div className="absolute left-0 top-0 h-full w-0.5 bg-orange opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1 space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted">Recipient</label>
              <Input
                placeholder="0x..."
                value={tx.recipient}
                onChange={(e) => updateTransaction(index, "recipient", e.target.value)}
                className="ln-input text-xs h-9"
                disabled={isLoading}
              />
            </div>
            <div className="w-32 space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted">ETH</label>
              <Input
                type="number"
                placeholder="0.0"
                value={tx.amount}
                onChange={(e) => updateTransaction(index, "amount", e.target.value)}
                min="0"
                step="0.01"
                className="ln-input text-xs h-9 font-mono"
                disabled={isLoading}
              />
            </div>
            {transactions.length > 1 && (
              <div className="pt-5">
                <button
                  onClick={() => removeTransaction(index)}
                  disabled={isLoading}
                  className="text-muted hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t border-white/5">
        <Button
          onClick={addTransaction}
          variant="outline"
          className="flex-1 border-white/10 hover:border-orange/30 hover:bg-orange/5 text-xs text-muted hover:text-orange"
          disabled={isLoading}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add To Bundle
        </Button>
        <Button
          onClick={handleSubmitBatch}
          disabled={isLoading || transactions.length === 0}
          className="btn-primary px-8"
        >
          {isLoading ? <Loader2 size={16} className="anim-spin mr-2" /> : <PlayCircle size={16} className="mr-2" />}
          Commit Batch
        </Button>
      </div>
    </div>
  );
}