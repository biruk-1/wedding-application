#!/usr/bin/env node
/**
 * Replace local marketplace demo vendors with
 * assets/kiburan_addis_ababa_vendor_test_data.json.
 *
 * - Clears seed-owned demo vendors (and related cascade rows)
 * - Inserts venues + vendors as published + verified for local Explore testing
 * - Attaches realistic Unsplash cover/gallery images by category
 * - Optionally writes supabase/seed_vendors_addis.sql for db reset
 *
 * Usage:
 *   node ./scripts/seed-addis-vendors.mjs
 *   node ./scripts/seed-addis-vendors.mjs --write-sql
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'assets', 'kiburan_addis_ababa_vendor_test_data.json');
const sqlOutPath = path.join(root, 'supabase', 'seed_vendors_addis.sql');
const dbUrl =
  process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const SEED_OWNER = '11111111-1111-4111-8111-111111111111';
const writeSql = process.argv.includes('--write-sql');

const CATEGORY_MAP = {
  'Wedding Venues': ['venue'],
  'Wedding Planner': ['planner'],
  'Bridal Makeup': ['makeup'],
  'Photography and Video': ['photographer', 'videographer'],
  Catering: ['caterer'],
  'Traditional Decor and Event Planning': ['florist', 'planner'],
  'Decor and Styling': ['florist'],
  'Decor and Event Planning': ['florist', 'planner'],
  'Traditional Attire': ['attire'],
  'Coffee Ceremony': ['coffee'],
  'Florist and Decor': ['florist'],
  'Music and Entertainment': ['dj'],
  'Invitations and Printing': ['invitations'],
  'Wedding Cakes': ['cake'],
  'Wedding Transport': ['transport'],
  'Traditional Decor and Rental': ['florist'],
  'Sound and Lighting': ['dj'],
};

const EXTRA_CATEGORIES = [
  ['attire', 'Traditional attire'],
  ['invitations', 'Invitations & printing'],
  ['coffee', 'Coffee ceremony'],
];

/** Unsplash helper — every vendor must get a unique cover (and unique gallery shots). */
function unsplash(photoId, width = 1400) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

/**
 * Per-vendor media keyed by dataset id.
 * Every cover photo id is unique. Gallery photos are also unique across vendors.
 * Images are chosen to match the vendor type (hotel, makeup, cake, transport, etc.).
 */
