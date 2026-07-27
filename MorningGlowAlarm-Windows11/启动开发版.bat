@echo off
chcp 65001 >nul
title 晨光闹钟
if not exist node_modules (
  echo 正在安装首次运行所需文件，请稍候...
  call npm install
  if errorlevel 1 (
    echo.
    echo 安装失败，请确认电脑已安装 Node.js。
    pause
    exit /b 1
  )
)
start "" npm start
