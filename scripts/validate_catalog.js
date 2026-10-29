#!/usr/bin/env node
/**
 * Static catalog validator for Prople Store starter data
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFilePath = path.resolve(__dirname, '../src/data.ts');

try {
  const content = readFileSync(dataFilePath, 'utf8');
  
  const requiredTokens = ['appCategories', 'trendingSearches', 'appDetailsMock'];
  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      console.error(`❌ Missing expected export '${token}' in src/data.ts`);
      process.exit(1);
    }
  }

  console.log('✅ Catalog sanity check passed: src/data.ts exports are valid.');
  process.exit(0);
} catch (err) {
  console.error('❌ Error reading catalog file:', err.message);
  process.exit(1);
}
