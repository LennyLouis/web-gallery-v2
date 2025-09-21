const s3Storage = require('../app/utils/s3Storage');
require('dotenv').config({ path: '../../.env' });

async function testS3Connection() {
  try {
    console.log('🔍 Testing S3/Minio connection...');

    // Test d'upload d'un petit fichier
    const testBuffer = Buffer.from('Hello Minio!', 'utf-8');
    const testKey = 'test/hello.txt';

    console.log('📤 Uploading test file...');
    const result = await s3Storage.uploadFile(testBuffer, testKey, 'text/plain');
    console.log('✅ Upload successful:', result);

    // Test de vérification d'existence
    console.log('🔍 Checking if file exists...');
    const exists = await s3Storage.fileExists(testKey);
    console.log('📁 File exists:', exists);

    // Test de génération d'URL signée
    console.log('🔗 Generating signed URL...');
    const signedUrl = await s3Storage.getSignedUrl(testKey, 300);
    console.log('🔗 Signed URL:', signedUrl);

    // Test de suppression
    console.log('🗑️  Deleting test file...');
    const deleted = await s3Storage.deleteFile(testKey);
    console.log('🗑️  Deleted:', deleted);

    console.log('🎉 All S3/Minio tests passed!');

  } catch (error) {
    console.error('❌ S3/Minio test failed:', error.message);
    process.exit(1);
  }
}

testS3Connection();