import path from 'node:path';

// Use process.cwd() to consistently get the project root
export const PUBLIC_DIR = path.join(process.cwd(), 'public');
