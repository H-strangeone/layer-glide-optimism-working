import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from './ui/use-toast';
import { useWallet } from '../hooks/useWallet';
import { getContract, addOperator, removeOperator, isOperator, NETWORK_SETTINGS, switchNetwork } from '../lib/ethers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Loader2, Plus, Trash2, RefreshCw, Network, Link } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Operator {
    address: string;
    isActive: boolean;
}

interface Contract {
    id: string;
    address: string;
    network: string;
    chainId: string;
    isActive: boolean;
}

export default function AdminSettings() {
    const { address } = useWallet();
    const { toast } = useToast();
    const [operators, setOperators] = useState<Operator[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [newOperatorAddress, setNewOperatorAddress] = useState('');
    const [newContractAddress, setNewContractAddress] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState<string>('localhost');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);

    useEffect(() => {
        fetchOperators();
        fetchContracts();
    }, [address]);

    const fetchOperators = async () => {
        try {
            setIsRefreshing(true);
            const response = await fetch('http://localhost:5500/api/admin/operators');
            const data = await response.json();
            setOperators(data);
        } catch (error) {
            console.error('Error fetching operators:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch operators',
                variant: 'destructive',
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    const fetchContracts = async () => {
        try {
            setIsRefreshing(true);
            const response = await fetch('http://localhost:5500/api/admin/contracts');
            const data = await response.json();
            setContracts(data);
        } catch (error) {
            console.error('Error fetching contracts:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch contracts',
                variant: 'destructive',
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddOperator = async () => {
        if (!newOperatorAddress) {
            toast({
                title: 'Error',
                description: 'Operator address is required',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            await addOperator(newOperatorAddress);
            toast({
                title: 'Success',
                description: 'Operator added successfully',
            });
            setNewOperatorAddress('');
            fetchOperators();
        } catch (error) {
            console.error('Error adding operator:', error);
            toast({
                title: 'Error',
                description: 'Failed to add operator',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveOperator = async (operatorAddress: string) => {
        setIsLoading(true);
        try {
            await removeOperator(operatorAddress);
            toast({
                title: 'Success',
                description: 'Operator removed successfully',
            });
            fetchOperators();
        } catch (error) {
            console.error('Error removing operator:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove operator',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddContract = async () => {
        if (!newContractAddress) {
            toast({
                title: 'Error',
                description: 'Contract address is required',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5500/api/admin/contracts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: newContractAddress,
                    network: selectedNetwork,
                    chainId: NETWORK_SETTINGS[selectedNetwork as keyof typeof NETWORK_SETTINGS].chainId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add contract');
            }

            toast({
                title: 'Success',
                description: 'Contract added successfully',
            });
            setNewContractAddress('');
            fetchContracts();
        } catch (error) {
            console.error('Error adding contract:', error);
            toast({
                title: 'Error',
                description: 'Failed to add contract',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveContract = async (contractId: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:5500/api/admin/contracts/${contractId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to remove contract');
            }

            toast({
                title: 'Success',
                description: 'Contract removed successfully',
            });
            fetchContracts();
        } catch (error) {
            console.error('Error removing contract:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove contract',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitchNetwork = async (network: string) => {
        setIsNetworkSwitching(true);
        try {
            const success = await switchNetwork(network as "sepolia" | "localhost");
            if (success) {
                setSelectedNetwork(network);
                toast({
                    title: 'Success',
                    description: `Switched to ${network} network`,
                });
            }
        } catch (error) {
            console.error('Error switching network:', error);
            toast({
                title: 'Error',
                description: 'Failed to switch network',
                variant: 'destructive',
            });
        } finally {
            setIsNetworkSwitching(false);
        }
    };

    return (
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
            <CardHeader className="relative">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                            Admin Settings
                        </CardTitle>
                        <CardDescription className="text-white/70">
                            Manage operators, networks, and contracts
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => {
                            fetchOperators();
                            fetchContracts();
                        }}
                        disabled={isRefreshing}
                        variant="outline"
                        className="border-white/10 hover:bg-white/5"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="relative">
                <Tabs defaultValue="operators" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="operators" className="data-[state=active]:bg-white/10">
                            Operators
                        </TabsTrigger>
                        <TabsTrigger value="networks" className="data-[state=active]:bg-white/10">
                            Networks
                        </TabsTrigger>
                        <TabsTrigger value="contracts" className="data-[state=active]:bg-white/10">
                            Contracts
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="operators" className="space-y-4">
                        <div className="flex gap-4">
                            <Input
                                placeholder="Enter operator address (0x...)"
                                value={newOperatorAddress}
                                onChange={(e) => setNewOperatorAddress(e.target.value)}
                                className="bg-white/5 border-white/10 text-white flex-1"
                            />
                            <Button
                                onClick={handleAddOperator}
                                disabled={isLoading}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Operator
                            </Button>
                        </div>

                        <div className="border border-white/10 rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/10 hover:bg-white/5">
                                        <TableHead className="text-white/70">Address</TableHead>
                                        <TableHead className="text-white/70">Status</TableHead>
                                        <TableHead className="text-white/70 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {operators.map((operator) => (
                                        <TableRow key={operator.address} className="border-white/10 hover:bg-white/5">
                                            <TableCell className="font-mono text-white/90">
                                                {operator.address}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={operator.isActive ? "default" : "secondary"}
                                                    className={operator.isActive ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}
                                                >
                                                    {operator.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    onClick={() => handleRemoveOperator(operator.address)}
                                                    disabled={isLoading}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="networks" className="space-y-4">
                        <div className="grid gap-4">
                            <div className="border border-white/10 rounded-lg p-4">
                                <h3 className="text-lg font-medium text-white mb-4">Network Selection</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <Select
                                            value={selectedNetwork}
                                            onValueChange={handleSwitchNetwork}
                                        >
                                            <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Select network" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(NETWORK_SETTINGS).map(([key, network]) => (
                                                    <SelectItem key={key} value={key}>
                                                        <div className="flex items-center gap-2">
                                                            <Network className="h-4 w-4" />
                                                            <span>{network.chainName}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={() => handleSwitchNetwork(selectedNetwork)}
                                            disabled={isNetworkSwitching}
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                        >
                                            {isNetworkSwitching ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Link className="h-4 w-4 mr-2" />
                                            )}
                                            Switch Network
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/70">Current Network:</span>
                                            <span className="font-medium text-white">
                                                {NETWORK_SETTINGS[selectedNetwork as keyof typeof NETWORK_SETTINGS].chainName}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/70">Chain ID:</span>
                                            <span className="font-medium text-white">
                                                {NETWORK_SETTINGS[selectedNetwork as keyof typeof NETWORK_SETTINGS].chainId}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/70">RPC URL:</span>
                                            <span className="font-mono text-white/90 text-sm">
                                                {NETWORK_SETTINGS[selectedNetwork as keyof typeof NETWORK_SETTINGS].rpcUrls[0]}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="contracts" className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Enter contract address (0x...)"
                                    value={newContractAddress}
                                    onChange={(e) => setNewContractAddress(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white flex-1"
                                />
                                <Select
                                    value={selectedNetwork}
                                    onValueChange={setSelectedNetwork}
                                >
                                    <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
                                        <SelectValue placeholder="Select network" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(NETWORK_SETTINGS).map(([key, network]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <Network className="h-4 w-4" />
                                                    <span>{network.chainName}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleAddContract}
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Contract
                                </Button>
                            </div>

                            <div className="border border-white/10 rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-white/10 hover:bg-white/5">
                                            <TableHead className="text-white/70">Address</TableHead>
                                            <TableHead className="text-white/70">Network</TableHead>
                                            <TableHead className="text-white/70">Chain ID</TableHead>
                                            <TableHead className="text-white/70">Status</TableHead>
                                            <TableHead className="text-white/70 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contracts.map((contract) => (
                                            <TableRow key={contract.id} className="border-white/10 hover:bg-white/5">
                                                <TableCell className="font-mono text-white/90">
                                                    {contract.address}
                                                </TableCell>
                                                <TableCell>
                                                    {NETWORK_SETTINGS[contract.network as keyof typeof NETWORK_SETTINGS]?.chainName || contract.network}
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {contract.chainId}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={contract.isActive ? "default" : "secondary"}
                                                        className={contract.isActive ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}
                                                    >
                                                        {contract.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        onClick={() => handleRemoveContract(contract.id)}
                                                        disabled={isLoading}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
} 