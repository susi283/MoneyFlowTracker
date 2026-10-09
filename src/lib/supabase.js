import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getJwtRole(key) {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded).role || null;
  } catch {
    return null;
  }
}

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment or .env.local.'
  );
}

if (supabasePublishableKey.startsWith('sb_secret_') || getJwtRole(supabasePublishableKey) === 'service_role') {
  throw new Error('A Supabase secret/service-role key cannot be used in the browser. Configure a publishable or anon key instead.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabasePublishableKey || ''
);
