# Stop FlowForge Backend Server
$port = 8001
Write-Host "Checking for process listening on port $port..." -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        if ($p -gt 0) {
            Write-Host "Terminating process ID $p listening on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "Backend server on port $port stopped successfully." -ForegroundColor Green
} else {
    Write-Host "No process found running on port $port." -ForegroundColor Yellow
}
