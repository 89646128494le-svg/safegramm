@echo off
chcp 65001 >nul
echo Creating .env file...

if exist ".env" (
    echo .env file already exists
    echo.
    echo To add ALLOW_ALL_ORIGINS, open .env and add this line:
    echo ALLOW_ALL_ORIGINS=true
    echo.
    pause
    exit /b 0
)

echo DATABASE_URL=postgres://safegram:safegram@localhost:5432/safegram?sslmode=disable > .env
echo JWT_SECRET=dev-secret-change-in-production >> .env
echo PORT=8080 >> .env
echo REDIS_URL=localhost:6379 >> .env
echo WEBHOOK_URL=http://localhost:3000/webhook >> .env
echo NODE_ENV=development >> .env
echo ALLOW_ALL_ORIGINS=true >> .env

echo.
echo .env file created successfully!
echo.
echo ALLOW_ALL_ORIGINS=true is already added for CORS.
echo.
pause
