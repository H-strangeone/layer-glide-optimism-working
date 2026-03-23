import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";
import { LogOut, User } from "lucide-react";

export function WalletStatus() {
    const { address, isConnected, connect, disconnect } = useWallet();

    if (!isConnected) {
        return (
            <Button
                onClick={connect}
                className="btn-primary"
            >
                Connect Wallet
            </Button>
        );
    }

    return (
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
            </Button>
        </div>
    );
} 