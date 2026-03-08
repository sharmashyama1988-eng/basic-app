@echo off
title Amisphere Custom Search Engine Server
echo Installing required database and server libraries...
pip install flask flask-cors requests beautifulsoup4
echo.
echo ==============================================
echo STARTING AMISPHERE ENGINE
echo ==============================================
python amisphere_engine.py
pause
