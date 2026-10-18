@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080/
  python -m http.server 8080
  goto :eof
)
echo.
echo  SOLARIS needs Node.js or Python to serve its files over HTTP.
echo  Install Node.js from https://nodejs.org and run start.cmd again.
echo.
pause
