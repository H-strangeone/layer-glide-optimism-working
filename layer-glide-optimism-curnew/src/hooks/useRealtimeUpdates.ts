import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5501';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (e) => {
        try {
          const { event } = JSON.parse(e.data);
          if (event?.startsWith('batch'))       queryClient.invalidateQueries({ queryKey: ['batches'] });
          if (event?.startsWith('transaction')) queryClient.invalidateQueries({ queryKey: ['transactions'] });
          if (event?.startsWith('balance'))     queryClient.invalidateQueries({ queryKey: ['balance'] });
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [queryClient]);
}