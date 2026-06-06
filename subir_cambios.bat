@echo off
:: Configuración de colores para diseño premium en consola
color 0B
echo =================================================================
echo        Sincronizacion Automatica con GitHub - CRM B2B
echo =================================================================
echo.
echo [1/3] Preparando los archivos modificados...
git add .
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] No se pudieron agregar los archivos a Git. Asegurate de que Git este instalado.
    goto end
)

echo.
echo [2/3] Registrando los cambios localmente (Commit)...
git commit -m "Actualizacion automatica: Integracion con Supabase"
:: Un código de salida 1 en git commit a veces solo significa que no hay cambios nuevos, lo cual es normal.

echo.
echo [3/3] Subiendo los cambios a tu cuenta de GitHub (Push)...
git push -u origin main
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Hubo un problema al subir los cambios a GitHub.
    echo Asegurate de:
    echo   1. Tener conexion a Internet.
    echo   2. Tener configurada tu cuenta de GitHub en esta computadora.
    echo   3. Que el repositorio de GitHub este creado y enlazado.
    goto end
)

color 0A
echo.
echo =================================================================
echo   [EXITO] Tus cambios se han subido correctamente a GitHub!
echo =================================================================
echo.

:end
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
