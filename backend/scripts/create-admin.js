const { supabaseAdmin } = require('../app/config/database');
require('dotenv').config({ path: '../../.env' });

async function createAdminUser() {
  try {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.log('Usage: node create-admin.js <email> <password>');
      console.log('Example: node create-admin.js admin@example.com mypassword123');
      process.exit(1);
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY in .env');
    }

    console.log(`Creating admin user: ${email}`);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    });

    if (error) {
      console.error('Error creating admin user:', error.message);
      process.exit(1);
    }

    console.log('✅ Admin user created successfully!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Role:', data.user.user_metadata.role);

  } catch (error) {
    console.error('Script error:', error.message);
    process.exit(1);
  }
}

createAdminUser();