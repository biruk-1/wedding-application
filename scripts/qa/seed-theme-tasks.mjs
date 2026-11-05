/**
 * Local QA only: signs in as a QA user and adds sample tasks to their weddings so task rows,
 * progress bars and detail screens can be checked per theme.
 *
 *   node --env-file=.env scripts/qa/seed-theme-tasks.mjs <email> <password>
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const [email, password] = process.argv.slice(2);

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  throw new Error('Refusing to seed a non-local Supabase URL.');
}
if (!anonKey || !email || !password) throw new Error('Usage: seed-theme-tasks.mjs <email> <password>');

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const signIn = await supabase.auth.signInWithPassword({ email, password });
if (signIn.error) throw signIn.error;

const { data: memberships, error } = await supabase.from('wedding_members').select('wedding_id');
if (error) throw error;

const tasks = [
  { title: 'Book the reception venue', priority: 'high', status: 'done', due_date: '2026-12-01' },
  { title: 'Confirm photographer', priority: 'medium', status: 'todo', due_date: '2026-12-20' },
  { title: 'Order invitations', priority: 'urgent', status: 'todo', due_date: '2027-01-05' },
];

for (const { wedding_id } of memberships ?? []) {
  const { error: insertError } = await supabase
    .from('wedding_tasks')
    .insert(tasks.map((task) => ({ ...task, wedding_id, created_by: signIn.data.user.id })));
  if (insertError) throw insertError;
}

console.log(`Added ${tasks.length} tasks to ${memberships?.length ?? 0} weddings.`);
