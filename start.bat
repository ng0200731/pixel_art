@echo off
echo ========================================
echo   Pixel Art Converter - Starting...
echo   Version: v1.5.1
echo ========================================
echo.
echo Checking for node_modules...

if not exist "node_modules\" (
    echo node_modules not found. Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed!
        echo Please make sure Node.js and npm are installed.
        pause
        exit /b 1
    )
    echo.
    echo Installation complete!
    echo.
)

echo Starting React development server...
echo.
echo The app will open in your browser automatically.
echo Press Ctrl+C to stop the server.
echo.
echo ========================================
echo.

call npm start

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start the server!
    pause
    exit /b 1
)