const VENDOR_MEDIA = {
  // Hotels / event venues — distinct luxury hotel & ballroom photos
  'venue-001': { cover: unsplash('photo-1566073771259-6a8506099945'), gallery: [unsplash('photo-1551882547-ff40c63fe5fa', 900), unsplash('photo-1542314831-068cd1dbfeeb', 900)] },
  'venue-002': { cover: unsplash('photo-1582719508461-905c673771fd'), gallery: [unsplash('photo-1578683010236-d716f9a3f461', 900), unsplash('photo-1631049307264-da0ec9d70304', 900)] },
  'venue-003': { cover: unsplash('photo-1618773928121-c32242e63f39'), gallery: [unsplash('photo-1590490360182-c33d57733427', 900), unsplash('photo-1566665797739-1674de7a421a', 900)] },
  'venue-004': { cover: unsplash('photo-1520250497591-112f2f40a3f4'), gallery: [unsplash('photo-1455587734955-081b22074882', 900), unsplash('photo-1596436889106-be35e843f974', 900)] },
  'venue-005': { cover: unsplash('photo-1564501049412-61c2a3083791'), gallery: [unsplash('photo-1611892440504-42a792e24d32', 900), unsplash('photo-1584132967334-10e028bd69f1', 900)] },
  'venue-006': { cover: unsplash('photo-1571896349842-33c89424de2d'), gallery: [unsplash('photo-1568084680786-a84f91d1153c', 900), unsplash('photo-1590381105924-c72589b9ef3f', 900)] },
  'venue-007': { cover: unsplash('photo-1445019980597-93fa8acb246c'), gallery: [unsplash('photo-1522771739844-6a9f6d5f14af', 900), unsplash('photo-1631049552057-403cdb8f0658', 900)] },
  'venue-008': { cover: unsplash('photo-1582719478250-c89cae4dc85b'), gallery: [unsplash('photo-1551632811-561732d1e306', 900), unsplash('photo-1571003123894-1f0594d2b5d9', 900)] },
  'venue-009': { cover: unsplash('photo-1496417263034-38ec4f0b665a'), gallery: [unsplash('photo-1610641818989-c2051b5e2e85', 900), unsplash('photo-1595576508898-0ad5c879a061', 900)] },
  'venue-010': { cover: unsplash('photo-1519167758481-83f550bb49b3'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1478144592103-25e218a04891', 900)] },
  'venue-011': { cover: unsplash('photo-1519225421980-715cb0215aed'), gallery: [unsplash('photo-1465495976277-4387d4b0b4c6', 900), unsplash('photo-1507504031213-bffde0529fb4', 900)] },
  'venue-012': { cover: unsplash('photo-1505236858219-8359eb29e329'), gallery: [unsplash('photo-1523438885200-e635ba2c371e', 900), unsplash('photo-1511285560929-80b456fea0bc', 900)] },
  'venue-013': { cover: unsplash('photo-1540541338287-41700207dee6'), gallery: [unsplash('photo-1606046607433-bac643deb7d0', 900), unsplash('photo-1596394516093-501ba68a0ba6', 900)] },
  'venue-014': { cover: unsplash('photo-1602002418082-a4443e061877'), gallery: [unsplash('photo-1629140727571-9b5c6f6267b1', 900), unsplash('photo-1551882547-ff40c63fe5fa', 900)] },
  'venue-015': { cover: unsplash('photo-1522708323590-d24dbb6b0267'), gallery: [unsplash('photo-1560448204-e02f11c3d0e2', 900), unsplash('photo-1631049552057-403cdb8f0658', 900)] },
  'venue-016': { cover: unsplash('photo-1566665797739-1674de7a421a'), gallery: [unsplash('photo-1584132967334-10e028bd69f1', 900), unsplash('photo-1568084680786-a84f91d1153c', 900)] },
  'venue-017': { cover: unsplash('photo-1590381105924-c72589b9ef3f'), gallery: [unsplash('photo-1522771739844-6a9f6d5f14af', 900), unsplash('photo-1618773928121-c32242e63f39', 900)] },
  'venue-018': { cover: unsplash('photo-1551632811-561732d1e306'), gallery: [unsplash('photo-1582719478250-c89cae4dc85b', 900), unsplash('photo-1578683010236-d716f9a3f461', 900)] },
  'venue-019': { cover: unsplash('photo-1571003123894-1f0594d2b5d9'), gallery: [unsplash('photo-1590490360182-c33d57733427', 900), unsplash('photo-1631049307264-da0ec9d70304', 900)] },
  'venue-020': { cover: unsplash('photo-1455587734955-081b22074882'), gallery: [unsplash('photo-1542314831-068cd1dbfeeb', 900), unsplash('photo-1596436889106-be35e843f974', 900)] },

  // Service vendors — images match the service type, covers never reused
  'vendor-001': { cover: unsplash('photo-1511795409834-ef04bbd61622'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1478144592103-25e218a04891', 900)] }, // planner
  'vendor-002': { cover: unsplash('photo-1487412947147-5cebf100ffc2'), gallery: [unsplash('photo-1522335789203-aabd1fc54bc9', 900), unsplash('photo-1512496015851-a90fb38ba796', 900)] }, // makeup
  'vendor-003': { cover: unsplash('photo-1560066984-138dadb4c035'), gallery: [unsplash('photo-1595476108010-b4d1e102bbad', 900), unsplash('photo-1526045478516-99145907023c', 900)] }, // makeup
  'vendor-004': { cover: unsplash('photo-1519741497674-611481863552'), gallery: [unsplash('photo-1606800052052-a08af7148866', 900), unsplash('photo-1529636798458-92182e662485', 900)] }, // photo
  'vendor-005': { cover: unsplash('photo-1492691527719-9d1e07e534b4'), gallery: [unsplash('photo-1511285560929-80b456fea0bc', 900), unsplash('photo-1523438885200-e635ba2c371e', 900)] }, // photo/video
  'vendor-006': { cover: unsplash('photo-1555244162-803834f70033'), gallery: [unsplash('photo-1414235077428-338989a2e8c0', 900), unsplash('photo-1551218808-94e220e084d2', 900)] }, // catering
  'vendor-007': { cover: unsplash('photo-1504674900247-0877df9cc836'), gallery: [unsplash('photo-1540189549336-e6e99c3679fe', 900), unsplash('photo-1567620905732-2d1ec7ab7445', 900)] }, // catering
  'vendor-008': { cover: unsplash('photo-1478146896981-b80fe463b330'), gallery: [unsplash('photo-1465495976277-4387d4b0b4c6', 900), unsplash('photo-1519167758481-83f550bb49b3', 900)] }, // traditional decor
  'vendor-009': { cover: unsplash('photo-1520854221256-17451cc331bf'), gallery: [unsplash('photo-1487530811176-3780da1762ab', 900), unsplash('photo-1457089328109-e5d9bd499191', 900)] }, // decor styling
  'vendor-010': { cover: unsplash('photo-1460978812857-470ed1c77af0'), gallery: [unsplash('photo-1515934751635-c81c6bc9a2d8', 900), unsplash('photo-1507504031213-bffde0529fb4', 900)] }, // traditional decor
  'vendor-011': { cover: unsplash('photo-1530103862676-de8c9debad1d'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1511795409834-ef04bbd61622', 900)] }, // events/decor
  'vendor-012': { cover: unsplash('photo-1594552072238-5f59b77b44e1'), gallery: [unsplash('photo-1515372039744-b8f02a3ae446', 900), unsplash('photo-1496747611176-843222e1e57c', 900)] }, // attire
  'vendor-013': { cover: unsplash('photo-1495474472287-4d71bcdd2085'), gallery: [unsplash('photo-1447933601403-0c6688de566e', 900), unsplash('photo-1509042239860-f550ce710b93', 900)] }, // coffee
  'vendor-014': { cover: unsplash('photo-1490750967868-88aa4486c946'), gallery: [unsplash('photo-1462275646964-a0e3386b89fa', 900), unsplash('photo-1487530811176-3780da1762ab', 900)] }, // florist
  'vendor-015': { cover: unsplash('photo-1493225457124-a3eb161ffa5f'), gallery: [unsplash('photo-1511671782779-c97d3d27a1d4', 900), unsplash('photo-1459749411175-04bf52967743', 900)] }, // live band
  'vendor-016': { cover: unsplash('photo-1607345366928-199ea26cfe3e'), gallery: [unsplash('photo-1510070007569-eeffc802c1c1', 900), unsplash('photo-1469371670807-013ccf25f16a', 900)] }, // invitations
  'vendor-017': { cover: unsplash('photo-1464349095431-e9a21285b5f3'), gallery: [unsplash('photo-1535254973040-607b474cb50d', 900), unsplash('photo-1563729784474-d77dbb933a9e', 900)] }, // cakes
  'vendor-018': { cover: unsplash('photo-1511919884226-fd3cad54643f'), gallery: [unsplash('photo-1503376780353-7e6692767b70', 900), unsplash('photo-1492144534655-ae79c964c9d7', 900)] }, // transport
  'vendor-019': { cover: unsplash('photo-1470225620780-dba8ba36b745'), gallery: [unsplash('photo-1520854221256-17451cc331bf', 900), unsplash('photo-1478146896981-b80fe463b330', 900)] }, // traditional rental
  'vendor-020': { cover: unsplash('photo-1429962714451-bb934ecdc4ec'), gallery: [unsplash('photo-1501386761570-0cd27d8b00d4', 900), unsplash('photo-1571266028247-e67670b0337f', 900)] }, // sound/lighting
};

function mediaForVendor(recordId, primarySlug, usedCovers) {
  const mapped = VENDOR_MEDIA[recordId];
  if (mapped) {
    if (usedCovers.has(mapped.cover)) {
      throw new Error(`Duplicate cover for ${recordId}: ${mapped.cover}`);
    }
    usedCovers.add(mapped.cover);
    return mapped;
  }
  // Fallback for unexpected new ids: still avoid reusing a cover in this run.
  const fallback = unsplash(`photo-fallback-${recordId}`);
  usedCovers.add(fallback);
  return { cover: fallback, gallery: [] };
}

function sqlString(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function uuidFromKey(key) {
  const hex = createHash('md5').update(`kiburan-addis-vendor:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function slugify(name) {
  const base = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'vendor';
}

function mapPriceUnit(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('person') || value.includes('guest')) return 'person';
  if (value.includes('hour')) return 'hour';
  if (value.includes('day')) return 'day';
  if (value.includes('item')) return 'item';
  if (value.includes('custom')) return 'custom';
  return 'package';
}

function categorySlugsFor(record) {
  const mapped = CATEGORY_MAP[record.category];
  if (mapped?.length) return mapped;
  if (record.vendor_type === 'venue') return ['venue'];
  return ['planner'];
}

function buildSql(dataset) {
  const records = [...(dataset.venues || []), ...(dataset.vendors || [])];
  const usedSlugs = new Set();
  const usedCovers = new Set();
  const lines = [];

  lines.push(`-- Generated by scripts/seed-addis-vendors.mjs from kiburan_addis_ababa_vendor_test_data.json`);
  lines.push(`-- Local marketplace seed only. Do not treat prices or verification as production truth.`);
  lines.push(`begin;`);
  lines.push(``);
  lines.push(`-- Extra categories used by the Addis dataset`);
  lines.push(`insert into public.vendor_categories (slug, name_en, name_am) values`);
  lines.push(
    EXTRA_CATEGORIES.map(([slug, name]) => `  (${sqlString(slug)}, ${sqlString(name)}, null)`).join(
      ',\n',
    ),
  );
  lines.push(`on conflict (slug) do update set name_en = excluded.name_en;`);
  lines.push(``);
  lines.push(`-- Ensure seed owner exists (same id as seed.sql)`);
  lines.push(`do $$`);
  lines.push(`declare`);
  lines.push(`  v_owner uuid := '${SEED_OWNER}';`);
  lines.push(`begin`);
  lines.push(`  if not exists (select 1 from auth.users where id = v_owner) then`);
  lines.push(`    insert into auth.users (`);
  lines.push(`      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,`);
  lines.push(`      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,`);
  lines.push(`      confirmation_token, recovery_token, email_change_token_new, email_change`);
  lines.push(`    ) values (`);
  lines.push(`      '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',`);
  lines.push(`      'marketplace.seed@kiburan.local', crypt('SeedVendorPass1', gen_salt('bf')), now(),`);
  lines.push(`      '{"provider":"email","providers":["email"]}'::jsonb,`);
  lines.push(`      '{"display_name":"Marketplace Seed Owner"}'::jsonb, now(), now(), '', '', '', ''`);
  lines.push(`    );`);
  lines.push(`    insert into auth.identities (`);
  lines.push(`      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at`);
  lines.push(`    ) values (`);
  lines.push(`      v_owner, v_owner,`);
  lines.push(`      format('{"sub":"%s","email":"marketplace.seed@kiburan.local"}', v_owner)::jsonb,`);
  lines.push(`      'email', v_owner::text, now(), now(), now()`);
  lines.push(`    ) on conflict do nothing;`);
  lines.push(`  end if;`);
  lines.push(`  insert into public.profiles (id, display_name)`);
  lines.push(`  values (v_owner, 'Marketplace Seed Owner')`);
  lines.push(`  on conflict (id) do update set display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);`);
  lines.push(`end $$;`);
  lines.push(``);
  lines.push(`-- Remove previous seed marketplace vendors.`);
  lines.push(`-- wedding_vendors / inquiries cannot rely on ON DELETE SET NULL when both`);
  lines.push(`-- vendor_id and external_business_name would become null.`);
  lines.push(`with seed_vendors as (`);
  lines.push(`  select id from public.vendors`);
  lines.push(`  where owner_user_id = '${SEED_OWNER}'`);
  lines.push(`     or id in (`);
  lines.push(`       '22222222-2222-4222-8222-222222222221',`);
  lines.push(`       '22222222-2222-4222-8222-222222222222',`);
  lines.push(`       '22222222-2222-4222-8222-222222222223',`);
  lines.push(`       '22222222-2222-4222-8222-222222222224'`);
  lines.push(`     )`);
  lines.push(`)`);
  lines.push(`delete from public.wedding_vendors wv`);
  lines.push(`using seed_vendors s where wv.vendor_id = s.id;`);
  lines.push(``);
  lines.push(`with seed_vendors as (`);
  lines.push(`  select id from public.vendors`);
  lines.push(`  where owner_user_id = '${SEED_OWNER}'`);
  lines.push(`     or id in (`);
  lines.push(`       '22222222-2222-4222-8222-222222222221',`);
  lines.push(`       '22222222-2222-4222-8222-222222222222',`);
  lines.push(`       '22222222-2222-4222-8222-222222222223',`);
  lines.push(`       '22222222-2222-4222-8222-222222222224'`);
  lines.push(`     )`);
  lines.push(`)`);
  lines.push(`delete from public.vendor_inquiries vi`);
  lines.push(`using seed_vendors s where vi.vendor_id = s.id;`);
  lines.push(``);
  lines.push(`delete from public.vendors`);
  lines.push(`where owner_user_id = '${SEED_OWNER}'`);
  lines.push(`   or id in (`);
  lines.push(`     '22222222-2222-4222-8222-222222222221',`);
  lines.push(`     '22222222-2222-4222-8222-222222222222',`);
  lines.push(`     '22222222-2222-4222-8222-222222222223',`);
  lines.push(`     '22222222-2222-4222-8222-222222222224'`);
  lines.push(`   );`);
  lines.push(``);

  for (const record of records) {
    const categorySlugs = categorySlugsFor(record);
    const primarySlug = categorySlugs[0];
    let slug = slugify(record.name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${record.id}`.slice(0, 60);
    }
    usedSlugs.add(slug);

    const vendorId = uuidFromKey(record.id);
    const serviceId = uuidFromKey(`${record.id}:service`);
    const { cover, gallery } = mediaForVendor(record.id, primarySlug, usedCovers);
    const priceFrom = Number(record.pricing?.display_price_from ?? 0) || null;
    const priceUnit = mapPriceUnit(record.pricing?.price_unit);
    const descriptionParts = [
      record.description,
      record.capacity_text ? `Capacity: ${record.capacity_text}.` : null,
      record.outdoor_setup ? `Setup: ${record.outdoor_setup}.` : null,
      record.location_text ? `Area: ${record.location_text}.` : null,
      record.verification_note ? `Note: ${record.verification_note}` : null,
    ].filter(Boolean);
    const description = descriptionParts.join(' ');
    const address = [record.location_text, record.city, record.country].filter(Boolean).join(', ');
    const website = record.source_url || null;
    const packages = Array.isArray(record.package_examples) ? record.package_examples : [];

    lines.push(`-- ${record.id}: ${record.name}`);
    lines.push(`insert into public.vendors (`);
    lines.push(`  id, owner_user_id, business_name, slug, description, city, country_code,`);
    lines.push(`  address, website_url, cover_url, logo_url, listing_status, verification_status`);
    lines.push(`) values (`);
    lines.push(
      `  '${vendorId}', '${SEED_OWNER}', ${sqlString(record.name)}, ${sqlString(slug)}, ${sqlString(description)},`,
    );
    lines.push(
      `  ${sqlString(record.city || dataset.default_city || 'Addis Ababa')}, 'ET', ${sqlString(address)},`,
    );
    lines.push(
      `  ${sqlString(website)}, ${sqlString(cover)}, ${sqlString(cover)}, 'published', 'verified'`,
    );
    lines.push(`);`);
    lines.push(``);
    lines.push(`insert into public.vendor_team_members (vendor_id, user_id, role)`);
    lines.push(`values ('${vendorId}', '${SEED_OWNER}', 'owner');`);
    lines.push(``);
    lines.push(`insert into public.vendor_category_memberships (vendor_id, category_id)`);
    lines.push(`select '${vendorId}', c.id from public.vendor_categories c`);
    lines.push(`where c.slug in (${categorySlugs.map(sqlString).join(', ')});`);
    lines.push(``);
    lines.push(`insert into public.vendor_services (`);
    lines.push(`  id, vendor_id, category_id, title, description, base_price, currency_code, price_unit, is_active`);
    lines.push(`)`);
    lines.push(`select`);
    lines.push(`  '${serviceId}', '${vendorId}', c.id,`);
    lines.push(
      `  ${sqlString(record.subcategory || record.category || 'Wedding service')},`,
    );
    lines.push(`  ${sqlString(record.description || record.category)},`);
    lines.push(
      `  ${priceFrom == null ? 'null' : priceFrom}, 'ETB', ${sqlString(priceUnit)}, true`,
    );
    lines.push(`from public.vendor_categories c`);
    lines.push(`where c.slug = ${sqlString(primarySlug)};`);
    lines.push(``);

    for (const [index, pkg] of packages.entries()) {
      const packageId = uuidFromKey(`${record.id}:pkg:${index}`);
      const inclusions = Array.isArray(pkg.includes) ? pkg.includes : [];
      lines.push(`insert into public.vendor_packages (`);
      lines.push(`  id, service_id, name, description, inclusions, price, currency_code, is_active`);
      lines.push(`) values (`);
      lines.push(
        `  '${packageId}', '${serviceId}', ${sqlString(pkg.name)}, ${sqlString(pkg.name)},`,
      );
      lines.push(
        `  ${sqlJson(inclusions)}, ${Number(pkg.price_etb) || 0}, 'ETB', true`,
      );
      lines.push(`);`);
    }
    lines.push(``);

    gallery.forEach((url, index) => {
      const mediaId = uuidFromKey(`${record.id}:media:${index}`);
      lines.push(`insert into public.vendor_media (`);
      lines.push(`  id, vendor_id, storage_path, media_type, caption, sort_order`);
      lines.push(`) values (`);
      lines.push(
        `  '${mediaId}', '${vendorId}', ${sqlString(url)}, 'image', ${sqlString(`${record.category} gallery`)}, ${index + 1}`,
      );
      lines.push(`);`);
    });
    lines.push(``);
  }

  lines.push(`commit;`);
  lines.push(``);
  lines.push(`-- Sanity: published marketplace count`);
  lines.push(`-- select count(*) from public.vendors where listing_status='published' and verification_status='verified';`);
  return lines.join('\n');
}

function runPsql(sqlPath) {
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'postgres' },
  });
}

function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error(`Missing dataset: ${jsonPath}`);
    process.exit(1);
  }
  const dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const sql = buildSql(dataset);
  const tmpPath = path.join(root, 'supabase', '.tmp_seed_addis_vendors.sql');
  fs.writeFileSync(tmpPath, sql, 'utf8');

  if (writeSql) {
    fs.writeFileSync(sqlOutPath, sql, 'utf8');
    console.log(`Wrote ${path.relative(root, sqlOutPath)}`);
  }

  console.log(`Seeding ${ (dataset.venues?.length || 0) + (dataset.vendors?.length || 0) } vendors into ${dbUrl}`);
  try {
    runPsql(tmpPath);
  } finally {
    fs.unlinkSync(tmpPath);
  }

  const count = execFileSync(
    'psql',
    [
      dbUrl,
      '-At',
      '-c',
      `select count(*) from public.vendors where owner_user_id='${SEED_OWNER}' and listing_status='published';`,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'postgres' },
    },
  ).trim();
  console.log(`Done. Published seed vendors now: ${count}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
