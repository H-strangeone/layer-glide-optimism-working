import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { getBatches, submitBatchWithMerkleRoot, verifyBatch, finalizeBatch, isAdmin, getBatchTransactions, getContract } from "@/lib/ethers";
import { useWallet } from "@/hooks/useWallet";
import { createMerkleTreeFromTransactions, Transaction } from "@/lib/merkleTree";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle, Plus, Loader2, XCircle, CheckCircle2 } from "lucide-react";
import { BatchDetails } from './BatchDetails';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEther } from 'ethers';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package } from "lucide-react";
import { keccak256 } from 'ethers';

interface BatchTransaction {
    from: string;
    to: string;
    value: string;
    status: string;
    createdAt: number;
}

interface BlockchainBatch {
    id: string;
    transactionsRoot: string;
    createdAt: string;
    verified: boolean;
    finalized: boolean;
}

interface Batch extends BlockchainBatch {
    batchId: string;
    rejected: boolean;
    fraudulent?: boolean;
    transactions: BatchTransaction[];
}

interface AdminBatchManagerProps {
    isAdmin: boolean;
    isOperator?: boolean;
}

export default function AdminBatchManager({ isAdmin, isOperator = false }: AdminBatchManagerProps) {
    const { address, isConnected } = useWallet();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [merkleRoot, setMerkleRoot] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>("all");
    const { toast } = useToast();
    const [error, setError] = useState('');

    const fetchBatches = async () => {
        try {
            setIsLoading(true);
            setError('');

            // First try to get batches from the database
            const response = await fetch('http://localhost:5500/api/batches');
            if (!response.ok) {
                throw new Error('Failed to fetch batches from database');
            }
            const dbBatches = await response.json();

            // Then try to get on-chain data to enrich the batches
            try {
                const contract = await getContract();
                if (!contract) {
                    throw new Error('Failed to get contract instance');
                }

                // Get the next batch ID from the contract
                const nextBatchId = await contract.nextBatchId();
                // Calculate the current batch ID (nextBatchId - 1)
                const currentBatchId = nextBatchId - 1n;

                const enrichedBatches = await Promise.all(dbBatches.map(async (batch: Batch) => {
                    try {
                        // Use the numeric batch ID for contract interaction
                        const batchData = await contract.batches(currentBatchId);
                        const isVerified = batchData.verified;
                        const isFinalized = batchData.finalized;

                        // Don't automatically update the database - let the user verify the batch manually
                        // This ensures batches start in a pending state and only get marked as verified when explicitly verified

                        // We'll just use the on-chain data for display purposes, but not update the database
                        return {
                            ...batch,
                            // Only use on-chain verification status if the batch is already verified in the database
                            // This prevents automatic verification of new batches
                            verified: batch.verified ? isVerified : false,
                            finalized: batch.finalized ? isFinalized : false,
                            // Ensure rejected property is always defined
                            rejected: batch.rejected || false
                        };
                    } catch (err) {
                        console.warn(`Failed to get on-chain data for batch ${batch.id}:`, err);
                        // Ensure rejected property is always defined
                        return {
                            ...batch,
                            rejected: batch.rejected || false
                        };
                    }
                }));

                setBatches(enrichedBatches);
            } catch (err) {
                console.warn('Failed to get on-chain data:', err);
                // Still use database batches if contract calls fail
                // Ensure rejected property is always defined
                const batchesWithRejected = dbBatches.map((batch: Batch) => ({
                    ...batch,
                    rejected: batch.rejected || false
                }));
                setBatches(batchesWithRejected);
            }
        } catch (err) {
            console.error('Error fetching batches:', err);
            setError('Failed to fetch batches');
            setBatches([]);
            toast({
                title: "Error",
                description: "Failed to fetch batches. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
        // Refresh every 30 seconds
        const interval = setInterval(fetchBatches, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleBatchSelect = (batch: Batch) => {
        setSelectedBatch(batch);
        // In a real implementation, we would fetch the actual transactions for this batch
        // and compute the Merkle root. For now, we'll just use the first transaction hash
        if (batch.transactionsRoot.length > 0) {
            setMerkleRoot(batch.transactionsRoot);
        } else {
            setMerkleRoot("");
        }
    };

    const handleSubmitBatch = async () => {
        if (!address || (!isAdmin && !isOperator)) {
            toast({
                title: "Error",
                description: "You need admin or operator privileges to submit batches",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            // Fetch pending transactions from the database
            const response = await fetch('http://localhost:5500/api/transactions/pending');
            if (!response.ok) {
                throw new Error('Failed to fetch pending transactions');
            }
            const pendingTransactions: Transaction[] = await response.json();

            if (pendingTransactions.length === 0) {
                toast({
                    title: "No Transactions",
                    description: "No pending transactions to batch",
                    variant: "default",
                });
                return;
            }

            // Create a Merkle tree from the transactions
            const merkleTree = createMerkleTreeFromTransactions(pendingTransactions);
            const root = merkleTree.getRoot();

            // Submit the Merkle root to the contract
            const tx = await submitBatchWithMerkleRoot(root);
            await tx.wait();

            console.log("Batch submitted successfully:", {
                merkleRoot: root,
                transactionHash: tx.hash,
            });

            toast({
                title: "Batch Submitted",
                description: "Batch submitted successfully",
            });

            // Refresh batches
            await fetchBatches();
        } catch (error) {
            console.error("Error submitting batch:", error);
            toast({
                title: "Error",
                description: "Failed to submit batch",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyBatch = async (batchId: string) => {
        try {
            // Check if batchId is a UUID and convert it to a BigInt-compatible value
            const isUUID = /^[0-9a-fA-F-]{36}$/.test(batchId);
            const numericBatchId = isUUID ? BigInt(keccak256(Buffer.from(batchId)).toString()) : BigInt(batchId);

            // Send batchId as a string to the backend
            const response = await fetch('http://localhost:5500/api/batches/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ batchId: numericBatchId.toString() }),
            });

            if (!response.ok) {
                throw new Error(`Failed to verify batch: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Batch verified successfully:', data);
        } catch (error) {
            console.error('Error verifying batch:', error);
        }
    };

    const handleFinalizeBatch = async (batchId: string) => {
        try {
            if (!address) {
                toast({
                    title: "Error",
                    description: "Please connect your wallet first",
                    variant: "destructive",
                });
                return;
            }

            const contract = await getContract();
            if (!contract) {
                throw new Error('Failed to get contract instance');
            }

            // Find the selected batch
            const selectedBatch = batches.find(b => b.id === batchId);
            if (!selectedBatch) {
                throw new Error('Selected batch not found');
            }

            // Use the batchId from the selected batch
            const numericBatchId = BigInt(selectedBatch.batchId);

            console.log(`Finalizing batch with ID: ${numericBatchId}`);

            // Finalize the batch on the contract using the numeric ID
            const tx = await contract.finalizeBatch(numericBatchId);
            await tx.wait();

            // Update the database using the UUID
            const response = await fetch('http://localhost:5500/api/batches/finalize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-address': address
                },
                body: JSON.stringify({ batchId }),
            });

            if (!response.ok) {
                throw new Error('Failed to update batch status in database');
            }

            toast({
                title: "Success",
                description: "Batch finalized successfully",
            });
            fetchBatches();
        } catch (error) {
            console.error('Error finalizing batch:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to finalize batch',
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectBatch = async (batchId: string) => {
        if (!address) {
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/batches/reject', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ batchId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to reject batch');
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: "Batch rejected successfully",
            });

            // Update the local state to mark the batch as rejected
            setBatches(prevBatches =>
                prevBatches.map(batch =>
                    batch.id === batchId
                        ? { ...batch, rejected: true, verified: false, finalized: false }
                        : batch
                )
            );

            // Refresh the batches list
            await fetchBatches();
        } catch (error) {
            console.error('Error rejecting batch:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to reject batch",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleChallengeBatch = async (batchId: string) => {
        if (!address) {
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/batches/challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    batchId,
                    challengerAddress: address
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to challenge batch');
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: "Batch challenge submitted successfully",
            });

            // Refresh the batches list
            await fetchBatches();
        } catch (error) {
            console.error('Error challenging batch:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to challenge batch",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyChallenge = async (batchId: string, isValid: boolean) => {
        if (!address || (!isAdmin && !isOperator)) {
            toast({
                title: "Error",
                description: "Only admin or operators can verify challenges",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/batches/verify-challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    batchId,
                    isValid,
                    adminAddress: address
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to verify challenge');
            }

            const data = await response.json();
            toast({
                title: "Success",
                description: isValid ? "Challenge verified as valid. Batch creator penalized." : "Challenge rejected. Challenger penalized.",
            });

            // Refresh the batches list
            await fetchBatches();
        } catch (error) {
            console.error('Error verifying challenge:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to verify challenge",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReportBatch = async (batchId: string, reason: string) => {
        if (!address) {
            toast({
                title: "Error",
                description: "Please connect your wallet first",
                variant: "destructive",
            });
            return;
        }

        if (!reason) {
            toast({
                title: "Error",
                description: "Reason for reporting is required",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5500/api/batches/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ batchId, reason }),
            });

            if (!response.ok) {
                throw new Error('Failed to report batch');
            }

            toast({
                title: "Success",
                description: "Batch reported successfully",
            });
        } catch (error) {
            console.error('Error reporting batch:', error);
            toast({
                title: "Error",
                description: "Failed to report batch",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (batch: Batch) => {
        if (batch.rejected) {
            return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle size={14} /> Rejected</Badge>;
        }
        if (batch.fraudulent) {
            return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle size={14} /> Fraudulent</Badge>;
        }
        if (batch.finalized) {
            return <Badge variant="default" className="flex items-center gap-1"><CheckCircle size={14} /> Finalized</Badge>;
        }
        if (batch.verified) {
            return <Badge variant="secondary" className="flex items-center gap-1"><Clock size={14} /> In Challenge Period</Badge>;
        }
        return <Badge variant="outline" className="flex items-center gap-1"><AlertTriangle size={14} /> Pending</Badge>;
    };

    const formatTimestamp = (timestamp: Date) => {
        return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    };

    const toggleBatchDetails = (batchId: string) => {
        if (expandedBatchId === batchId) {
            setExpandedBatchId(null);
        } else {
            setExpandedBatchId(batchId);
        }
    };

    const filteredBatches = () => {
        switch (activeTab) {
            case "pending":
                return batches.filter(batch => !batch.verified && !batch.finalized && !batch.rejected);
            case "verified":
                return batches.filter(batch => batch.verified && !batch.finalized && !batch.rejected);
            case "finalized":
                return batches.filter(batch => batch.finalized && !batch.rejected);
            case "rejected":
                return batches.filter(batch => batch.rejected);
            default:
                return batches;
        }
    };

    if (!isConnected) {
        return (
            <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
                <CardContent className="py-8">
                    <div className="text-center text-white/70">
                        Please connect your wallet to manage batches
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isLoading && batches.length === 0) {
        return (
            <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
                <CardContent className="py-8">
                    <div className="text-center text-white/70">
                        Loading batches...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
                <CardContent className="py-8">
                    <div className="text-center text-red-400">
                        {error}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
            <CardHeader className="relative">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                            Batch Management
                        </CardTitle>
                        <CardDescription className="text-white/70">
                            {isAdmin ? "Manage and verify network batches" : isOperator ? "Operate and verify network batches" : "View network batches"}
                        </CardDescription>
                    </div>
                    {(isAdmin || isOperator) && (
                        <Button
                            onClick={handleSubmitBatch}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Submit New Batch
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="relative">
                <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-5 mb-4 bg-white/5 p-1 rounded-lg">
                        <TabsTrigger value="all" className="data-[state=active]:bg-white/10">All Batches</TabsTrigger>
                        <TabsTrigger value="pending" className="data-[state=active]:bg-white/10">Pending</TabsTrigger>
                        <TabsTrigger value="verified" className="data-[state=active]:bg-white/10">In Challenge</TabsTrigger>
                        <TabsTrigger value="finalized" className="data-[state=active]:bg-white/10">Finalized</TabsTrigger>
                        <TabsTrigger value="rejected" className="data-[state=active]:bg-white/10">Rejected</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="mt-0">
                        {renderBatchTable(filteredBatches())}
                    </TabsContent>
                    <TabsContent value="pending" className="mt-0">
                        {renderBatchTable(filteredBatches())}
                    </TabsContent>
                    <TabsContent value="verified" className="mt-0">
                        {renderBatchTable(filteredBatches())}
                    </TabsContent>
                    <TabsContent value="finalized" className="mt-0">
                        {renderBatchTable(filteredBatches())}
                    </TabsContent>
                    <TabsContent value="rejected" className="mt-0">
                        {renderBatchTable(filteredBatches())}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );

    function renderBatchTable(batchesToRender: Batch[]) {
        if (batchesToRender.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-white/5 p-4 mb-4">
                        <Package className="h-8 w-8 text-white/30" />
                    </div>
                    <h3 className="text-lg font-medium text-white/70">No batches found</h3>
                    <p className="text-sm text-white/50 mt-1">
                        No batches are available in this category
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {batchesToRender.map((batch) => (
                    <Collapsible
                        key={batch.id}
                        open={expandedBatchId === batch.id}
                        onOpenChange={() => toggleBatchDetails(batch.id)}
                        className="border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors"
                    >
                        <div className="p-4 bg-white/5">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="p-0 h-8 w-8 hover:bg-white/10">
                                            {expandedBatchId === batch.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            Batch #{batch.batchId}
                                        </h3>
                                        <p className="text-sm text-white/70 font-mono">
                                            Root: {batch.transactionsRoot.slice(0, 10)}...{batch.transactionsRoot.slice(-8)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2">
                                        {getStatusBadge(batch)}
                                    </div>
                                    <div className="flex gap-2">
                                        {!batch.verified && !batch.finalized && !batch.rejected && (isAdmin || isOperator) && (
                                            <>
                                                <Button
                                                    onClick={() => handleVerifyBatch(batch.id)}
                                                    disabled={isLoading}
                                                    className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20"
                                                >
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Verify
                                                </Button>
                                                <Button
                                                    onClick={() => handleRejectBatch(batch.id)}
                                                    disabled={isLoading}
                                                    className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                                >
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {batch.verified && !batch.finalized && !batch.rejected && (isAdmin || isOperator) && (
                                            <>
                                                <Button
                                                    onClick={() => handleFinalizeBatch(batch.id)}
                                                    disabled={isLoading}
                                                    className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20"
                                                >
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    Finalize
                                                </Button>
                                                <Button
                                                    onClick={() => handleRejectBatch(batch.id)}
                                                    disabled={isLoading}
                                                    className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                                >
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {!isAdmin && !isOperator && batch.verified && !batch.finalized && !batch.rejected && (
                                            <Button
                                                onClick={() => handleChallengeBatch(batch.id)}
                                                disabled={isLoading}
                                                className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20"
                                            >
                                                <AlertTriangle className="mr-2 h-4 w-4" />
                                                Challenge
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => {
                                                const reason = prompt('Enter the reason for reporting this batch:');
                                                if (reason) {
                                                    handleReportBatch(batch.id, reason);
                                                }
                                            }}
                                            disabled={isLoading}
                                            className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                        >
                                            Report
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <CollapsibleContent>
                            <div className="p-4 bg-white/5 border-t border-white/10">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-4">
                                        <div className="bg-white/5 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-white/70 mb-2">Batch Details</h4>
                                            <div className="space-y-2">
                                                <p className="text-sm text-white">
                                                    <span className="text-white/70">ID:</span>{" "}
                                                    <span className="font-mono">{batch.batchId}</span>
                                                </p>
                                                <p className="text-sm text-white">
                                                    <span className="text-white/70">Merkle Root:</span>{" "}
                                                    <span className="font-mono">{batch.transactionsRoot}</span>
                                                </p>
                                                <p className="text-sm text-white">
                                                    <span className="text-white/70">Timestamp:</span>{" "}
                                                    {formatTimestamp(new Date(batch.createdAt))}
                                                </p>
                                                <p className="text-sm text-white">
                                                    <span className="text-white/70">Transactions:</span>{" "}
                                                    {batch.transactions.length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-white/70 mb-2">Status</h4>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/70">Verified</span>
                                                    <Badge variant={batch.verified ? "default" : "outline"} className="bg-green-500/10 text-green-500 border-green-500/20">
                                                        {batch.verified ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/70">Finalized</span>
                                                    <Badge variant={batch.finalized ? "default" : "outline"} className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                        {batch.finalized ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/70">Rejected</span>
                                                    <Badge variant={batch.rejected ? "default" : "outline"} className="bg-red-500/10 text-red-500 border-red-500/20">
                                                        {batch.rejected ? "Yes" : "No"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/70">Challenge Period</span>
                                                    <Badge variant={batch.verified && !batch.finalized ? "default" : "outline"} className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                                        {batch.verified && !batch.finalized ? "Active" : "Not Active"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/5 rounded-lg p-4">
                                    <h4 className="text-md font-semibold text-white mb-4">Transactions</h4>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-white/10 hover:bg-white/5">
                                                <TableHead className="text-white/70">From</TableHead>
                                                <TableHead className="text-white/70">To</TableHead>
                                                <TableHead className="text-white/70">Amount</TableHead>
                                                <TableHead className="text-white/70">Status</TableHead>
                                                <TableHead className="text-white/70">Timestamp</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {batch.transactions.map((tx, index) => (
                                                <TableRow key={index} className="border-white/10 hover:bg-white/5">
                                                    <TableCell className="font-mono text-sm text-white/80">
                                                        {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm text-white/80">
                                                        {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                                                    </TableCell>
                                                    <TableCell className="text-white/80">{tx.value} ETH</TableCell>
                                                    <TableCell>
                                                        <Badge variant={tx.status === 'pending' ? 'outline' : 'default'} className="bg-white/10">
                                                            {tx.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-white/70">
                                                        {new Date(tx.createdAt * 1000).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        );
    }
}