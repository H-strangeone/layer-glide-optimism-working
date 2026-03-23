import React, { useState, useEffect } from 'react';
import AdminBatchManager from '../components/AdminBatchManager';
import AdminSettings from '../components/AdminSettings';
import { useWallet } from '../hooks/useWallet';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, Server, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import gsap from 'gsap';

const AdminPage: React.FC = () => {
  const { address, isConnected } = useWallet();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!address) {
        setIsAdminUser(false);
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`http://localhost:5500/api/admin/check?address=${address}`);
        const data = await response.json();
        if (!data.success || !data.isAdmin) {
          setIsAdminUser(false);
          navigate('/');
        } else {
          setIsAdminUser(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdminUser(false);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    checkAdminStatus();
  }, [address, navigate]);

  useEffect(() => {
    if (!isLoading && isAdminUser) {
        gsap.fromTo('.admin-header', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
        gsap.fromTo('.admin-content', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: 'power3.out' });
    }
  }, [isLoading, isAdminUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Server className="text-orange anim-pulse-orange" size={40} />
        <p className="ln-label">Checking permissions...</p>
      </div>
    );
  }

  if (!isConnected || !isAdminUser) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center gap-6">
        <div className="p-4 rounded-sm bg-red-500/10 border border-red-500/20 text-red-500">
           <Lock size={40} />
        </div>
        <h2 className="ln-title text-4xl tracking-tighter">Access Denied</h2>
        <p className="text-muted text-center max-w-sm">Unauthorized telemetry address. Dashboard locked.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-12">
      <div className="admin-header text-center space-y-3">
        <div className="tag mx-auto">Full Authority Mode</div>
        <h1 className="ln-title text-[4.5rem] tracking-tighter leading-none">
          Admin <span style={{ color: 'var(--orange)' }}>Panel.</span>
        </h1>
        <div className="h-0.5 w-24 bg-orange mx-auto rounded-full" />
      </div>

      <div className="admin-content">
        <Tabs defaultValue="batches" className="w-full">
            <div className="flex justify-center mb-10">
                <TabsList className="bg-white/5 border border-white/5 p-1 rounded-sm">
                  <TabsTrigger value="batches" className="flex items-center gap-2 px-8 py-2 rounded-sm data-[state=active]:bg-orange data-[state=active]:text-black text-xs font-black uppercase tracking-widest transition-all">
                    <Server size={14} /> Batch Control
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex items-center gap-2 px-8 py-2 rounded-sm data-[state=active]:bg-orange data-[state=active]:text-black text-xs font-black uppercase tracking-widest transition-all">
                    <Settings size={14} /> Core Settings
                  </TabsTrigger>
                </TabsList>
            </div>

            <div className="glass rounded-sm p-10 mt-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange" />
                <TabsContent value="batches" className="mt-0 focus:outline-none">
                  <AdminBatchManager isAdmin={isAdminUser} />
                </TabsContent>

                <TabsContent value="settings" className="mt-0 focus:outline-none">
                  <AdminSettings />
                </TabsContent>
            </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
