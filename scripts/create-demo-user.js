#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const email = process.env.DEMO_EMAIL || 'demo@fanfares.local';
const password = process.env.DEMO_PASSWORD || 'demo123456';

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Demo User' } },
  });

  if (error) {
    console.error('Failed to create demo user:', error.message);
    process.exit(1);
  }

  if (data.user) {
    console.log(`Demo account created: ${email}`);
    console.log(`Password: ${password}`);
  } else {
    console.log('Demo account may already exist or require email confirmation.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
