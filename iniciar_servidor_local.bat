@echo off
:: Configuración de colores (Verde elegante en consola)
color 0A
echo =================================================================
echo        Iniciando Centro de Comando B2B Localmente
echo =================================================================
echo.

:: Recargar las rutas del sistema para asegurar que Node/npm sean detectados
echo [1/2] Configurando entorno de ejecucion...
for /f "tokens=*" %%i in ('powershell -command "[System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')"') do set "PATH=%%i"

:: Abrir el navegador automáticamente en el puerto 3002 después de un breve momento
echo.
echo [2/2] Lanzando aplicacion en el navegador...
start http://localhost:3002

:: Ejecutar el servidor local de desarrollo
echo.
echo =================================================================
echo   Servidor activo. No cierres esta ventana mientras uses la app.
echo =================================================================
echo.
npm.cmd run dev

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Hubo un problema al iniciar el servidor local.
    echo Asegurate de tener Node.js instalado.
    pause
)
