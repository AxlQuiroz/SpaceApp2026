@echo off
setlocal
cd /d "%~dp0"
if exist "API\.venv\Scripts\python.exe" goto venv
py -3.12 --version >nul 2>&1
if not errorlevel 1 goto pylauncher
python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else 1)" >nul 2>&1
if not errorlevel 1 goto python
echo Instala Python 3.12 y Node.js 24. Despues vuelve a abrir RockieOS.cmd.
echo Python: https://www.python.org/downloads/windows/
echo Node: https://nodejs.org/
if "%~1"=="" pause
exit /b 1

:venv
"API\.venv\Scripts\python.exe" "scripts\rockieos.py" %*
goto finish
:pylauncher
py -3.12 "scripts\rockieos.py" %*
goto finish
:python
python "scripts\rockieos.py" %*
:finish
set "ROCKIEOS_EXIT=%ERRORLEVEL%"
if "%~1"=="" if not "%ROCKIEOS_EXIT%"=="0" pause
exit /b %ROCKIEOS_EXIT%
