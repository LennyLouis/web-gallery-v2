const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class LocalStorage {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../../', config.storage.local.baseDir);
    this.publicUrl = config.storage.local.publicUrl;
  }

  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async saveFile(buffer, relativePath) {
    const fullPath = path.join(this.baseDir, relativePath);
    const dir = path.dirname(fullPath);

    await this.ensureDir(dir);
    await fs.writeFile(fullPath, buffer);

    return {
      path: relativePath,
      fullPath,
      url: `${this.publicUrl}/${relativePath}`
    };
  }

  async deleteFile(relativePath) {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${relativePath}:`, error);
      return false;
    }
  }

  async deleteDirectory(relativePath) {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.rm(fullPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete directory ${relativePath}:`, error);
      return false;
    }
  }

  async fileExists(relativePath) {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(relativePath) {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      throw new Error(`File not found: ${relativePath}`);
    }
  }

  getFileUrl(relativePath) {
    return `${this.publicUrl}/${relativePath}`;
  }

  getAlbumPath(userId, albumId) {
    return `${userId}/${albumId}`;
  }

  getPreviewPath(userId, albumId) {
    return `${userId}/${albumId}/previews`;
  }

  async createAlbumStructure(userId, albumId) {
    const albumPath = this.getAlbumPath(userId, albumId);
    const previewPath = this.getPreviewPath(userId, albumId);

    await Promise.all([
      this.ensureDir(path.join(this.baseDir, albumPath)),
      this.ensureDir(path.join(this.baseDir, previewPath))
    ]);

    return { albumPath, previewPath };
  }

  async deleteAlbumStructure(userId, albumId) {
    const albumPath = this.getAlbumPath(userId, albumId);
    return await this.deleteDirectory(albumPath);
  }
}

module.exports = new LocalStorage();