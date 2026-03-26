/**
 * useRealtimeUpdates
 *
 * FIX 1.3: Single WebSocket connection replaces all polling loops.
 * Components subscribe once. Backend pushes all updates.
 * No more 6 independent polling intervals hammering the server.
 */

import { useEffect, useCallback, useRef } from 'react';
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

// Singleton WebSocket — one connection per browser tab
let globalWs:       WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting    = false;

// Subscriber registry
const subscribers = new Map<string, Set<(msg: WSMessage) => void>>();

function notifyAll(msg: WSMessage) {
  subscribers.forEach(set => set.forEach(cb => cb(msg)));
}

function connectGlobal() {
  if (isConnecting) return;
  if (globalWs && globalWs.readyState === WebSocket.OPEN) return;

  isConnecting = true;
  globalWs = new WebSocket(WS_URL);

  globalWs.onopen = () => {
    isConnecting = false;
    console.log('🔌 WebSocket connected');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  globalWs.onmessage = (e) => {
    try {
      const msg: WSMessage = JSON.parse(e.data);
      notifyAll(msg);
    } catch {}
  };

  globalWs.onclose = () => {
    isConnecting = false;
    console.log('🔌 WebSocket disconnected — reconnecting in 3s...');
    reconnectTimer = setTimeout(connectGlobal, 3000);
  };

  globalWs.onerror = () => {
    isConnecting = false;
    globalWs?.close();
  };
}

// Start connection immediately on module load
connectGlobal();

// ─────────────────────────────────────────────────────────────────────────────

export function useRealtimeUpdates(options?: { showToasts?: boolean }) {
  const queryClient = useQueryClient();
  const showToasts  = options?.showToasts ?? true;
  const idRef       = useRef(`sub-${Math.random().toString(36).slice(2)}`);

  const handleMessage = useCallback((msg: WSMessage) => {
    const { event, data } = msg;

    // Invalidate relevant queries (no polling needed)
    switch (event) {
      case 'batch_created':
      case 'batch_finalized':
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        queryClient.invalidateQueries({ queryKey: ['state-root'] });
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
        break;
      case 'tx_added':
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
        break;
      case 'balance_updated':
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        break;
      case 'fraud_proof_accepted':
      case 'fraud_proof_submitted':
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        queryClient.invalidateQueries({ queryKey: ['challenges'] });
        break;
      case 'operator_slashed':
        queryClient.invalidateQueries({ queryKey: ['operators'] });
        break;
    }

    if (!showToasts) return;

    // Toast notifications
    switch (event) {
      case 'batch_created':
        toast({
          title: '📦 New Batch Committed',
          description: `Batch #${data?.onChainId || '?'} — ${data?.txCount} txs — Challenge window open`,
        });
        break;
      case 'batch_finalized':
        toast({
          title: '✅ Batch Finalized',
          description: `Batch #${data?.onChainId} permanently committed to L1. Balances updated.`,
        });
        break;
      case 'fraud_proof_accepted':
        toast({
          title: '🚨 Fraud Proof Accepted!',
          description: `Batch #${data?.onChainId} was invalid. Challenger rewarded.`,
          variant: 'destructive',
        });
        break;
      case 'operator_slashed':
        toast({
          title: '⚡ Operator Slashed',
          description: `Operator ${data?.operator?.slice(0, 8)}... lost ${parseFloat(data?.amount || '0') / 1e18} ETH`,
          variant: 'destructive',
        });
        break;
    }
  }, [queryClient, showToasts]);

  useEffect(() => {
    const id  = idRef.current;
    const set = subscribers.get(id) ?? new Set();
    set.add(handleMessage);
    subscribers.set(id, set);

    return () => {
      subscribers.delete(id);
    };
  }, [handleMessage]);
}

export function sendWsMessage(event: string, data: any) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify({ event, data }));
  }
}