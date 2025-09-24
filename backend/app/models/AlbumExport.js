const { supabase, supabaseAdmin } = require('../config/database');

class AlbumExport {
  constructor(data) {
    this.id = data.id;
    this.album_id = data.album_id;
    this.status = data.status;
    this.object_key = data.object_key;
    this.total_photos = data.total_photos;
    this.processed_photos = data.processed_photos;
    this.total_bytes = data.total_bytes;
    this.processed_bytes = data.processed_bytes;
    this.eta_seconds = data.eta_seconds;
    this.checksum = data.checksum;
    this.error = data.error;
    this.created_at = data.created_at;
    this.started_at = data.started_at;
    this.completed_at = data.completed_at;
    this._percent = data.percent; // Store explicit percent if provided
    
    // New fields for runner architecture
    this.photo_ids = data.photo_ids; // JSONB array of photo IDs
    this.download_url = data.download_url; // Signed S3 URL
    this.expires_at = data.expires_at; // Expiration timestamp
  }

  get percent() {
    // Use explicit percent if set, otherwise calculate from bytes
    if (this._percent !== undefined && this._percent !== null) {
      return this._percent;
    }
    if (!this.total_bytes || this.total_bytes === 0) return 0;
    return Math.min(100, Math.round((this.processed_bytes / this.total_bytes) * 100));
  }

  static async create(data) {
    const { data: row, error } = await supabaseAdmin
      .from('album_exports')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return new AlbumExport(row);
  }

  static async findById(id) {
    const { data: row, error } = await supabase
      .from('album_exports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return row ? new AlbumExport(row) : null;
  }

  static async findExistingQueuedOrProcessing(albumId, totalPhotos, totalBytes) {
    // Attempt to deduplicate by matching album and size/photo count in non-terminal status
    const { data, error } = await supabase
      .from('album_exports')
      .select('*')
      .eq('album_id', albumId)
      .in('status', ['queued','processing','ready'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data) return null;
    // Basic heuristic: same total photo count & bytes
    return data.map(r => new AlbumExport(r)).find(r => r.total_photos === totalPhotos && r.total_bytes === totalBytes && r.status !== 'failed');
  }

  static async update(id, updates) {
    const { data: row, error } = await supabaseAdmin
      .from('album_exports')
      .update({ ...updates })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return new AlbumExport(row);
  }

  // ===================================
  // RUNNER ARCHITECTURE METHODS
  // ===================================

  /**
   * Find pending exports for the runner to process
   */
  static async findPendingForRunner(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('album_exports')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data.map(item => new AlbumExport(item));
  }

  /**
   * Find expired exports for cleanup
   */
  static async findExpiredForCleanup(limit = 50) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('album_exports')
      .select('*')
      .eq('status', 'ready')
      .not('expires_at', 'is', null)
      .lt('expires_at', now)
      .limit(limit);

    if (error) throw error;
    return data.map(item => new AlbumExport(item));
  }

  /**
   * Create export with photo IDs for runner processing
   */
  static async createForRunner({ albumId, photoIds, userId, totalPhotos, totalBytes }) {
    const objectKey = `${albumId}/exports/${Date.now()}_export.zip`;
    
    const { data, error } = await supabaseAdmin
      .from('album_exports')
      .insert({
        album_id: albumId,
        status: 'queued',
        object_key: objectKey,
        photo_ids: photoIds, // Direct array, not JSON.stringify
        total_photos: totalPhotos || photoIds.length,
        total_bytes: totalBytes || 0,
        processed_photos: 0,
        processed_bytes: 0
      })
      .select()
      .single();

    if (error) throw error;
    return new AlbumExport(data);
  }

  static async patch(id, updates) {
    const { error } = await supabaseAdmin
      .from('album_exports')
      .update({ ...updates })
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  static async listRecentByAlbum(albumId, limit = 10) {
    const { data, error } = await supabase
      .from('album_exports')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(r => new AlbumExport(r));
  }
}

module.exports = AlbumExport;
