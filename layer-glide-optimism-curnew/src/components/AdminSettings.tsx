import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from './ui/use-toast';
import { addOperator, removeOperator, NETWORK_SETTINGS, switchNetwork } from '../lib/ethers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Loader2, Plus, Trash2, RefreshCw, Network, Link, Settings, Server, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface Operator { address: string; isActive: boolean; }
interface Contract { id: string; address: string; network: string; chainId: string; isActive: boolean; }

export default function AdminSettings() {
    const { toast } = useToast();
    const [operators, setOperators] = useState<Operator[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [newOp, setNewOp] = useState('');
    const [newCon, setNewCon] = useState('');
    const [selNet, setSelNet] = useState<string>('localhost');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const sync = async () => {
        try { setRefreshing(true); 
            const opR = await fetch('http://localhost:5500/api/admin/operators'); setOperators(await opR.json());
            const coR = await fetch('http://localhost:5500/api/admin/contracts'); setContracts(await coR.json());
        } catch (e) { console.error(e); } finally { setRefreshing(false); }
    };

    useEffect(() => { sync(); }, []);

    const handleAddOperator = async () => {
        if (!newOp) return;
        setLoading(true);
        try { await addOperator(newOp); toast({ title: 'Success', description: 'Operator authorized' }); setNewOp(''); sync(); }
        catch (e) { toast({ title: 'Error', description: 'Failed to authorize', variant: 'destructive' }); }
        finally { setLoading(true); }
    };

    const handleRemoveOp = async (addr: string) => {
        setLoading(true);
        try { await removeOperator(addr); toast({ title: 'Success', description: 'Operator revoked' }); sync(); }
        catch (e) { toast({ title: 'Error', description: 'Failed to revoke', variant: 'destructive' }); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-12">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 rounded-sm bg-orange/10">
                      <Settings size={20} className="text-orange" />
                   </div>
                   <div>
                      <h3 className="ln-title text-2xl tracking-tight">Core Configuration</h3>
                      <p className="ln-label text-xs">Infrastructure telemetry & protocol settings</p>
                   </div>
                </div>
                <button onClick={sync} className="text-muted hover:text-orange transition-colors">
                   <RefreshCw size={16} className={refreshing ? 'anim-spin' : ''} />
                </button>
            </div>

            <Tabs defaultValue="operators" className="space-y-8">
               <div className="flex justify-center">
                   <TabsList className="bg-white/5 p-1 rounded-sm border border-white/5">
                      <TabsTrigger value="operators" className="px-8 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-orange transition-all">Authorized Nodes</TabsTrigger>
                      <TabsTrigger value="networks" className="px-8 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-white/10 data-[state=active]:text-orange transition-all">Telemetry Nodes</TabsTrigger>
                   </TabsList>
               </div>

                <TabsContent value="operators" className="space-y-8">
                   <div className="flex gap-4 p-4 bg-white/5 border border-white/5 rounded-sm">
                      <Input
                          placeholder="Node address (0x...)"
                          value={newOp} onChange={(e) => setNewOp(e.target.value)}
                          className="ln-input text-xs h-10 font-mono"
                      />
                      <Button onClick={handleAddOperator} disabled={loading} className="btn-primary px-8">
                         <Plus size={14} className="mr-2" /> Authorize
                      </Button>
                   </div>

                   <div className="space-y-3">
                       {operators.map(op => (
                           <div key={op.address} className="bg-white/5 border border-white/5 rounded-sm p-4 flex items-center justify-between group hover:border-orange/20 transition-all">
                              <div className="flex items-center gap-4">
                                 <Activity size={16} className="text-orange" />
                                 <span className="text-[11px] font-mono font-bold text-text">{op.address}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                 <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${op.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white/5 text-muted border-white/10'}`}>
                                    {op.isActive ? 'Active' : 'Standby'}
                                 </span>
                                 <button onClick={() => handleRemoveOp(op.address)} className="text-muted hover:text-red-500 transition-colors">
                                    <Trash2 size={14} />
                                 </button>
                              </div>
                           </div>
                       ))}
                   </div>
                </TabsContent>

                <TabsContent value="networks" className="space-y-8">
                    <div className="p-8 glass rounded-sm space-y-8">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <Network size={20} className="text-orange" />
                             <div>
                                <h4 className="text-[14px] font-bold uppercase tracking-widest text-text">Network Routing</h4>
                                <p className="text-[10px] text-muted">Primary L1 commitment target</p>
                             </div>
                          </div>
                          <Select value={selNet} onValueChange={setSelNet}>
                             <SelectTrigger className="w-48 ln-input h-10">
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                {Object.keys(NETWORK_SETTINGS).map(k => (
                                    <SelectItem key={k} value={k}>{NETWORK_SETTINGS[k as keyof typeof NETWORK_SETTINGS].chainName}</SelectItem>
                                ))}
                             </SelectContent>
                          </Select>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                             <div className="ln-label text-[9px] mb-1 uppercase tracking-widest">Protocol ID</div>
                             <div className="text-xl font-bold font-mono text-orange">{NETWORK_SETTINGS[selNet as keyof typeof NETWORK_SETTINGS].chainId}</div>
                          </div>
                          <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                             <div className="ln-label text-[9px] mb-1 uppercase tracking-widest">Relay Endpoint</div>
                             <div className="text-[10px] font-mono text-muted">{NETWORK_SETTINGS[selNet as keyof typeof NETWORK_SETTINGS].rpcUrls[0]}</div>
                          </div>
                       </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
} 