# Render Deploy Hook Trigger Script (PowerShell)
# Usage: .\trigger-deploy.ps1

# Add your Render Deploy Hook URL here
$DEPLOY_HOOK_URL = "YOUR_DEPLOY_HOOK_URL_HERE"

Write-Host "🚀 Triggering Render deployment..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $DEPLOY_HOOK_URL -Method POST -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Deployment triggered successfully!" -ForegroundColor Green
        Write-Host "Check Render dashboard for deployment progress" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ Unexpected status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to trigger deployment: $_" -ForegroundColor Red
    exit 1
}
