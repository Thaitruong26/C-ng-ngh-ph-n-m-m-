@echo off
echo ========================================================
echo    DANG KHOI CHAY BREWLITE (BACKEND + FRONTEND)
echo ========================================================
REM Dam bao khong bi xung dot cong voi Docker container
docker stop brewlite-frontend brewlite-backend >nul 2>&1
docker start brewlite-db >nul 2>&1

start "BrewLite Backend (Port 4000)" cmd /k "cd backend && npm run start:dev"
start "BrewLite Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"
echo.
echo Backend dang chay tai:   http://localhost:4000/api
echo Frontend dang chay tai:  http://localhost:3000
echo Quay Barista:            http://localhost:3000/barista
echo Xem Database truc quan:  http://localhost:5555 (chay view-db.bat)
echo ========================================================
