@echo off
echo Iniciando servidores PTT Web...
echo.
echo 1. Servidor PeerJS (porta 9000)
start /B npm run peer
timeout /t 2 /nobreak > nul
echo 2. Backend Express (porta 3000)
start /B npm start
echo.
echo Servidores iniciados!
echo Acesse: https://localhost:3000
pause