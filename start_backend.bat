@echo off
echo ========================================================
echo   Starting FlowForge Tenant Node Platform Backend (Port 8001)
echo ========================================================

cd /d "%~dp0"

REM Check for py launcher or python executable
where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=py
) else (
    where python >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set PYTHON_CMD=python
    ) else (
        echo [ERROR] Neither 'py' nor 'python' was found in your PATH.
        echo Please ensure Python 3.10+ is installed.
        pause
        exit /b 1
    )
)

echo Using Python command: %PYTHON_CMD%
echo Installing/Verifying dependencies...
%PYTHON_CMD% -m pip install -r backend\TenantNodePlatform\requirements.txt --quiet

echo.
echo Starting FastAPI Server on http://localhost:8001 ...
echo API Docs available at http://localhost:8001/docs
echo Press Ctrl+C or run stop_backend.bat to terminate.
echo ========================================================
echo.

%PYTHON_CMD% -m uvicorn backend.TenantNodePlatform.main:app --reload --port 8001 --host 0.0.0.0

pause
