const { supabase, supabaseAdmin } = require('../config/database');

class Album {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.date = data.date;
    this.tags = data.tags || [];
    this.location = data.location;
    this.is_public = data.is_public || false;
    this.owner_id = data.owner_id;
    this.cover_photo_id = data.cover_photo_id || null; // Cover photo ID
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.photo_count = data.photo_count || 0; // Add photo_count support
    this.cover_photo_url = data.cover_photo_url || null; // Add cover photo URL
  }

  static async create(albumData) {
    const { data, error } = await supabaseAdmin
      .from('albums')
      .insert([albumData])
      .select()
      .single();

    if (error) throw error;
    return new Album(data);
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    // Get photo count for this album
    const { count, error: countError } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', id);

    if (countError) {
      console.warn(`Error counting photos for album ${id}:`, countError);
      data.photo_count = 0;
    } else {
      data.photo_count = count || 0;
    }

    // Enrich with cover photo URL
    await Album.enrichWithCoverPhotoUrl(data);

    return new Album(data);
  }

  static async findByOwner(ownerId) {
    // First get the albums
    const { data: albumsData, error: albumsError } = await supabase
      .from('albums')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (albumsError) throw albumsError;

    // For each album, get the photo count and cover photo URL
    const albumsWithCount = await Promise.all(
      albumsData.map(async (albumData) => {
        // Get photo count
        const { count, error: countError } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', albumData.id);

        if (countError) {
          console.warn(`Error counting photos for album ${albumData.id}:`, countError);
          albumData.photo_count = 0;
        } else {
          albumData.photo_count = count || 0;
        }

        // Enrich with cover photo URL
        await Album.enrichWithCoverPhotoUrl(albumData);

        return new Album(albumData);
      })
    );

    return albumsWithCount;
  }

  static async findPublic() {
    // First get the public albums
    const { data: albumsData, error: albumsError } = await supabase
      .from('albums')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (albumsError) throw albumsError;

    // For each album, get the photo count and cover photo URL
    const albumsWithCount = await Promise.all(
      albumsData.map(async (albumData) => {
        // Get photo count
        const { count, error: countError } = await supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', albumData.id);

        if (countError) {
          console.warn(`Error counting photos for album ${albumData.id}:`, countError);
          albumData.photo_count = 0;
        } else {
          albumData.photo_count = count || 0;
        }

        // Enrich with cover photo URL
        await Album.enrichWithCoverPhotoUrl(albumData);

        return new Album(albumData);
      })
    );

    return albumsWithCount;
  }

  static async update(id, updates) {
    const { data, error } = await supabaseAdmin
      .from('albums')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return new Album(data);
  }

  static async delete(id) {
    const { error } = await supabaseAdmin
      .from('albums')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getPhotos() {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('album_id', this.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(photo => new (require('./Photo'))(photo));
  }

  // Get cover photo with signed URL
  async getCoverPhotoUrl() {
    if (!this.cover_photo_id) return null;
    
    try {
      const Photo = require('./Photo');
      const coverPhoto = await Photo.findById(this.cover_photo_id);
      if (!coverPhoto) return null;
      
      return await coverPhoto.getPreviewUrl();
    } catch (error) {
      console.warn(`Error getting cover photo URL for album ${this.id}:`, error);
      return null;
    }
  }

  // Static helper to enrich album data with cover photo URLs
  static async enrichWithCoverPhotoUrl(albumData) {
    if (!albumData.cover_photo_id) {
      albumData.cover_photo_url = null;
      return albumData;
    }

    try {
      const { data: coverPhoto, error } = await supabase
        .from('photos')
        .select('preview_path')
        .eq('id', albumData.cover_photo_id)
        .maybeSingle();

      if (error || !coverPhoto) {
        albumData.cover_photo_url = null;
        return albumData;
      }

      const s3Storage = require('../utils/s3Storage');
      albumData.cover_photo_url = await s3Storage.getSignedUrl(coverPhoto.preview_path, 3600);
    } catch (error) {
      console.warn(`Error getting cover photo URL for album ${albumData.id}:`, error);
      albumData.cover_photo_url = null;
    }

    return albumData;
  }
}

module.exports = Album;