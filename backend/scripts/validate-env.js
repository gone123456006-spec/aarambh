/**
 * Run before deploy / start: node scripts/validate-env.js
 * Loads .env from backend root when present (local only; Render injects env in dashboard).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { validateEnv } = require('../src/config/env');

validateEnv();
console.log('[validate-env] All required environment variables are set.');
