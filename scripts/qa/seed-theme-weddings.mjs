/**
 * Local QA only: creates a throwaway user on the LOCAL Supabase stack with one wedding per
 * visual style, using the same `create_wedding` RPC as the app (RLS applies as normal).
 *
 *   node scripts/qa/seed-theme-weddings.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  throw new Error('Refusing to seed a non-local Supabase URL.');
}
if (!anonKey) throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required (see .env).');

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const email = `theme.qa.${Date.now()}@example.com`;
const password = `ThemeQa-${Math.random().toString(36).slice(2, 10)}`;

const signUp = await supabase.auth.signUp({ email, password, options: { data: { display_name: 'Theme QA' } } });
if (signUp.error) throw signUp.error;

const weddings = [
  { style: 'modern', title: 'Modern preview', one: 'Hana', two: 'Daniel' },
  { style: 'traditional', title: 'Traditional preview', one: 'Selam', two: 'Dawit' },
  { style: 'blend', title: 'Fusion preview', one: 'Meron', two: 'Yonas' },
];

const ids = {};
for (const w of weddings) {
  const { data, error } = await supabase.rpc('create_wedding', {
    p_title: w.title,
    p_partner_one_name: w.one,
    p_partner_two_name: w.two,
    p_wedding_date: '2027-02-14',
    p_city: 'Addis Ababa',
    p_country_code: 'ET',
    p_timezone: 'Africa/Addis_Ababa',
    p_style: w.style,
    p_currency_code: 'ETB',
    p_celebration_kind: 'wedding',
    p_total_budget: 0,
    p_budget_allocations: [],
  });
  if (error) throw error;
  ids[w.style] = typeof data === 'string' ? data : (data?.id ?? data);
}

console.log(JSON.stringify({ email, password, weddings: ids }, null, 2));
