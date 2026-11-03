/**
 * Measures the Supabase request waterfalls behind Kiburan's main flows against LOCAL Supabase.
 *
 *   node scripts/perf/measure-data-flows.mjs [runs]
 *
 * "legacy" replays the request pattern the screens used before the performance pass
 * (sequential auth.getUser() round-trips, re-fetching data already loaded, N+1 vendor queries).
 * "current" replays the pattern the screens use now (cached reads, embedded selects, parallel rounds).
 * Each flow reports request count, sequential rounds, and wall time. Numbers are localhost-only;
 * a phone on Wi-Fi adds its own per-round latency, which makes round count the number that matters.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../../.env', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // .env optional; defaults below target the local stack.
  }
}

loadEnv();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!anon) {
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY missing (.env)');
  process.exit(1);
}
const runs = Number(process.argv[2] ?? 5);

let requestCount = 0;
let pendingBodies = [];
const countingFetch = async (input, init) => {
  requestCount += 1;
  const response = await fetch(input, init);
  // Body size is read from a clone after the flow's timer stops, so it does not skew timings.
  pendingBodies.push(
    response
      .clone()
      .arrayBuffer()
      .then((body) => body.byteLength)
      .catch(() => 0),
  );
  return response;
};

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: countingFetch },
});

const email = `perf.${Date.now()}@example.com`;
const password = 'PerfPass1';

async function must(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}

async function setup() {
  await must(supabase.auth.signUp({ email, password, options: { data: { display_name: 'Perf' } } }));
  const wedding = await must(
    supabase.rpc('create_wedding', {
      p_title: 'Perf wedding',
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
      p_wedding_date: '2027-05-01',
    }),
  );
  const categories = await must(supabase.from('task_categories').select('id').limit(5));
  const rows = Array.from({ length: 40 }, (_, i) => ({
    wedding_id: wedding.id,
    title: `Task ${i + 1}`,
    status: i % 3 === 0 ? 'done' : 'todo',
    priority: 'medium',
    category_id: categories[i % categories.length]?.id ?? null,
    due_date: `2027-0${(i % 4) + 1}-1${i % 9}`,
  }));
  await must(supabase.from('wedding_tasks').insert(rows));
  const vendor = await must(
    supabase.from('vendors').select('id').eq('listing_status', 'published').limit(1).maybeSingle(),
  );
  await supabase.auth.signOut();
  return { weddingId: wedding.id, vendorId: vendor?.id ?? null };
}

const LEGACY_TASK_SELECT = `*, category:task_categories ( id, slug, name_en, icon ),
  assignees:task_assignees ( user_id, assigned_at, profile:profiles ( id, display_name ) )`;

// Mirrors src/features/checklist/services/checklistSelects.ts
const TASK_SELECT = `id, wedding_id, title, description, category_id, due_date, priority, status, sort_order,
  template_id, created_by, created_at, updated_at, completed_at, event_id, parent_task_id,
  category:task_categories ( id, slug, name_en, icon ),
  assignees:task_assignees ( user_id, assigned_at, profile:profiles ( id, display_name ) )`;

const CATEGORY_EMBED = 'categories:vendor_category_memberships ( category:vendor_categories ( id, slug, name_en ) )';

// Shared across runs of the warm-cache flow, like the app's single QueryClient.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const CHECKLIST_STALE_MS = 30_000;

function checklistQueries(ctx) {
  return [
    {
      queryKey: ['u', 'perf', 'wedding', ctx.weddingId, 'tasks'],
      queryFn: () => must(supabase.from('wedding_tasks').select(TASK_SELECT).eq('wedding_id', ctx.weddingId)),
    },
    {
      queryKey: ['u', 'perf', 'ref', 'task-categories'],
      queryFn: () =>
        must(supabase.from('task_categories').select('id, slug, name_en, name_am, icon, sort_order, is_active').eq('is_active', true)),
    },
    {
      queryKey: ['u', 'perf', 'ref', 'template-count'],
      queryFn: () =>
        must(supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('is_active', true)),
    },
  ];
}

const flows = {
  async 'login → dashboard (legacy)'(ctx) {
    await must(supabase.auth.signInWithPassword({ email, password })); // round 1
    const user = await must(supabase.auth.getUser()); // round 2
    await must(
      supabase
        .from('wedding_members')
        .select('wedding_id, role, joined_at, wedding:weddings (*)')
        .eq('user_id', user.user.id),
    ); // round 3
    await must(supabase.from('weddings').select('*').eq('id', ctx.weddingId).maybeSingle()); // round 4
    return 4;
  },
  async 'login → dashboard (current)'() {
    const session = await must(supabase.auth.signInWithPassword({ email, password })); // round 1
    await must(
      supabase
        .from('wedding_members')
        .select('wedding_id, role, joined_at, wedding:weddings (*)')
        .eq('user_id', session.user.id),
    ); // round 2 — dashboard reads the wedding from this cached result
    return 2;
  },
  async 'open checklist (legacy)'(ctx) {
    const user = await must(supabase.auth.getUser()); // round 1 (evaluated before Promise.all)
    await Promise.all([
      must(supabase.from('weddings').select('*').eq('id', ctx.weddingId).maybeSingle()),
      must(supabase.from('checklist_templates').select('*').eq('is_active', true)),
      must(
        supabase
          .from('wedding_members')
          .select('role')
          .eq('wedding_id', ctx.weddingId)
          .eq('user_id', user.user.id)
          .maybeSingle(),
      ),
      must(supabase.from('wedding_tasks').select(LEGACY_TASK_SELECT).eq('wedding_id', ctx.weddingId)),
      must(supabase.from('task_categories').select('*').eq('is_active', true)),
    ]); // round 2
    return 2;
  },
  async 'open checklist (current, cold cache)'(ctx) {
    await Promise.all(checklistQueries(ctx).map((query) => query.queryFn())); // round 1 — wedding + role come from the memberships cache
    return 1;
  },
  async 'reopen checklist (current, warm cache)'(ctx) {
    await Promise.all(
      checklistQueries(ctx).map((q) => queryClient.fetchQuery({ ...q, staleTime: CHECKLIST_STALE_MS })),
    ); // served from cache while fresh
    return 0;
  },
  async 'open marketplace (legacy)'() {
    const vendors = await must(
      supabase
        .from('vendors')
        .select('*, memberships:vendor_category_memberships ( category:vendor_categories ( id, slug, name_en ) )')
        .eq('listing_status', 'published')
        .eq('verification_status', 'verified'),
    ); // round 1 (categories in parallel)
    await must(
      supabase
        .from('vendor_services')
        .select('vendor_id, base_price, currency_code, price_unit, is_active')
        .in(
          'vendor_id',
          vendors.map((v) => v.id),
        ),
    ); // round 2
    return 2;
  },
  async 'open marketplace (current)'() {
    // Mirrors fetchVendorPage / fetchVendorCities / listVendorCategories.
    await Promise.all([
      must(
        supabase
          .from('vendors')
          .select(
            `id, slug, business_name, city, country_code, cover_url, logo_url, ${CATEGORY_EMBED}, services:vendor_services ( base_price, currency_code, price_unit )`,
          )
          .eq('listing_status', 'published')
          .eq('verification_status', 'verified')
          .eq('services.is_active', true)
          .order('business_name')
          .order('id')
          .range(0, 20),
      ),
      must(supabase.from('vendor_categories').select('id, slug, name_en').order('name_en')),
      must(
        supabase
          .from('vendors')
          .select('city')
          .eq('listing_status', 'published')
          .eq('verification_status', 'verified')
          .not('city', 'is', null),
      ),
    ]); // round 1
    return 1;
  },
  async 'open vendor profile (legacy)'(ctx) {
    if (!ctx.vendorId) return 0;
    const [vendor] = await Promise.all([
      must(supabase.from('vendors').select('*, memberships:vendor_category_memberships ( category:vendor_categories ( id, slug, name_en ) )').eq('id', ctx.vendorId).maybeSingle()),
      must(supabase.from('wedding_vendors').select('*').eq('wedding_id', ctx.weddingId).eq('vendor_id', ctx.vendorId).maybeSingle()),
      (async () => {
        const user = await must(supabase.auth.getUser());
        return must(supabase.from('wedding_members').select('role').eq('wedding_id', ctx.weddingId).eq('user_id', user.user.id).maybeSingle());
      })(),
    ]); // rounds 1–2
    const [services] = await Promise.all([
      must(supabase.from('vendor_services').select('*').eq('vendor_id', vendor.id).eq('is_active', true)),
      must(supabase.from('vendor_media').select('*').eq('vendor_id', vendor.id)),
      must(supabase.from('vendor_availability').select('*').eq('vendor_id', vendor.id)),
      must(supabase.from('vendor_reviews').select('*, reviewer:profiles ( display_name )').eq('vendor_id', vendor.id).eq('status', 'published')),
    ]); // round 3
    await must(supabase.from('vendor_packages').select('*').in('service_id', services.map((s) => s.id))); // round 4
    return 4;
  },
  async 'open vendor profile (current)'(ctx) {
    if (!ctx.vendorId) return 0;
    await Promise.all([
      must(
        supabase
          .from('vendors')
          .select(
            `id, slug, business_name, description, city, country_code, website_url, cover_url, logo_url, ${CATEGORY_EMBED}, services:vendor_services ( id, title, description, base_price, currency_code, price_unit, created_at, packages:vendor_packages ( id, name, description, inclusions, price, currency_code ) )`,
          )
          .eq('id', ctx.vendorId)
          .eq('services.is_active', true)
          .eq('services.packages.is_active', true)
          .order('created_at', { referencedTable: 'services', ascending: true })
          .maybeSingle(),
      ),
      must(supabase.from('vendor_media').select('id, storage_path, media_type, caption, sort_order').eq('vendor_id', ctx.vendorId).order('sort_order')),
      must(supabase.from('vendor_availability').select('id, starts_at, ends_at, status').eq('vendor_id', ctx.vendorId).gte('ends_at', new Date().toISOString()).order('starts_at').limit(12)),
      must(supabase.from('vendor_reviews').select('id, rating, comment, created_at, reviewer:profiles ( display_name )').eq('vendor_id', ctx.vendorId).eq('status', 'published').order('created_at', { ascending: false }).limit(20)),
      must(supabase.from('wedding_vendors').select('id, status').eq('wedding_id', ctx.weddingId).eq('vendor_id', ctx.vendorId).maybeSingle()),
    ]); // round 1 — role comes from the memberships cache
    return 1;
  },
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function main() {
  const ctx = await setup();
  console.log(`Local Supabase: ${url}  runs per flow: ${runs}  vendor seeded: ${Boolean(ctx.vendorId)}\n`);
  for (const [name, flow] of Object.entries(flows)) {
    const timings = [];
    let requests = 0;
    let rounds = 0;
    let bytes = 0;
    for (let i = 0; i < runs; i += 1) {
      if (!name.startsWith('login')) {
        await supabase.auth.signInWithPassword({ email, password });
      } else {
        await supabase.auth.signOut();
      }
      if (name.includes('warm cache') && i === 0) {
        // The first visit (cold) is measured by the flow above; prime the cache untimed.
        await Promise.all(
          checklistQueries(ctx).map((q) => queryClient.fetchQuery({ ...q, staleTime: CHECKLIST_STALE_MS })),
        );
      }
      requestCount = 0;
      pendingBodies = [];
      const start = performance.now();
      rounds = await flow(ctx);
      timings.push(performance.now() - start);
      requests = requestCount;
      bytes = (await Promise.all(pendingBodies)).reduce((sum, size) => sum + size, 0);
    }
    console.log(
      `${name.padEnd(42)} requests=${String(requests).padStart(2)}  rounds=${rounds}  body=${String((bytes / 1024).toFixed(1)).padStart(5)}KB  median=${median(timings).toFixed(1)}ms  min=${Math.min(...timings).toFixed(1)}ms`,
    );
  }
  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
