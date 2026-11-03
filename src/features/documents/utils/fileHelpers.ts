import type { DocumentKind } from '@/features/documents/types';

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ');
  return trimmed.slice(0, 180) || 'document';
}

export function extensionOf(name: string): string {
  const parts = name.toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1] ?? '';
}

export function documentKindFromName(name: string): DocumentKind {
  const ext = extensionOf(name);
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['txt', 'md'].includes(ext)) return 'text';
  return 'other';
}

export function kindLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'Image';
    case 'sheet':
      return 'Spreadsheet';
    case 'doc':
      return 'Document';
    case 'text':
      return 'Text';
    default:
      return 'File';
  }
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Storage object path: weddingId / fileId / sanitizedName */
export function buildDocumentStoragePath(
  weddingId: string,
  fileId: string,
  displayName: string,
): string {
  return `${weddingId}/${fileId}/${sanitizeFileName(displayName)}`;
}
