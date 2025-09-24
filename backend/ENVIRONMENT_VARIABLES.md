# Environment Variables Configuration

## Export System Configuration

The following environment variables can be used to optimize the export/download functionality for different file counts and system resources:

### Core Export Settings

```bash
# Maximum number of photos per export (default: 5000)
EXPORT_MAX_PHOTOS=5000

# Maximum total bytes per export in bytes (default: 6GB)
EXPORT_MAX_TOTAL_BYTES=6442450944

# Progress update interval in milliseconds (default: 1000)
EXPORT_PROGRESS_INTERVAL_MS=1000
```

### Streaming Performance Settings

```bash
# Number of concurrent file downloads during zip creation (default: 5)
# Increase for faster processing, decrease if running out of memory
EXPORT_CONCURRENT_DOWNLOADS=5

# Batch size for processing photos (default: 10)
# Larger batches = more memory usage but potentially faster
EXPORT_BATCH_SIZE=10

# Timeout per individual file stream in milliseconds (default: 30000)
EXPORT_STREAM_TIMEOUT_MS=30000

# Maximum retry attempts for failed files (default: 3)
EXPORT_MAX_RETRIES=3
```

### Node.js Performance Settings

```bash
# UV thread pool size for file operations (default: 20)
# Increase for better I/O concurrency
UV_THREADPOOL_SIZE=20
```

### Cleanup Settings

```bash
# Enable automatic cleanup of old exports (default: true)
EXPORT_CLEANUP_ENABLED=true

# Time to live for completed exports in hours (default: 72)
EXPORT_CLEANUP_TTL_HOURS=72

# Cleanup interval in minutes (default: 60)
EXPORT_CLEANUP_INTERVAL_MINUTES=60
```

## Recommended Settings by Use Case

### Small Albums (20-50 photos)
```bash
EXPORT_CONCURRENT_DOWNLOADS=3
EXPORT_BATCH_SIZE=5
```

### Medium Albums (50-150 photos)
```bash
EXPORT_CONCURRENT_DOWNLOADS=5
EXPORT_BATCH_SIZE=10
```

### Large Albums (150-400 photos)
```bash
EXPORT_CONCURRENT_DOWNLOADS=7
EXPORT_BATCH_SIZE=15
UV_THREADPOOL_SIZE=25
EXPORT_STREAM_TIMEOUT_MS=45000
```

### Memory-Constrained Systems
```bash
EXPORT_CONCURRENT_DOWNLOADS=2
EXPORT_BATCH_SIZE=5
UV_THREADPOOL_SIZE=10
```

### High-Performance Systems
```bash
EXPORT_CONCURRENT_DOWNLOADS=10
EXPORT_BATCH_SIZE=20
UV_THREADPOOL_SIZE=30
```

## Monitoring and Debugging

To monitor export performance, check the application logs for:
- Batch processing messages
- Individual photo processing errors
- Memory usage warnings
- S3 connectivity issues

Example log entries:
```
Processing batch 1/15 (10 photos)
Photo abc123 attempt 1/3 failed: timeout
Export def456 completed: 95/100 photos (5 failed)
```