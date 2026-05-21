# GaggiGo Architecture

## Current Upstream Architecture

ESP32
↓
WebSocket/API
↓
Frontend (Preact/Vite)

## GaggiGo Direction

GaggiGo Frontend
↓
Safe Adapter Layer
↓
Allowlisted Operations
↓
GaggiMate API/WebSocket

## Core Principle

Never expose unrestricted machine control.

## Future Layers

1. UI Layer
2. Cache Layer
3. Sync Queue
4. Safe Adapter Layer
5. Allowlisted API Operations

## Main Areas

web/src/index.jsx
App shell/router

web/src/services/ApiService.js
Machine communication layer

web/src/pages/
Main frontend pages

web/src/components/
Shared UI/navigation
