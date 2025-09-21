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
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
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
    return data ? new Album(data) : null;
  }

  static async findByOwner(ownerId) {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(album => new Album(album));
  }

  static async findPublic() {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(album => new Album(album));
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
}

module.exports = Album;