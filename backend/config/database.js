const { createClient } = require('@supabase/supabase-js');

let client = null;

const getPool = () => {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

    client = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
      global: {
        // Set 10 second timeout for all Supabase queries
        fetch: (url, options) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timer));
        },
      },
    });
    console.log('✅ Supabase client initialized');
    console.log(`   → URL: ${url}`);
  }
  return client;
};

const initializeDatabase = async () => {
  // Tables are created via Supabase dashboard SQL editor or migrations.
  // Run the SQL in /supabase-schema.sql once in your project.
  console.log('✅ Database ready (Supabase)');
};

module.exports = { getPool, initializeDatabase };