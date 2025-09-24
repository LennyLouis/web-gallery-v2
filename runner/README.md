# Web Gallery Export Runner 🏃‍♂️

This is the background service responsible for processing ZIP export requests from the Web Gallery application.

## Overview

The runner operates independently from the main web application and handles:

- **ZIP Creation**: Downloads photos from S3/MinIO and creates compressed ZIP archives
- **Progress Tracking**: Updates database with real-time processing status
- **File Management**: Uploads completed ZIPs to S3 with signed download URLs
- **Cleanup**: Automatically removes expired files after 12 hours

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Frontend  │───▶│   Backend    │───▶│  Database   │
└─────────────┘    └──────────────┘    └─────────────┘
                            │                  ▲
                            ▼                  │
                   ┌──────────────┐    ┌─────────────┐
                   │    Runner    │───▶│     S3      │
                   └──────────────┘    └─────────────┘
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your settings
```

### Key Configuration Options

- **RUNNER_POLL_INTERVAL_MS**: How often to check for new jobs (default: 5000ms)
- **RUNNER_MAX_CONCURRENT_JOBS**: Maximum simultaneous exports (default: 2)
- **RUNNER_DOWNLOAD_URL_EXPIRY_HOURS**: Download link validity (default: 12 hours)

## Running the Service

### With Docker Compose (Recommended)

```bash
# From the web-gallery-v2 root directory
docker compose up export-runner
```

### Standalone Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Start in production mode
npm start
```

## Process Flow

1. **Job Detection**: Polls database for `status = 'queued'` exports
2. **Photo Retrieval**: Downloads photos from S3 in controlled batches
3. **ZIP Creation**: Creates compressed archive with unique filenames
4. **S3 Upload**: Stores ZIP file with streaming multipart upload
5. **URL Generation**: Creates signed download URL valid for 12 hours
6. **Status Update**: Marks export as `ready` with download link
7. **Cleanup**: Automatically removes expired files and updates status

## Monitoring

### Health Checks

The runner includes built-in health checks accessible via Docker:

```bash
docker compose ps export-runner
```

### Logs

View runner logs:

```bash
docker compose logs export-runner -f
```

### Performance Metrics

The runner logs key metrics:
- Processing time per export
- Photos processed per minute
- Failed download attempts
- S3 upload performance

## Error Handling

The runner handles various error conditions:

- **S3 Connection Issues**: Retries with exponential backoff
- **Database Connectivity**: Graceful degradation with reconnection
- **Photo Download Failures**: Individual photo failures don't stop the export
- **Memory Management**: Controlled batch processing prevents OOM errors

## Scaling

For high-volume deployments:

1. **Horizontal Scaling**: Run multiple runner instances
2. **Resource Allocation**: Adjust `RUNNER_MAX_CONCURRENT_JOBS` based on CPU/Memory
3. **S3 Performance**: Configure appropriate `partSize` and `queueSize` for uploads
4. **Database Pooling**: Monitor database connection usage

## Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start with auto-reload
npm run dev
```

### Adding New Features

The runner is modular with clear separation:

- **ExportProcessor**: Handles job processing logic
- **CleanupService**: Manages expired file removal
- **config.js**: Centralized configuration
- **database.js**: Database and S3 client management

## Troubleshooting

### Common Issues

1. **"No pending exports found"**: Normal when no jobs are queued
2. **S3 connection errors**: Check endpoint and credentials
3. **Database connection fails**: Verify Supabase configuration
4. **High memory usage**: Reduce batch sizes or concurrent jobs

### Debug Mode

Enable detailed logging:

```bash
ENABLE_DETAILED_LOGS=true npm start
```

## Dependencies

- **@supabase/supabase-js**: Database operations
- **@aws-sdk/client-s3**: S3 operations
- **@aws-sdk/lib-storage**: Streaming uploads
- **archiver**: ZIP file creation
- **crypto**: Checksum generation