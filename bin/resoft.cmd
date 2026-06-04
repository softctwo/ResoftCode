@echo off
setlocal enabledelayedexpansion
set "dir=%~dp0.."
set "KILO_DEV_REPO=%dir%"
set "RESOFT_CLI=1"
set "first="
for %%a in (%*) do (
  if not defined first (
    set "arg=%%~a"
    if "!arg:~0,1!" neq "-" set "first=%%~a"
  )
)
if not defined first (
  bun run --cwd "%dir%\packages\opencode" --conditions=browser src/index.ts --project "%CD%" %*
) else (
  bun run --cwd "%dir%\packages\opencode" --conditions=browser src/index.ts %*
)
set "code=%ERRORLEVEL%"
endlocal & exit /b %code%
