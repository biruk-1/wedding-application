import { describe, expect, it } from 'vitest';

import {
  buildDocumentStoragePath,
  documentKindFromName,
  formatBytes,
  sanitizeFileName,
} from '@/features/documents/utils/fileHelpers';

describe('sanitizeFileName', () => {
  it('strips path separators and limits length', () => {
    expect(sanitizeFileName('a/b\\c:d.pdf')).toBe('a_b_c_d.pdf');
    expect(sanitizeFileName('  contract.pdf  ')).toBe('contract.pdf');
  });
});

describe('documentKindFromName', () => {
  it('maps common extensions', () => {
    expect(documentKindFromName('a.PDF')).toBe('pdf');
    expect(documentKindFromName('photo.JPEG')).toBe('image');
    expect(documentKindFromName('sheet.xlsx')).toBe('sheet');
    expect(documentKindFromName('notes')).toBe('other');
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(null)).toBeNull();
  });
});

describe('buildDocumentStoragePath', () => {
  it('nests under wedding and file ids', () => {
    expect(buildDocumentStoragePath('w1', 'f1', 'Venue agreement.pdf')).toBe(
      'w1/f1/Venue agreement.pdf',
    );
  });
});
