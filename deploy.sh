#!/bin/bash

# Force deployment to use deploy directory
echo "Creating deployment configuration..."

# Create wrangler.jsonc that forces deploy directory
cat > wrangler.jsonc << 'EOF'
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "denrpermit",
  "compatibility_date": "2026-05-02",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "deploy"
  },
  "compatibility_flags": [
    "nodejs_compat"
  ]
}
EOF

echo "Configuration created. Deploying from deploy directory..."
npx wrangler deploy --config wrangler.jsonc
