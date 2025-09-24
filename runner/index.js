#!/usr/bin/env node

/**
 * Web Gallery Export Runner
 * 
 * This service runs independently and processes ZIP export jobs:
 * 1. Polls database for queued exports
 * 2. Downloads photos from S3 and creates ZIP files
 * 3. Uploads ZIP to S3 and creates signed download URLs
 * 4. Handles cleanup of expired files
 */

const ExportProcessor = require('./src/ExportProcessor');
const CleanupService = require('./src/CleanupService');
const config = require('./src/config');

console.log(`
🏃‍♂️ Web Gallery Export Runner
================================
Environment: ${process.env.NODE_ENV || 'development'}
Poll Interval: ${config.pollIntervalMs}ms
Cleanup Interval: ${config.cleanupIntervalMs}ms
Max Concurrent Jobs: ${config.maxConcurrentJobs}
`);

// Graceful shutdown handler
let isShuttingDown = false;

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('🛑 Shutting down runner gracefully...');
  
  // Give running jobs some time to finish
  setTimeout(() => {
    console.log('✅ Runner shutdown complete');
    process.exit(0);
  }, 5000);
}

// Initialize services
const exportProcessor = new ExportProcessor();
const cleanupService = new CleanupService();

// Start the main runner loop
async function main() {
  console.log('🚀 Starting export runner...');
  
  // Start export processing loop
  setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      await exportProcessor.processNextBatch();
    } catch (error) {
      console.error('❌ Export processing error:', error.message);
    }
  }, config.pollIntervalMs);
  
  // Start cleanup service
  setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      await cleanupService.cleanupExpiredExports();
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }, config.cleanupIntervalMs);
  
  console.log('✅ Runner started successfully');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the runner
main().catch((error) => {
  console.error('💥 Failed to start runner:', error);
  process.exit(1);
});