import { authStorage } from '@/lib/authStorage';

const STORAGE_KEY = 'kiburan.pending_vendor_action';
const MAX_AGE_MS = 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PendingVendorActionKind = 'inquire' | 'save';

/** A vendor action a guest started on Explore, resumed once they are signed in. */
export type PendingVendorAction = {
  kind: PendingVendorActionKind;
  vendorId: string;
  vendorName: string;
  serviceId: string | null;
  savedAt: number;
};

let memory: PendingVendorAction | null = null;

export function parsePendingVendorAction(
  raw: string | null,
  now = Date.now(),
): PendingVendorAction | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingVendorAction> | null;
    if (!parsed || (parsed.kind !== 'inquire' && parsed.kind !== 'save')) return null;
    if (typeof parsed.vendorId !== 'string' || !UUID.test(parsed.vendorId)) return null;
    if (typeof parsed.savedAt !== 'number' || now - parsed.savedAt > MAX_AGE_MS) return null;
    const serviceId =
      typeof parsed.serviceId === 'string' && UUID.test(parsed.serviceId) ? parsed.serviceId : null;
    return {
      kind: parsed.kind,
      vendorId: parsed.vendorId,
      vendorName: typeof parsed.vendorName === 'string' ? parsed.vendorName.slice(0, 120) : '',
      serviceId,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/** Keep the action across sign-in / registration / celebration setup (max 24 hours). */
export async function savePendingVendorAction(
  action: Omit<PendingVendorAction, 'savedAt'>,
): Promise<void> {
  const record: PendingVendorAction = { ...action, savedAt: Date.now() };
  memory = record;
  await authStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function loadPendingVendorAction(): Promise<PendingVendorAction | null> {
  if (memory && Date.now() - memory.savedAt <= MAX_AGE_MS) return memory;
  const record = parsePendingVendorAction(await authStorage.getItem(STORAGE_KEY));
  memory = record;
  if (!record) await authStorage.removeItem(STORAGE_KEY);
  return record;
}

/** Sync read of the last loaded or saved action. */
export function peekPendingVendorAction(): PendingVendorAction | null {
  return memory;
}

export async function clearPendingVendorAction(): Promise<void> {
  memory = null;
  await authStorage.removeItem(STORAGE_KEY);
}
