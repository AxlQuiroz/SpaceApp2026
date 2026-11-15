@echo off
rem Enciende solo el backend de Python (puertos 8000 y 8001) para usarlo con "npm run dev".
rem No lo uses junto con RockieOS.cmd present/dev: el lanzador ya arranca su propio backend.
setlocal
cd /d "%~dp0"
title RockieOS - Backend
if not exist "API\.venv\Scripts\python.exe" (
  echo Falta el entorno de Python del backend.
  echo Abre RockieOS.cmd y elige "1. Preparar / actualizar dependencias".
  pause
  exit /b 1
)
netstat -ano | findstr /R /C:":8000 .*LISTENING" /C:":8001 .*LISTENING" >nul
if not errorlevel 1 (
  echo Los puertos 8000 u 8001 ya estan en uso: probablemente el backend ya esta encendido
  echo en otra ventana o lo inicio RockieOS.cmd. Cierra esa ventana con Ctrl+C e intentalo de nuevo.
  pause
  exit /b 1
)
echo Encendiendo backend... Deja esta ventana abierta. Ctrl+C lo apaga.
echo Partidas: http://127.0.0.1:8000/docs
echo.
"API\.venv\Scripts\python.exe" "API\scripts\run_backend.py"
set "BACKEND_EXIT=%ERRORLEVEL%"
if not "%BACKEND_EXIT%"=="0" pause
exit /b %BACKEND_EXIT%
