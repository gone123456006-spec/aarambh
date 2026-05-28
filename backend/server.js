require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { validateEnv, getPublicBaseUrl } = require('./src/config/env');
const { ensureUploadDirs } = require('./src/config/uploads');
const { getCorsOptions } = require('./src/config/cors');
const configureChatSocket = require('./src/sockets/chatSocket');
const { startKeepAlive, stopKeepAlive } = require('./src/utils/keepAlive');

validateEnv();

const PORT = Number(process.env.PORT) || 5000;
let keepAliveTimer = null;
let httpServer = null;
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[server] ${signal} — closing...`);

  stopKeepAlive(keepAliveTimer);

  if (!httpServer) {
    process.exit(0);
    return;
  }

  httpServer.close(() => {
    console.log('[server] Stopped.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[server] Forced exit after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function startServer() {
  ensureUploadDirs();
  await connectDB();

  httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: getCorsOptions(),
  });

  configureChatSocket(io);

  return new Promise((resolve, reject) => {
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[server] Port ${PORT} is already in use.`);
        console.error('[server] Fix: close the other backend terminal, or run:');
        console.error('         npm run free-port\n');
        reject(err);
        return;
      }
      reject(err);
    });

    httpServer.listen(PORT, '0.0.0.0', () => {
      const publicUrl = getPublicBaseUrl();
      console.log(
        `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
      if (publicUrl) {
        console.log(`Public URL: ${publicUrl}`);
        console.log(`Health: ${publicUrl}/health`);
      } else {
        console.log(`Health: http://localhost:${PORT}/health`);
      }
      keepAliveTimer = startKeepAlive();
      resolve(httpServer);
    });
  });
}

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err?.message || err}`);
  shutdown('unhandledRejection');
});

startServer().catch((err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(`Failed to start server: ${err.message}`);
  }
  process.exit(1);
});
