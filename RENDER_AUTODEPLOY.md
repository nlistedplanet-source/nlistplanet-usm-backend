# Render Auto-Deploy Configuration

## Current Setup
- Service: nlistplanet-usm-api
- Region: Oregon (Free tier)
- Build: `npm ci --only=production --ignore-scripts`
- Start: `node server-fast.js`
- Branch: main
- Auto-deploy: Should be enabled

## How to Enable Auto-Deploy on Render

### Step 1: Check Dashboard Settings
1. Go to: https://dashboard.render.com
2. Select service: **nlistplanet-usm-api**
3. Go to **Settings** tab
4. Scroll to **Build & Deploy** section
5. Check **Auto-Deploy** is set to **Yes**
6. Verify **Branch** is set to **main** (not master)

### Step 2: Verify GitHub Connection
1. In Settings, check **GitHub Repository**
2. Should be: `nlistedplanet-source/nlistplanet-usm-backend`
3. If disconnected, click **Connect Repository**

### Step 3: Check Deploy Hooks
1. Go to **Settings** → **Deploy Hook**
2. If empty, Render will create webhook automatically
3. Verify GitHub webhook exists:
   - Go to GitHub repo: https://github.com/nlistedplanet-source/nlistplanet-usm-backend
   - Settings → Webhooks
   - Should see Render webhook URL

### Step 4: Test Auto-Deploy
After enabling, any push to `main` branch should trigger automatic deployment.

## Manual Deploy (Current Workaround)
Until auto-deploy is fixed:
1. Render Dashboard → Select service
2. Click **Manual Deploy** button
3. Select **Deploy latest commit**
4. Wait 2-3 minutes

## Deployment History
- Last manual deploy: 2024 (commit 6f55f15)
- Auto-deploy status: Currently disabled/not working
