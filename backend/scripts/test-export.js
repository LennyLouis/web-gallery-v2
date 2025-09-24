/**
 * Test script for export functionality
 * Usage: node scripts/test-export.js <albumId> [photoCount]
 */

require('dotenv').config();

const Album = require('../app/models/Album');
const Photo = require('../app/models/Photo');
const exportService = require('../app/services/exportService');
const AlbumExport = require('../app/models/AlbumExport');

async function testExport(albumId, maxPhotos = null) {
  console.log('🧪 Testing Export Functionality');
  console.log('================================');
  
  try {
    // Get album info
    const album = await Album.findById(albumId);
    if (!album) {
      console.error(`❌ Album ${albumId} not found`);
      return;
    }
    
    console.log(`📁 Album: ${album.title}`);
    
    // Get photos
    const photos = await Photo.findByAlbum(albumId);
    const photoCount = maxPhotos ? Math.min(photos.length, maxPhotos) : photos.length;
    const testPhotos = photos.slice(0, photoCount);
    
    console.log(`📸 Testing with ${photoCount} photos (${photos.length} total available)`);
    
    const totalSize = testPhotos.reduce((sum, p) => sum + (p.file_size || 0), 0);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Create export job
    console.log('\n⏳ Creating export job...');
    const exportJob = await exportService.enqueueExport({
      albumId,
      photoIds: testPhotos.map(p => p.id),
      userId: 'test-user' // You might need to use a real user ID
    });
    
    console.log(`✅ Export job created: ${exportJob.id}`);
    console.log(`📊 Status: ${exportJob.status}`);
    
    // Monitor progress
    console.log('\n📈 Monitoring progress...');
    let lastStatus = exportJob.status;
    let lastPercent = 0;
    
    while (lastStatus === 'queued' || lastStatus === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const current = await AlbumExport.findById(exportJob.id);
      if (!current) break;
      
      if (current.status !== lastStatus || current.percent !== lastPercent) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] Status: ${current.status}, Progress: ${current.percent}%, Photos: ${current.processed_photos}/${current.total_photos}`);
        
        if (current.eta_seconds) {
          console.log(`   ETA: ${current.eta_seconds} seconds`);
        }
        
        lastStatus = current.status;
        lastPercent = current.percent;
      }
      
      if (current.status === 'ready' || current.status === 'failed') {
        break;
      }
    }
    
    // Final result
    const finalExport = await AlbumExport.findById(exportJob.id);
    console.log('\n🏁 Final Result:');
    console.log(`   Status: ${finalExport.status}`);
    console.log(`   Processed: ${finalExport.processed_photos}/${finalExport.total_photos} photos`);
    console.log(`   Size: ${(finalExport.processed_bytes / 1024 / 1024).toFixed(2)} MB`);
    
    if (finalExport.error) {
      console.log(`   Error: ${finalExport.error}`);
    }
    
    if (finalExport.status === 'ready') {
      console.log(`   ✅ Export completed successfully!`);
      console.log(`   📦 Object key: ${finalExport.object_key}`);
      console.log(`   🔐 Checksum: ${finalExport.checksum}`);
    } else {
      console.log(`   ❌ Export failed or incomplete`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/test-export.js <albumId> [maxPhotos]');
  console.log('Example: node scripts/test-export.js abc-123-def 50');
  process.exit(1);
}

const albumId = args[0];
const maxPhotos = args[1] ? parseInt(args[1]) : null;

testExport(albumId, maxPhotos)
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });