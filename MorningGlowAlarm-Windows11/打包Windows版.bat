@echo off
chcp 65001 >nul
title 打包晨光闹钟
if not exist node_modules (
  echo 正在安装打包所需文件，请稍候...
  call npm install
  if errorlevel 1 (
    echo.
    echo 安装失败，请确认电脑已安装 Node.js。
    pause
    exit /b 1
  )
)
echo 正在生成 Windows 安装版和绿色便携版...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo 打包失败，请查看上方提示。
  pause
  exit /b 1
)
echo.
echo 打包完成！文件位于 release 文件夹。
pause
