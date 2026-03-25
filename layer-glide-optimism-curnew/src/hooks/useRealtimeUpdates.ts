import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5501';

type WSEvent =
  | 'connected'
  | 'batch_created'
  | 'batch_finalized'
  | 'fraud_proof_accepted'
  | 'fraud_proof_submitted'
  | 'tx_added'
  | 'balance_updated'
  | 'operator_slashed'
  | 'challenge_submitted';

interface WSMessage {
  event: WSEvent;
  data:  any;
  ts:    number;
}

let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function useRealtimeUpdates(options?: { showToasts?: boolean }) {
  const queryClient = useQueryClient();
  const showToasts  = options?.showToasts ?? true;

  const handleMessage = useCallback((msg: WSMessage) => {
    const { event, data } = msg;

    // Invalidate relevant queries
    if (event.startsWith('batch'))       queryClient.invalidateQueries({ queryKey: ['batches'] });
    if (event.startsWith('tx'))          queryClient.invalidateQueries({ queryKey: ['transactions'] });
    if (event.startsWith('balance'))     queryClient.invalidateQueries({ queryKey: ['balance'] });
    if (event.startsWith('fraud'))       queryClient.invalidateQueries({ queryKey: ['challenges'] });
    if (event.startsWith('operator'))    queryClient.invalidateQueries({ queryKey: ['operators'] });

    // Show toasts for important events
    if (!showToasts) return;

    switch (event) {
      case 'batch_created':
        toast({
          title: '📦 New Batch Committed',
          description: `Batch #${data?.onChainId || '?'} with ${data?.txCount} transactions · Challenge window open`,
        });
        break;
      case 'batch_finalized':
        toast({
          title: '✅ Batch Finalized',
          description: `Batch #${data?.onChainId} is now permanently committed to L1`,
        });
        break;
      case 'fraud_proof_accepted':
        toast({
          title: '🚨 Fraud Proof Accepted!',
          description: `Batch #${data?.onChainId} was invalid. Challenger: ${data?.challenger?.slice(0,8)}...`,
          variant: 'destructive',
        });
        break;
      case 'operator_slashed':
        toast({
          title: '⚡ Operator Slashed',
          description: `Operator ${data?.operator?.slice(0,8)}... lost ${parseFloat(data?.amount || '0') / 1e18} ETH`,
          variant: 'destructive',
        });
        break;
      case 'tx_added':
        // Silent — too frequent
        break;
    }
  }, [queryClient, showToasts]);

  useEffect(() => {
    function connect() {
      if (globalWs && globalWs.readyState === WebSocket.OPEN) return;

      globalWs = new WebSocket(WS_URL);

      globalWs.onopen = () => {
        console.log('🔌 WebSocket connected');
      };

      globalWs.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data);
          handleMessage(msg);
        } catch {}
      };

      globalWs.onclose = () => {
        console.log('🔌 WebSocket disconnected — reconnecting...');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
      };

      globalWs.onerror = () => {
        globalWs?.close();
      };
    }

    connect();

    return () => {
      // Don't close on unmount — keep alive across page navigations
    };
  }, [handleMessage]);
}

// Manual send (for future use)
export function sendWsMessage(event: string, data: any) {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({ event, data }));
  }
}