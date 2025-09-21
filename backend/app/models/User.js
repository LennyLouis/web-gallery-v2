const { supabase, supabaseAdmin } = require('../config/database');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.role = data.role || 'user';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(userData) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        role: userData.role || 'user'
      }
    });

    if (error) throw error;
    return new User(data.user);
  }

  static async findById(id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);

    if (error) throw error;
    return data.user ? new User(data.user) : null;
  }

  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('auth.users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? new User(data) : null;
  }

  static async updateRole(userId, role) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role }
    });

    if (error) throw error;
    return new User(data.user);
  }

  static async delete(userId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return true;
  }
}

module.exports = User;