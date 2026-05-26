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

async function startServer() {
  ensureUploadDirs();
  await connectDB();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: getCorsOptions(),
  });

  configureChatSocket(io);

  server.listen(PORT, '0.0.0.0', () => {
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
  });

  server.on('close', () => {
    stopKeepAlive(keepAliveTimer);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err?.message || err}`);
    server.close(() => process.exit(1));
  });

  return server;
}

startServer().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
