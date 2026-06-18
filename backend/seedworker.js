/**
 * Run once: node seedWorkers.js
 * Seeds the two worker accounts into Supabase.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);



(async () => {
  for (const w of workers) {
    const hash = await bcrypt.hash(w.password, 12);
    const { error } = await supabase
      .from('users')
      .upsert({ username: w.username, password: hash, role: 'worker' },
               { onConflict: 'username' });
    if (error) console.error(`❌ ${w.username}:`, error.message);
    else console.log(`✅ Worker seeded: ${w.username}`);
  }
  process.exit(0);
})();