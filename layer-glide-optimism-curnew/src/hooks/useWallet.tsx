import React, { useState, useEffect, useCallback } from 'react';
import { connectWallet, disconnectWallet } from '@/lib/ethers';

export function useWallet() {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAccountsChanged = useCallback((accounts: string[]) => {
        if (accounts.length === 0) {
            setAddress(null);
            setIsConnected(false);
            localStorage.removeItem('walletConnected');
            localStorage.removeItem('lastConnectedAddress');
        } else {
            setAddress(accounts[0]);
            setIsConnected(true);
            localStorage.setItem('walletConnected', 'true');
            localStorage.setItem('lastConnectedAddress', accounts[0]);
        }
    }, []);

    const handleChainChanged = useCallback(() => {
        window.location.reload();
    }, []);

    useEffect(() => {
        // Check if already connected on mount
        const checkConnection = async () => {
            try {
                const wasConnected = localStorage.getItem('walletConnected');
                const lastAddress = localStorage.getItem('lastConnectedAddress');

                if (wasConnected && lastAddress && window.ethereum) {
                    const accounts: string[] = await window.ethereum.request({
                        method: "eth_accounts"
                    });

                    if (accounts.length > 0 && accounts[0].toLowerCase() === lastAddress.toLowerCase()) {
                        setAddress(accounts[0]);
                        setIsConnected(true);
                    } else {
                        localStorage.removeItem('walletConnected');
                        localStorage.removeItem('lastConnectedAddress');
                    }
                }
            } catch (error) {
                console.error("Error checking connection:", error);
            }
        };

        checkConnection();

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [handleAccountsChanged, handleChainChanged]);

    const connect = async () => {
        if (isConnecting) return;
        setIsConnecting(true);
        setError(null);

        try {
            const result = await connectWallet();
            // Immediately update state - no page refresh needed
            setAddress(result.address);
            setIsConnected(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect wallet");
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnect = async () => {
        try {
            await disconnectWallet();
            setAddress(null);
            setIsConnected(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to disconnect wallet");
        }
    };

    return {
        address,
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect
    };
}

// Also export WalletProvider as a passthrough for layout.tsx compatibility
export function WalletProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}