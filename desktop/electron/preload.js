/**
 * EXPRESS-AI Desktop — Electron Preload Script
 *
 * The frontend can check `window.expressAI` to detect Desktop Mode
 * and get the backend port.
 *
 * NOTE: Do NOT use require('./package.json') here — it fails when the
 * app is packaged inside an .asar archive (module not found error).
 * Use process.env.npm_package_version or app.getVersion() instead.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("expressAI", {
    // Flag so the React app knows it's running inside Electron
    isDesktop: true,

    // Platform info
    platform: process.platform,

    // App version — read from process env set by electron-builder,
    // falls back to '2.1.0' if not available (e.g. during dev).
    version: process.env.npm_package_version || '2.1.0',
});
