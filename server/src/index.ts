import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { runMigrations } from './db/database';
import { checkAlerts } from './agents/erpAgent';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Run database migrations
  runMigrations();
  console.log('[Server] Database ready');

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket server for real-time alerts
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected');

    // Send initial alerts on connection
    try {
      const alerts = checkAlerts();
      ws.send(JSON.stringify({ type: 'alerts', data: alerts, timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error('[WS] Error sending initial alerts:', err);
    }

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        } else if (data.type === 'request_alerts') {
          const alerts = checkAlerts();
          ws.send(JSON.stringify({ type: 'alerts', data: alerts, timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  // Broadcast alerts every 5 minutes
  const ALERT_INTERVAL = 5 * 60 * 1000;
  setInterval(() => {
    if (wss.clients.size === 0) return;
    try {
      const alerts = checkAlerts();
      const message = JSON.stringify({ type: 'alerts', data: alerts, timestamp: new Date().toISOString() });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      if (alerts.length > 0) {
        console.log(`[WS] Broadcasted ${alerts.length} alert(s) to ${wss.clients.size} client(s)`);
      }
    } catch (err) {
      console.error('[WS] Error broadcasting alerts:', err);
    }
  }, ALERT_INTERVAL);

  server.listen(PORT, () => {
    console.log(`[Server] DepartTravel ERP running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
