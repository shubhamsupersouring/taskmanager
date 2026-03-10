let io = null;
const logger = require('./utils/logger');

// Minimal Socket.IO setup for boilerplate
function attach(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*' },
    path: '/socket.io/',
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });

  logger.info('Socket.IO server attached');
  return io;
}

function getIO() {
  return io;
}

module.exports = { attach, getIO };
