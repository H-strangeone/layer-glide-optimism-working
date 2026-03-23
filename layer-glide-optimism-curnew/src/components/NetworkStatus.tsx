import { useEffect, useState } from "react";
<<<<<<< HEAD
import { useWallet } from "@/hooks/useWallet";
import { getGasPrice, getNetworkName } from "@/lib/ethers";
import { Activity, Globe, Zap, Server } from "lucide-react";

interface NetworkInfo {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'slow';
  latency: string;
  blocks: number;
}

export default function NetworkStatus() {
  const { isConnected } = useWallet();
=======
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { getGasPrice, getNetworkName } from "@/lib/ethers";
import { formatEther } from "ethers";

export default function NetworkStatus() {
  const { address, isConnected } = useWallet();
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
  const [gasPrice, setGasPrice] = useState<string>("0");
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [networkName, setNetworkName] = useState<string>("");

<<<<<<< HEAD
  const [simulatedNetworks] = useState<NetworkInfo[]>([
    { id: 'eth-l1', name: 'Ethereum L1', status: 'online', latency: '12ms', blocks: 19485721 },
    { id: 'opt-main', name: 'Optimism Main', status: 'online', latency: '4ms', blocks: 112938472 },
    { id: 'arb-one', name: 'Arbitrum One', status: 'slow', latency: '85ms', blocks: 82736412 },
  ]);

=======
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
  useEffect(() => {
    const updateNetworkInfo = async () => {
      if (!window.ethereum) return;

      try {
<<<<<<< HEAD
=======
        // Get network name
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        const name = getNetworkName(chainId);
        setNetworkName(name);

<<<<<<< HEAD
        const price = await getGasPrice();
        try {
          const gweiNum = parseInt(price, 16) / 1e9;
          setGasPrice(gweiNum.toFixed(2) + ' gwei');
        } catch {
          setGasPrice(price);
        }

        const provider = await window.ethereum.request({ method: "eth_blockNumber" });
=======
        // Get gas price
        const price = await getGasPrice();
        setGasPrice(formatEther(price));

        // Get latest block number
        const provider = await window.ethereum.request({
          method: "eth_blockNumber",
        });
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        setBlockNumber(Number(provider));
      } catch (error) {
        console.error("Error updating network info:", error);
      }
    };

    updateNetworkInfo();
<<<<<<< HEAD
    const interval = setInterval(updateNetworkInfo, 10000);
=======
    const interval = setInterval(updateNetworkInfo, 10000); // Update every 10 seconds

>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
    return () => clearInterval(interval);
  }, []);

  if (!isConnected) return null;

  return (
<<<<<<< HEAD
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
      {/* Current Network Focused Section */}
      <div className="lg:col-span-2 glass rounded-sm overflow-hidden border-accent-orange/20 relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-orange" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-orange/10 border border-orange/20">
                <Globe size={20} className="text-orange" />
              </div>
              <div>
                <div className="ln-label">Active Connection</div>
                <h3 className="ln-title text-2xl tracking-normal">{networkName || "Detecting..."}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 anim-pulse-orange" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-sm bg-white/5 border border-white/5">
              <div className="ln-label text-[10px] mb-1">Local Gas</div>
              <div className="text-xl font-bold font-mono text-orange">{gasPrice}</div>
            </div>
            <div className="p-4 rounded-sm bg-white/5 border border-white/5">
              <div className="ln-label text-[10px] mb-1">Block Height</div>
              <div className="text-xl font-bold font-mono">{blockNumber.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-sm bg-white/5 border border-white/5">
              <div className="ln-label text-[10px] mb-1">Peer Latency</div>
              <div className="text-xl font-bold font-mono">1.2ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* Other Networks (Live Check Feel) */}
      <div className="glass rounded-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Server size={16} className="text-muted" />
          <h3 className="ln-title text-lg tracking-normal">Ecosystem Status</h3>
        </div>
        
        <div className="space-y-4">
          {simulatedNetworks.map(net => (
            <div key={net.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  net.status === 'online' ? 'bg-green-500' : 
                  net.status === 'slow' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div>
                  <div className="text-xs font-bold text-text group-hover:text-orange transition-colors">{net.name}</div>
                  <div className="text-[9px] text-muted tracking-wide uppercase font-bold">{net.latency} latency</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted">{net.blocks.toLocaleString()}</div>
            </div>
          ))}
          
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-orange" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted">Rollup Health</span>
            </div>
            <span className="text-[10px] font-bold text-orange uppercase tracking-widest">99.99%</span>
          </div>
        </div>
      </div>
    </div>
=======
    <Card className="w-full max-w-md mx-auto mb-6 glass-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-l2-primary to-l2-secondary bg-clip-text text-transparent">
          Network Status
        </CardTitle>
        <CardDescription className="text-white/80">
          Current network information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-white/80">Network:</span>
            <span className="font-medium text-white">{networkName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/80">Gas Price:</span>
            <span className="font-medium text-white">{gasPrice} ETH</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/80">Block Number:</span>
            <span className="font-medium text-white">{blockNumber}</span>
          </div>
        </div>
      </CardContent>
    </Card>
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
  );
}
