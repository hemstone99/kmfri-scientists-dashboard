import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ChatMessage } from '../types/kmfri.ts';

interface ConnectedClient {
  ws: WebSocket;
  userId: string | null;
  userName: string | null;
}

const clients = new Set<ConnectedClient>();

export function getOnlineUserIds(): string[] {
  const ids = new Set<string>();
  for (const client of clients) {
    if (client.userId && client.ws.readyState === WebSocket.OPEN) {
      ids.add(client.userId);
    }
  }
  return Array.from(ids);
}

export function broadcastRealtimeEvent(event: string, payload: unknown): void {
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastPresence(): void {
  broadcastRealtimeEvent('presence:update', {
    onlineUserIds: getOnlineUserIds(),
  });
}

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientRecord: ConnectedClient = {
      ws,
      userId: null,
      userName: null,
    };
    clients.add(clientRecord);

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'auth:identify' && data.userId) {
          clientRecord.userId = String(data.userId);
          clientRecord.userName = data.userName ? String(data.userName) : null;
          broadcastPresence();
        } else if (data.type === 'chat:typing' && data.channelId && clientRecord.userId) {
          broadcastRealtimeEvent('chat:typing', {
            channelId: String(data.channelId),
            userId: clientRecord.userId,
            userName: clientRecord.userName || 'Scientist',
          });
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      clients.delete(clientRecord);
      broadcastPresence();
    });

    ws.on('error', () => {
      clients.delete(clientRecord);
      broadcastPresence();
    });

    // Send initial presence list
    ws.send(
      JSON.stringify({
        event: 'presence:update',
        payload: { onlineUserIds: getOnlineUserIds() },
        timestamp: new Date().toISOString(),
      })
    );
  });

  return wss;
}

export function broadcastNewChatMessage(msg: ChatMessage): void {
  broadcastRealtimeEvent('chat:message_created', msg);
}
