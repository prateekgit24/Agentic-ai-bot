@echo off
title Anya AI — Starting...

echo Starting Anya AI servers...

:: Frontend (npx serve)
start "Anya — Frontend" cmd /k "cd /d e:\aibot\beta2\my-ai-app\frontend && npx serve"

:: Clock Service
start "Anya — Clock" cmd /k "cd /d e:\aibot\beta2\my-ai-app\clock-service && nodemon server"

:: FastAPI (Python AI)
start "Anya — FastAPI" cmd /k "cd /d e:\aibot\beta2\my-ai-app\fastapi-ai && uvicorn main:app --reload --port 8000"

:: Node Server (main backend)
start "Anya — Node" cmd /k "cd /d e:\aibot\beta2\my-ai-app\node-server && nodemon server"

echo All 4 servers launched in separate windows.
timeout /t 3 >nul
