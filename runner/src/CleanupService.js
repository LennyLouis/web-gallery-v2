const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { supabase, s3Client, bucket } = require('./database');
const config = require('./config');

/**
 * Cleanup service for expired export files
 * Removes ZIP files from S3 after they expire and updates database status
 */
class CleanupService {
  /**
   * Find and cleanup expired exports
   */
  async cleanupExpiredExports() {
    try {
      const now = new Date().toISOString();
      
      // Find expired exports
      const { data: expiredExports, error } = await supabase
        .from('album_exports')
        .select('*')
        .eq('status', 'ready')
        .not('expires_at', 'is', null)
        .lt('expires_at', now)
        .limit(50); // Process in batches

      if (error) {
        console.error('❌ Failed to fetch expired exports:', error.message);
        return;
      }

      if (!expiredExports || expiredExports.length === 0) {
        if (config.enableDetailedLogs) {
          console.log('🧹 No expired exports found');
        }
        return;
      }

      console.log(`🧹 Found ${expiredExports.length} expired export(s) to cleanup`);

      // Process each expired export
      for (const exportData of expiredExports) {
        await this.cleanupSingleExport(exportData);
      }

      console.log(`✅ Cleanup completed for ${expiredExports.length} export(s)`);

    } catch (error) {
      console.error('❌ Cleanup service error:', error.message);
    }
  }

  /**
   * Cleanup a single expired export
   */
  async cleanupSingleExport(exportData) {
    try {
      console.log(`🗑️ Cleaning up expired export ${exportData.id}`);

      // Delete file from S3
      if (exportData.object_key) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: exportData.object_key
          }));
          console.log(`🗑️ Deleted S3 object: ${exportData.object_key}`);
        } catch (s3Error) {
          console.warn(`⚠️ Failed to delete S3 object ${exportData.object_key}:`, s3Error.message);
          // Continue with database update even if S3 deletion fails
        }
      }

      // Update database status
      const { error } = await supabase
        .from('album_exports')
        .update({
          status: 'expired',
          download_url: null, // Remove the expired URL
          error: 'Download link expired and file cleaned up'
        })
        .eq('id', exportData.id);

      if (error) {
        console.error(`❌ Failed to update export ${exportData.id} status:`, error.message);
      } else {
        console.log(`✅ Marked export ${exportData.id} as expired`);
      }

    } catch (error) {
      console.error(`❌ Failed to cleanup export ${exportData.id}:`, error.message);
    }
  }

  /**
   * Cleanup old failed exports (optional maintenance)
   */
  async cleanupOldFailedExports(olderThanDays = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const { data: oldExports, error } = await supabase
        .from('album_exports')
        .select('*')
        .eq('status', 'failed')
        .lt('created_at', cutoffDate.toISOString())
        .limit(100);

      if (error) {
        console.error('❌ Failed to fetch old failed exports:', error.message);
        return;
      }

      if (!oldExports || oldExports.length === 0) {
        return;
      }

      console.log(`🧹 Cleaning up ${oldExports.length} old failed export(s)`);

      for (const exportData of oldExports) {
        // Delete S3 object if it exists
        if (exportData.object_key) {
          try {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: bucket,
              Key: exportData.object_key
            }));
          } catch (s3Error) {
            // Object might not exist, continue
          }
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from('album_exports')
          .delete()
          .eq('id', exportData.id);

        if (deleteError) {
          console.warn(`⚠️ Failed to delete old export ${exportData.id}:`, deleteError.message);
        }
      }

    } catch (error) {
      console.error('❌ Old exports cleanup error:', error.message);
    }
  }
}

module.exports = CleanupService;