import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";
<<<<<<< HEAD
import { LogOut, User } from "lucide-react";
=======
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d

export function WalletStatus() {
    const { address, isConnected, connect, disconnect } = useWallet();

    if (!isConnected) {
        return (
            <Button
                onClick={connect}
<<<<<<< HEAD
                className="btn-primary"
=======
                className="bg-purple-500 hover:bg-purple-600 text-white"
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
            >
                Connect Wallet
            </Button>
        );
    }

    return (
<<<<<<< HEAD
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-sm border-white/10 group hover:border-orange/20 transition-colors">
                <User size={14} className="text-orange" />
                <span className="text-xs font-mono font-bold text-text">
                    {formatAddress(address || '')}
                </span>
            </div>
            <Button
                onClick={disconnect}
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-sm"
                title="Disconnect"
            >
                <LogOut size={16} />
=======
        <div className="flex items-center space-x-4">
            <span className="text-purple-400">
                {formatAddress(address || '')}
            </span>
            <Button
                onClick={disconnect}
                variant="outline"
                className="border-purple-400 text-purple-400 hover:bg-purple-400/10"
            >
                Disconnect
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
            </Button>
        </div>
    );
} 