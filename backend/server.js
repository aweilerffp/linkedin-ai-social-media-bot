import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeDatabase } from './src/config/database.js';
import { initializeRedis } from './src/config/redis.js';
import { logger } from './src/utils/logger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import routes from './src/routes/index.js';
import { initializeQueue } from './src/services/queue/QueueService.js';
import { errorTracker } from './src/services/monitoring/ErrorTracker.js';
import { metricsCollector } from './src/services/monitoring/MetricsCollector.js';

dotenv.config({ path: '.env' });
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

// Configure error tracking with Express
errorTracker.configureExpress(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware
app.use(errorTracker.createPerformanceMiddleware());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error tracking middleware (must be after routes)
errorTracker.addErrorHandler(app);

// Error handling
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-team', (teamId) => {
    socket.join(`team-${teamId}`);
    logger.info(`Socket ${socket.id} joined team ${teamId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');
    
    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected successfully');
    
    // Initialize queue
    await initializeQueue();
    logger.info('Queue system initialized');
    
    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  
  // Stop metrics collection
  metricsCollector.stopCollection();
  
  // Cleanup error tracking
  errorTracker.cleanup();
  
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  errorTracker.captureError(error, { context: 'uncaught_exception' });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  errorTracker.captureError(new Error(String(reason)), { 
    context: 'unhandled_rejection',
    promise: promise.toString()
  });
});

startServer();