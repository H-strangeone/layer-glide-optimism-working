import { useState } from "react";
<<<<<<< HEAD
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2, Loader2, PlayCircle, Layers } from "lucide-react";
=======
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { executeL2BatchTransaction } from "@/lib/ethers";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2 } from "lucide-react";
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d

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
    if (!address || transactions.length === 0) return;

    setIsLoading(true);
    try {
<<<<<<< HEAD
=======
      // Create the batch transactions
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
      const batchTransactions = transactions.map((tx, index) => {
        if (!tx.recipient || !tx.amount) {
          throw new Error(`Transaction ${index + 1} is missing required fields`);
        }
<<<<<<< HEAD
        return {
          from: address,
          to: tx.recipient,
          amount: tx.amount,
=======

        const amount = tx.amount.toString();
        if (isNaN(parseFloat(amount))) {
          throw new Error(`Transaction ${index + 1} has invalid amount: ${amount}`);
        }

        return {
          from: address,
          to: tx.recipient,
          amount: amount,
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
          status: 'pending',
          timestamp: Math.floor(Date.now() / 1000)
        };
      });

<<<<<<< HEAD
      const response = await fetch('http://localhost:5500/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: batchTransactions }),
      });

      const responseText = await response.text();
      if (!response.ok) throw new Error(responseText);

      const result = JSON.parse(responseText);
      toast({
        title: "Success",
        description: `Batch #${result.batchId} submitted`,
      });

      if (onSuccess) onSuccess(batchTransactions);
      setTransactions([{ recipient: "", amount: "" }]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed batch submission",
=======
      console.log('Submitting transactions:', JSON.stringify(batchTransactions, null, 2));

      // Submit to backend API
      const response = await fetch('http://localhost:5500/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: batchTransactions
        }),
      });

      const responseText = await response.text();
      console.log('API Response:', responseText);

      if (!response.ok) {
        throw new Error(`Failed to submit batch: ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed result:', result);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error(`Invalid response format: ${responseText}`);
      }

      toast({
        title: "Success",
        description: `Batch #${result.batchId} submitted successfully`,
      });

      // Call onSuccess with the batch transactions
      if (onSuccess) {
        onSuccess(batchTransactions);
      }

      // Clear the transactions
      setTransactions([{ recipient: "", amount: "" }]);
    } catch (error) {
      console.error("Error submitting batch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit batch",
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
<<<<<<< HEAD
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

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
=======
    <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
      <CardHeader>
        <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Batch Submission</CardTitle>
        <CardDescription className="text-white/70">Submit multiple transactions in a batch</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Recipient Address (0x...)"
                value={tx.recipient}
                onChange={(e) => updateTransaction(index, "recipient", e.target.value)}
                className="bg-white/5 border-white/10 text-white flex-1"
                disabled={isLoading}
              />
              <Input
                type="number"
                placeholder="Amount in ETH"
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
                value={tx.amount}
                onChange={(e) => updateTransaction(index, "amount", e.target.value)}
                min="0"
                step="0.01"
<<<<<<< HEAD
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
=======
                className="bg-white/5 border-white/10 text-white w-32"
                disabled={isLoading}
              />
              {transactions.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTransaction(index)}
                  disabled={isLoading}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              onClick={addTransaction}
              variant="outline"
              className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
            <Button
              onClick={handleSubmitBatch}
              disabled={isLoading || transactions.length === 0 || transactions.some(tx => !tx.recipient || !tx.amount)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all duration-200"
            >
              {isLoading ? "Processing..." : "Submit Batch"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
  );
}
