import { useState, useEffect } from 'react';
import { BatchManager } from "@/components/BatchManager";
import { TransactionTracker } from "@/components/TransactionTracker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getLayer2Balance, getContract } from "@/lib/ethers";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowUpRight, ArrowDownLeft, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEther } from "ethers";

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: string;
  createdAt: number;
  batchId?: string;
  type?: string;
  isInBatch?: boolean;
}

interface Batch {
  id: string;
  transactions: Transaction[];
  status: string;
  createdAt: number;
}

export default function Transactions() {
  const [searchAddress, setSearchAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState({
    totalSent: "0",
    totalReceived: "0",
    batchesCreated: 0,
    batchesParticipated: 0
  });

  const fetchTransactionData = async (address: string) => {
    try {
      // Fetch user transactions and balance
      const txResponse = await fetch(`http://localhost:5500/api/transactions/user/${address}`);
      if (!txResponse.ok) {
        throw new Error(`Failed to fetch transactions: ${txResponse.statusText}`);
      }
      const { transactions: txData, balance: l2Balance } = await txResponse.json();
      console.log('Raw transaction data:', txData);
      console.log('Layer 2 balance:', l2Balance);

      setTransactions(txData);
      setBalance(l2Balance || "0");

      // Calculate statistics
      let sent = BigInt(0);
      let received = BigInt(0);
      const batchesCreatedSet = new Set();
      const batchesParticipatedSet = new Set();

      if (Array.isArray(txData)) {
        txData.forEach((tx: Transaction) => {
          if (!tx) return;

          try {
            if (tx.from?.toLowerCase() === address.toLowerCase()) {
              const value = tx.value ? BigInt(tx.value) : BigInt(0);
              sent += value;
              if (tx.batchId) batchesCreatedSet.add(tx.batchId);
            }
            if (tx.to?.toLowerCase() === address.toLowerCase()) {
              const value = tx.value ? BigInt(tx.value) : BigInt(0);
              received += value;
            }
            if (tx.batchId) {
              batchesParticipatedSet.add(tx.batchId);
            }
          } catch (error) {
            console.error('Error processing transaction:', tx, error);
          }
        });
      }

      console.log('Stats calculation:', {
        sent: sent.toString(),
        received: received.toString(),
        batchesCreated: batchesCreatedSet.size,
        batchesParticipated: batchesParticipatedSet.size
      });

      setStats({
        totalSent: formatEther(sent.toString()),
        totalReceived: formatEther(received.toString()),
        batchesCreated: batchesCreatedSet.size,
        batchesParticipated: batchesParticipatedSet.size
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction data: " + (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleSearch = async () => {
    if (!searchAddress) {
      toast({
        title: "Invalid Input",
        description: "Please enter a wallet address",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      await fetchTransactionData(searchAddress);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-primary">Transactions</h1>
      <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
        <CardHeader>
          <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Search Transactions
          </CardTitle>
          <CardDescription className="text-white/70">
            View transaction history and balance for any wallet address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Enter wallet address (0x...)"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="bg-white/5 border-white/10 text-white flex-1"
              disabled={isSearching}
            />
            <Button
              onClick={handleSearch}
              className="bg-purple-500 hover:bg-purple-600"
              disabled={isSearching}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {searchAddress && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Layer 2 Balance Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="text-sm text-white/70 mb-1">Layer 2 Balance</div>
                    <div className="text-xl font-medium text-white">
                      {Number(balance).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Total Sent Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-red-400" />
                      <div className="text-sm text-white/70">Total Sent</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {Number(stats.totalSent).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Total Received Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-green-400" />
                      <div className="text-sm text-white/70">Total Received</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {Number(stats.totalReceived).toFixed(4)} ETH
                    </div>
                  </CardContent>
                </Card>

                {/* Batch Participation Card */}
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      <div className="text-sm text-white/70">Batch Activity</div>
                    </div>
                    <div className="text-xl font-medium text-white">
                      {stats.batchesParticipated} Batches
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {searchAddress && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500/20">
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-purple-500/20">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="batches" className="data-[state=active]:bg-purple-500/20">
              Batches
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <TransactionTracker mode="user" address={searchAddress} showOverview />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionTracker mode="user" address={searchAddress} />
          </TabsContent>

          <TabsContent value="batches">
            <BatchManager address={searchAddress} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
