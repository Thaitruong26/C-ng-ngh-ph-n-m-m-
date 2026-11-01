Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   ĐANG KHỞI CHẠY BREWLITE (BACKEND + FRONTEND)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run start:dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"
Write-Host "Backend đang chạy tại: http://localhost:4000/api" -ForegroundColor Yellow
Write-Host "Frontend đang chạy tại: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Quầy Barista: http://localhost:3000/barista" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

