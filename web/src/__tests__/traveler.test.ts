import { describe, it, expect } from 'vitest';
import { FILE_KIND_LABELS } from '../api/files';
import type { FileKind } from '../api/files';

describe('file kind labels', () => {
  it('all file kinds have labels', () => {
    const kinds: FileKind[] = ['BLUEPRINT', 'SETUP_PHOTO', 'JOB_PHOTO'];
    for (const kind of kinds) {
      expect(FILE_KIND_LABELS[kind]).toBeTruthy();
    }
  });

  it('BLUEPRINT label is correct', () => {
    expect(FILE_KIND_LABELS['BLUEPRINT']).toBe('Blueprint');
  });
});

describe('file size formatter', () => {
  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  it('formats bytes correctly', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});
