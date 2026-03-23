import { describe, it, expect } from 'vitest';
import { PUBLIC_DIR } from './paths.js';
import * as path from 'path';
import * as fs from 'fs';

describe('Path Constants', () => {
  it('should export an absolute path for PUBLIC_DIR', () => {
    // Check if the path is absolute (starts from root)
    expect(path.isAbsolute(PUBLIC_DIR)).toBe(true);
  });

  it('should end with the "public" folder', () => {
    // Verify the final segment of the path is 'public'
    expect(PUBLIC_DIR.endsWith('public')).toBe(true);
  });

  it('should point to a directory that exists in the filesystem', () => {
    // This ensures your '../..' logic is actually reaching the real folder
    const exists = fs.existsSync(PUBLIC_DIR);
    expect(exists).toBe(true);
  });
});
