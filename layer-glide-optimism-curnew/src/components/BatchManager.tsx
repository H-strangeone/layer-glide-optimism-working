import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ethers } from 'ethers';
import { useWallet } from "@/hooks/useWallet";
import { formatDistanceToNow } from "date-fns";
import { formatEther } from "ethers";
import { Loader2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Transaction {
    id: string;
    from: string;
    to: string;
    value: string;
    status: string;
    batchId: string | null;
    createdAt: string;
}

interface Batch {
    id: string;
    batchId: string;
    transactionsRoot: string;
    verified: boolean;
    finalized: boolean;
    rejected: boolean;
    rejectionReason?: string;
    createdAt: number | string;
    transactions: Transaction[];
    status: string;
    merkleRoot?: string;
    submitter?: string;
}

interface BatchManagerProps {
    address?: string;
}

const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function BatchManager({ address }: BatchManagerProps) {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
    const { address: connectedAddress } = useWallet();
    const { toast } = useToast();

    const fetchBatches = async () => {
        try {
            setIsLoading(true);
            const url = address
                ? `http://localhost:5500/api/batches/user/${address}`
                : "http://localhost:5500/api/batches";

            console.log('Fetching batches from:', url);
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No batches found');
                    setBatches([]);
                    return;
                }
                throw new Error(`Failed to fetch batches: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Raw batch data:', data);

            if (!Array.isArray(data)) {
                console.error('Expected array of batches but got:', typeof data);
                setBatches([]);
                return;
            }

            // Sort batches by timestamp (newest first)
            const sortedBatches = data
                .filter((batch: Batch) => batch && batch.createdAt)
                .map((batch: Batch) => ({
                    ...batch,
                    transactions: Array.isArray(batch.transactions) ? batch.transactions : []
                }))
                .sort((a: Batch, b: Batch) => {
                    const timeA = typeof a.createdAt === 'string' ? parseInt(a.createdAt) : a.createdAt;
                    const timeB = typeof b.createdAt === 'string' ? parseInt(b.createdAt) : b.createdAt;
                    return timeB - timeA;
                });

            console.log(`Processed ${sortedBatches.length} batches`);
            setBatches(sortedBatches);
        } catch (error) {
            console.error('Error fetching batches:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch batches: ' + (error as Error).message,
                variant: 'destructive',
            });
            setBatches([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
        const interval = setInterval(fetchBatches, 5000);
        return () => clearInterval(interval);
    }, [address]);

    const createBatch = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/rollup/batch/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to create batch');
            }

            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Success',
                    description: `Created batch with ${result.transactionCount} transactions`,
                });
                fetchBatches();
            } else {
                toast({
                    title: 'Error',
                    description: result.message || 'Failed to create batch',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error creating batch:', error);
            toast({
                title: 'Error',
                description: 'Failed to create batch',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const verifyBatch = async (batchId: string) => {
        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/rollup/batch/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ batchId }),
            });

            if (!response.ok) {
                throw new Error('Failed to verify batch');
            }

            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Batch verified successfully',
                });
                fetchBatches();
            } else {
                toast({
                    title: 'Error',
                    description: result.message || 'Failed to verify batch',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error verifying batch:', error);
            toast({
                title: 'Error',
                description: 'Failed to verify batch',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const finalizeBatch = async (batchId: string) => {
        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5500/api/rollup/batch/finalize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ batchId }),
            });

            if (!response.ok) {
                throw new Error('Failed to finalize batch');
            }

            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Batch finalized successfully',
                });
                fetchBatches();
            } else {
                toast({
                    title: 'Error',
                    description: result.message || 'Failed to finalize batch',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error finalizing batch:', error);
            toast({
                title: 'Error',
                description: 'Failed to finalize batch',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status: string | undefined) => {
        if (!status) {
            return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">Unknown</Badge>;
        }

        switch (status.toLowerCase()) {
            case "pending":
                return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Pending</Badge>;
            case "verified":
                return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Verified</Badge>;
            case "finalized":
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Finalized</Badge>;
            case "rejected":
                return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Rejected</Badge>;
            default:
                return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">{status}</Badge>;
        }
    };

    const formatTimestamp = (timestamp: number | string) => {
        if (!timestamp) return 'Unknown';
        try {
            const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
            const date = new Date(timestampNum * 1000);
            if (isNaN(date.getTime())) return 'Invalid date';
            return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return 'Invalid date';
        }
    };

    if (isLoading) {
        return (
            <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
                <CardContent className="py-8">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (batches.length === 0) {
        return (
            <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
                <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-white/5 p-4 mb-4">
                            <Package className="h-8 w-8 text-white/30" />
                        </div>
                        <h3 className="text-lg font-medium text-white/70">No batches found</h3>
                        <p className="text-sm text-white/50 mt-1">
                            {address
                                ? `No batches found for ${formatAddress(address)}`
                                : "No batches have been submitted yet"}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
            <CardHeader>
                <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    {address ? `Batches for ${formatAddress(address)}` : "All Batches"}
                </CardTitle>
                <CardDescription className="text-white/70">
                    {address
                        ? `View all batches involving ${formatAddress(address)}`
                        : "View all submitted transaction batches"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {batches.map((batch) => (
                        <Collapsible
                            key={batch.id}
                            open={expandedBatch === batch.id}
                            onOpenChange={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                        >
                            <Card className="bg-white/5 border-white/10">
                                <CollapsibleTrigger asChild>
                                    <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm text-white/70">#{formatAddress(batch.id)}</span>
                                                {getStatusBadge(batch.status)}
                                            </div>
                                            <div className="text-xs text-white/50">
                                                {formatTimestamp(batch.createdAt)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm text-white/70">
                                                {batch.transactions.length} transaction{batch.transactions.length !== 1 ? 's' : ''}
                                            </div>
                                            {expandedBatch === batch.id ? (
                                                <ChevronUp className="h-4 w-4 text-white/50" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-white/50" />
                                            )}
                                        </div>
                                    </CardContent>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="px-4 pb-4">
                                        <div className="rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-white/10 hover:bg-white/5">
                                                        <TableHead className="text-white/70">From</TableHead>
                                                        <TableHead className="text-white/70">To</TableHead>
                                                        <TableHead className="text-white/70">Amount</TableHead>
                                                        <TableHead className="text-white/70">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {batch.transactions.map((tx) => (
                                                        <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                                                            <TableCell className="font-mono text-sm text-white/80">
                                                                {formatAddress(tx.from)}
                                                            </TableCell>
                                                            <TableCell className="font-mono text-sm text-white/80">
                                                                {formatAddress(tx.to)}
                                                            </TableCell>
                                                            <TableCell className="text-white/90">
                                                                {formatEther(tx.value)} ETH
                                                            </TableCell>
                                                            <TableCell>
                                                                {getStatusBadge(tx.status)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        {batch.merkleRoot && (
                                            <div className="mt-4 p-3 rounded bg-white/5 border border-white/10">
                                                <div className="text-xs text-white/50 mb-1">Merkle Root</div>
                                                <div className="font-mono text-sm text-white/80 break-all">
                                                    {batch.merkleRoot}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
} 