import { useAccount } from "wagmi";
import { useState } from "react";
import DepositCard from "@/components/DepositCard";
import NetworkStatus from "@/components/NetworkStatus";
import { TransactionTracker } from "@/components/TransactionTracker";
import BatchSubmission from "@/components/BatchSubmission";
import { SingleTransaction } from '@/components/SingleTransaction';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Index() {
  const { address } = useAccount();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { isConnected } = useWallet();

  const handleSuccess = async (transaction) => {
    try {
      if (!transaction.from || !transaction.to || !transaction.value || isNaN(Number(transaction.value))) {
        throw new Error('Transaction properties are missing or invalid');
      }

      // Format the transaction data according to the API requirements
      const formattedTransaction = {
        transactions: Array.isArray(transaction) ? transaction.map(tx => ({
          from: tx.from.toLowerCase(),
          to: tx.to.toLowerCase(),
          amount: tx.value.toString(),
          status: 'pending'
        })) : [{
          from: transaction.from.toLowerCase(),
          to: transaction.to.toLowerCase(),
          amount: transaction.value.toString(),
          status: 'pending'
        }]
      };

      console.log('Submitting transaction:', JSON.stringify(formattedTransaction, null, 2));

      const response = await fetch('http://localhost:5500/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedTransaction),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save transaction: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transaction saved:', result);

      // Trigger a refresh of all components
      setRefreshTrigger(prev => prev + 1);

      toast({
        title: "Success",
        description: "Transaction submitted successfully",
      });
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save transaction",
        variant: "destructive",
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black">
        <Card className="w-full max-w-md glass-card border border-white/10 backdrop-blur-md bg-black/30">
          <CardHeader>
            <CardTitle className="text-2xl text-center bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Connect Wallet</CardTitle>
            <CardDescription className="text-center text-white/70">Please connect your wallet to use the Layer 2 platform</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="grid grid-cols-1 gap-8">
        {/* Network Status Card */}
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 pointer-events-none"></div>
          <CardHeader className="relative">
            <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">Network Status</CardTitle>
            <CardDescription className="text-white/70">Current network information and batch status</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <NetworkStatus />
          </CardContent>
        </Card>

        {/* Transaction Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="transform transition-all duration-300 hover:scale-[1.02]">
            <DepositCard onSuccess={handleSuccess} />
          </div>
          <div className="transform transition-all duration-300 hover:scale-[1.02]">
            <BatchSubmission onSuccess={handleSuccess} />
          </div>
          <div className="transform transition-all duration-300 hover:scale-[1.02]">
            <SingleTransaction onSuccess={handleSuccess} />
          </div>
        </div>

        {/* Transaction History */}
        {address && (
          <div className="transform transition-all duration-300 hover:scale-[1.01]">
            <TransactionTracker
              mode="user"
              address={address}
              key={refreshTrigger} // Force refresh when transactions occur
            />
          </div>
        )}
      </div>
    </div>
  );
}
