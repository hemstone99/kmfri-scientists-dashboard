import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Determine execution environment: dev with live Vite middleware vs production build
const isTsxLoaded = process.execArgv.some((a) => a.includes('tsx')) || process.env._TSX_BOOTSTRAPPED === '1';
const isDev = process.env.NODE_ENV === 'development' || (isTsxLoaded && process.env.NODE_ENV !== 'production');
const isProduction = process.env.NODE_ENV === 'production' || !isDev;
const distServerPath = path.join(process.cwd(), 'dist', 'server.js');

// True when this module IS dist/server.js. The bundle contains this same bootstrap, so
// without this guard `node dist/server.js` would hand off to itself: the self-import is a
// no-op on Linux (runServer() never runs) and crashes the ESM loader on Windows, where
// fileURLToPath() produces a drive-letter path that Node reads as a `c:` URL protocol.
const isBundledServer = (() => {
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(distServerPath);
  } catch {
    return false;
  }
})();

// Deployment bootstrap: If compiled server exists in production mode, hand off immediately
if (
  isProduction &&
  fs.existsSync(distServerPath) &&
  !process.env._RUNNING_BUNDLED_SERVER &&
  !isBundledServer
) {
  process.env._RUNNING_BUNDLED_SERVER = '1';
  await import(fileURLToPath(new URL('./dist/server.js', import.meta.url)));
} else if (!isTsxLoaded && isDev) {
  // If running via plain `node server.ts` in dev mode without tsx, bootstrap tsx runner transparently
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, _TSX_BOOTSTRAPPED: '1' },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  // Normal server execution
  await runServer();
}

async function runServer() {
  const express = (await import('express')).default;
  const http = (await import('node:http')).default;
  const { apiRouter } = await import('./src/server/api.ts');
  const { attachWebSocketServer } = await import('./src/server/realtime.ts');
  const { flushSupabaseMirror } = await import('./src/server/supabase.ts');

  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);

  // Attach real-time WebSocket communication
  attachWebSocketServer(httpServer);

  // Request parsers & API routes
  app.use(express.json({ limit: '50mb' }));
  app.use('/api', apiRouter);

  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  if (isProduction && hasDist) {
    // Production mode: Serve pre-built static client assets
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Local development mode: Mount Vite middleware for live HMR
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KMFRI Scientists & Research Management System running on http://0.0.0.0:${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  });

  // Drain any queued Supabase mirror before shutdown so the last write is not lost
  let shuttingDown = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      httpServer.close();
      flushSupabaseMirror().finally(() => process.exit(0));
    });
  }
}
