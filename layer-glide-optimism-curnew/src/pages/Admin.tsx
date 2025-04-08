import React, { useState, useEffect } from 'react';
import AdminBatchManager from '../components/AdminBatchManager';
import AdminSettings from '../components/AdminSettings';
import { useWallet } from '../hooks/useWallet';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { isAdmin } from '../lib/ethers';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

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
          // Redirect non-admin users to home page
          navigate('/');
        } else {
          setIsAdminUser(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdminUser(false);
        // Redirect on error
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [address, navigate]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
          <CardContent className="py-8">
            <div className="text-center text-white/70">
              Checking admin privileges...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8">
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
          <CardContent className="py-8">
            <div className="text-center text-white/70">
              Please connect your wallet to access the admin panel
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="container mx-auto py-8">
        <Card className="glass-card border border-white/10 backdrop-blur-md bg-black/30">
          <CardContent className="py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have admin privileges. Only authorized addresses can access this panel.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
        Admin Panel
      </h1>

      <Tabs defaultValue="batches" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="batches" className="data-[state=active]:bg-white/10">
            Batch Management
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white/10">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <AdminBatchManager isAdmin={isAdminUser} />
        </TabsContent>

        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
