@echo off
REM Временная сборка без иконок для Windows

echo Building SafeGram Desktop without icon validation...

REM Устанавливаем переменную окружения для пропуска проверки иконок
set SKIP_ICON_VALIDATION=true

REM Собираем только для текущей платформы
npm run build:win

echo.
echo Build complete! Check dist folder.
pause
