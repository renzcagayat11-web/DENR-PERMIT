#!/usr/bin/env node

// Fix deployment configuration to use deploy directory
const fs = require('fs');
const path = require('path');

// Create the correct wrangler.jsonc if it doesn't exist or is incorrect
const configPath = path.join(__dirname, 'wrangler.jsonc');
const config = {
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "denrpermit",
  "compatibility_date": "2026-05-02",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "public"
  },
  "compatibility_flags": [
    "nodejs_compat"
  ]
};

// Write the configuration file
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Configuration updated to use public directory');
