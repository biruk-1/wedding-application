import { authStorage } from '@/lib/authStorage';

const STORAGE_KEY = 'kiburan.pending_team_invite';
const MAX_AGE_MS = 24 * 60 * 60_000;

type PendingInviteRecord = {
  token: string;
  savedAt: number;
};

let memoryToken: string | null = null;

function parseRecord(raw: string | null): PendingInviteRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingInviteRecord;
    if (!parsed || typeof parsed.token !== 'string' || typeof parsed.savedAt !== 'number') {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (!parsed.token.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Keep a Planning Team invite token across sign-in / register (max 24 hours). */
export async function savePendingTeamInvite(token: string): Promise<void> {
  const cleaned = token.trim();
  if (!cleaned) return;
  memoryToken = cleaned;
  const record: PendingInviteRecord = { token: cleaned, savedAt: Date.now() };
  await authStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function loadPendingTeamInvite(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  const record = parseRecord(await authStorage.getItem(STORAGE_KEY));
  if (!record) {
    memoryToken = null;
    await authStorage.removeItem(STORAGE_KEY);
    return null;
  }
  memoryToken = record.token;
  return record.token;
}

/** Sync peek used by the auth gate after an async hydrate. */
export function peekPendingTeamInvite(): string | null {
  return memoryToken;
}

export async function clearPendingTeamInvite(): Promise<void> {
  memoryToken = null;
  await authStorage.removeItem(STORAGE_KEY);
}

export async function hydratePendingTeamInvite(): Promise<string | null> {
  return loadPendingTeamInvite();
}
