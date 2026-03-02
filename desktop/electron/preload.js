/**
 * EXPRESS-AI Desktop — Electron Preload Script
 *
 * The frontend can check `window.expressAI` to detect Desktop Mode
 * and get the backend port.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("expressAI", {
    // Flag so the React app knows it's running inside Electron
    isDesktop: true,

    // Platform info
    platform: process.platform,

    // App version (from package.json)
    version: require("./package.json").version,
});
