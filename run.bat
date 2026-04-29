@echo off
chcp 65001 >nul 2>&1
title 卫戍协议模拟器

echo ========================================
echo   卫戍协议模拟器 - 启动脚本
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

:: 显示 Node 版本
for /f "tokens=*" %%v in ('node -v') do echo [信息] Node.js 版本: %%v

:: 检查 node_modules 和 vite 是否完整
if not exist "node_modules\vite\bin\vite.js" (
    echo.
    if exist "node_modules" (
        echo [信息] 依赖不完整，正在重新安装...
        rmdir /s /q node_modules
    ) else (
        echo [信息] 首次运行，正在安装依赖...
    )
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo [信息] 依赖安装完成
)

echo.
echo [信息] 正在启动开发服务器...
echo [信息] 浏览器将自动打开 http://localhost:3000
echo [信息] 按 Ctrl+C 停止服务器
echo.

call npm run dev
pause
