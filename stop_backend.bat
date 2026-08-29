@echo off
echo ========================================================
echo   Stopping FlowForge Backend on Port 8001
echo ========================================================

powershell -NoProfile -Command ^
  "$port = 8001; " ^
  "$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; " ^
  "if ($connections) { " ^
  "  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique; " ^
  "  foreach ($p in $pids) { " ^
  "    if ($p -gt 0) { " ^
  "      Write-Host 'Terminating process with PID:' $p; " ^
  "      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; " ^
  "    } " ^
  "  } " ^
  "  Write-Host 'Backend server on port 8001 stopped successfully.' -ForegroundColor Green; " ^
  "} else { " ^
  "  Write-Host 'No backend server currently running on port 8001.' -ForegroundColor Yellow; " ^
  "}"

pause
