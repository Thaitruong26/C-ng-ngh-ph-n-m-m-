@echo off
echo ========================================================
echo       GIAO DIEN XEM DATABASE (PRISMA STUDIO)
echo ========================================================
echo.
echo Dang mo Prisma Studio tren trinh duyet tai: http://localhost:5555
echo Ban co the xem toan bo cac bang (User, Order, Payment, Product, Ingredient...)
echo.
echo Nhan Ctrl+C de tat giao dien khi xem xong.
echo ========================================================
cd /d "%~dp0backend"
start http://localhost:5555
npx prisma studio --port 5555

