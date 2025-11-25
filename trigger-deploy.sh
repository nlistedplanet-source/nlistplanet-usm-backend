#!/bin/bash
# Render Deploy Hook Trigger Script
# Usage: ./trigger-deploy.sh

# Add your Render Deploy Hook URL here
DEPLOY_HOOK_URL="YOUR_DEPLOY_HOOK_URL_HERE"

echo "🚀 Triggering Render deployment..."
curl -X POST "$DEPLOY_HOOK_URL"

if [ $? -eq 0 ]; then
    echo "✅ Deployment triggered successfully!"
    echo "Check Render dashboard for deployment progress"
else
    echo "❌ Failed to trigger deployment"
    exit 1
fi
