const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { specs, swaggerUi, swaggerUiOptions } = require('./config/swagger');

// Optimize Node.js performance for file processing and long operations
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '20';

// Increase timeout for long-running operations (30 minutes)
const LONG_TIMEOUT_MS = parseInt(process.env.LONG_TIMEOUT_MS || '1800000', 10);

// Import routes
const authRoutes = require('./routes/authRoutes');
const albumRoutes = require('./routes/albumRoutes');
const photoRoutes = require('./routes/photoRoutes');
const accessLinkRoutes = require('./routes/accessLinkRoutes');
const userAlbumPermissionRoutes = require('./routes/userAlbumPermissionRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const exportService = require('./services/exportService');

const app = express();

// Configure server timeouts for long operations
app.use((req, res, next) => {
  // Set longer timeouts for download and export endpoints
  if (req.path.includes('/download') || req.path.includes('/export')) {
    req.setTimeout(LONG_TIMEOUT_MS);
    res.setTimeout(LONG_TIMEOUT_MS);
    
    // Keep connection alive for long operations
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', `timeout=${LONG_TIMEOUT_MS / 1000}`);
  }
  next();
});

// Trust proxy for correct client IP when behind reverse proxy / load balancer
app.set('trust proxy', 1);

// Security middlewares
app.use(helmet());

// CORS configuration
app.use(cors(config.cors));

// Rate limiting with skip for frequently polled endpoints (export status, health)
const limiter = rateLimit({
  ...config.rateLimit,
  skip: (req) => {
    if (req.path === '/health') return true;
    // Skip export status polling to avoid noisy rate-limit issues; can add custom throttle later
    if (/\/api\/albums\/.+\/exports\/.+\/status$/.test(req.path)) return true;
    return false;
  }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

// OpenAPI JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`🌐 INCOMING REQUEST: ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/access-links', accessLinkRoutes);
app.use('/api/permissions', userAlbumPermissionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/albums/:albumId/exports', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  res.status(error.status || 500).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : error.message
  });
});

const PORT = config.port;
const http = require('http');

// Create HTTP server with optimized settings for long operations
const server = http.createServer(app);

// Configure server timeouts
server.timeout = LONG_TIMEOUT_MS;           // Request timeout
server.keepAliveTimeout = 65000;            // Keep-alive timeout (65s)
server.headersTimeout = 66000;              // Headers timeout (66s, slightly more than keep-alive)
server.requestTimeout = LONG_TIMEOUT_MS;    // Overall request timeout

// Handle server errors gracefully
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Handle client errors (e.g., timeout, connection reset)
server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) {
    return; // Client disconnected, ignore
  }
  console.warn('⚠️  Client error:', err.message);
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`⏰ Long operations timeout: ${LONG_TIMEOUT_MS / 1000}s`);
  console.log(`🔄 Keep-alive timeout: ${server.keepAliveTimeout / 1000}s`);
  
  // Start worker & cleanup scheduler
  exportService.startWorkerLoop();
  if (config.exports?.cleanup?.enabled) {
    const intervalMs = (config.exports.cleanup.intervalMinutes || 60) * 60 * 1000;
    setInterval(() => {
      exportService.cleanupOldExports().catch(e => console.warn('Cleanup error:', e.message));
    }, intervalMs);
  }
});
