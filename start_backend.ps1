# Start FlowForge Backend Server
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting FlowForge Tenant Node Platform Backend (8001)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$pyCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pyCmd = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pyCmd = "python"
} else {
    Write-Error "[ERROR] Python was not found in your PATH."
    exit 1
}

Write-Host "Using Python launcher: $pyCmd" -ForegroundColor Gray
Write-Host "Checking / installing dependencies..." -ForegroundColor Gray
& $pyCmd -m pip install -r backend/TenantNodePlatform/requirements.txt --quiet

Write-Host "`nStarting FastAPI server on http://localhost:8001 (Docs: http://localhost:8001/docs)..." -ForegroundColor Green
& $pyCmd -m uvicorn backend.TenantNodePlatform.main:app --reload --port 8001 --host 0.0.0.0
