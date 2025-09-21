const { supabase, supabaseAdmin } = require('../config/database');

class Photo {
  constructor(data) {
    this.id = data.id;
    this.filename = data.filename;
    this.original_name = data.original_name;
    this.file_path = data.file_path;
    this.preview_path = data.preview_path;
    this.file_size = data.file_size;
    this.mime_type = data.mime_type;
    this.width = data.width;
    this.height = data.height;
    this.album_id = data.album_id;
    this.uploaded_at = data.uploaded_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(photoData) {
    const { data, error } = await supabaseAdmin
      .from('photos')
      .insert([photoData])
      .select()
      .single();

    if (error) throw error;
    return new Photo(data);
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? new Photo(data) : null;
  }

  static async findByAlbum(albumId) {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('album_id', albumId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(photo => new Photo(photo));
  }

  static async update(id, updates) {
    const { data, error } = await supabaseAdmin
      .from('photos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return new Photo(data);
  }

  static async delete(id) {
    const { error } = await supabaseAdmin
      .from('photos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getDownloadUrl() {
    const s3Storage = require('../utils/s3Storage');
    return await s3Storage.getSignedUrl(this.file_path, 3600); // 1 hour expiry
  }

  async getPreviewUrl() {
    const s3Storage = require('../utils/s3Storage');
    return s3Storage.getPublicUrl(this.preview_path); // Public URL pour les previews
  }
}

module.exports = Photo;