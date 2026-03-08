@echo off
title Amisphere Core Search Engine
echo Installing dependencies for Amisphere Full Stack Search Engine...
"..\.venv\Scripts\pip.exe" install fastapi uvicorn aiohttp beautifulsoup4

echo.
echo ==============================================
echo STARTING AMISPHERE ENGINE (FastAPI)
echo ==============================================
"..\.venv\Scripts\python.exe" backend/server.py
pause
