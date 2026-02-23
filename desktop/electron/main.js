/**
 * DAAN-FERN Desktop — Electron Main Process
 *
 * Lifecycle:
 *   1. Show splash screen
 *   2. Spawn the Python backend (daan-server.exe or desktop_main.py)
 *   3. Wait for "DAAN_PORT=XXXX" on stdout
 *   4. Load the React frontend at localhost:{port}
 *   5. On close, kill the Python process
 */

const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const log = require("electron-log");

// Configure logging
log.transports.file.level = "info";
log.info("DAAN-FERN Desktop starting...");

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let backendPort = null;

// ──────────────────────────────────────────────
// Backend Spawner
// ──────────────────────────────────────────────

function getBackendCommand() {
    const isDev = process.argv.includes("--dev");

    if (isDev) {
        // Development: run Python directly
        return {
            command: "python",
            args: [
                path.join(__dirname, "..", "backend", "desktop_main.py"),
                "--port",
                "8000",
            ],
            cwd: path.join(__dirname, "..", "..", "server"),
        };
    }

    // Production: run bundled executable
    const resourcePath = process.resourcesPath;
    const exeName = process.platform === "win32" ? "daan-server.exe" : "daan-server";

    return {
        command: path.join(resourcePath, "backend", exeName),
        args: [],
        cwd: path.join(resourcePath, "backend"),
    };
}

function startBackend() {
    return new Promise((resolve, reject) => {
        const { command, args, cwd } = getBackendCommand();
        log.info(`Starting backend: ${command} ${args.join(" ")}`);
        log.info(`Working directory: ${cwd}`);

        backendProcess = spawn(command, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, DEPLOYMENT_MODE: "desktop" },
        });

        // Timeout after 30 seconds
        const timeout = setTimeout(() => {
            reject(new Error("Backend did not start within 30 seconds"));
        }, 30000);

        // Listen for the port announcement
        backendProcess.stdout.on("data", (data) => {
            const output = data.toString();
            log.info(`[Backend] ${output.trim()}`);

            const portMatch = output.match(/DAAN_PORT=(\d+)/);
            if (portMatch) {
                backendPort = parseInt(portMatch[1], 10);
                clearTimeout(timeout);
                log.info(`Backend ready on port ${backendPort}`);
                resolve(backendPort);
            }
        });

        backendProcess.stderr.on("data", (data) => {
            log.warn(`[Backend stderr] ${data.toString().trim()}`);
        });

        backendProcess.on("error", (err) => {
            clearTimeout(timeout);
            log.error(`Backend process error: ${err.message}`);
            reject(err);
        });

        backendProcess.on("exit", (code) => {
            log.info(`Backend exited with code ${code}`);
            if (code !== 0 && code !== null) {
                clearTimeout(timeout);
                reject(new Error(`Backend exited with code ${code}`));
            }
        });
    });
}

function stopBackend() {
    if (backendProcess) {
        log.info("Stopping backend...");
        if (process.platform === "win32") {
            // On Windows, we need to kill the process tree
            spawn("taskkill", ["/pid", backendProcess.pid.toString(), "/f", "/t"]);
        } else {
            backendProcess.kill("SIGTERM");
        }
        backendProcess = null;
    }
}

// ──────────────────────────────────────────────
// Window Management
// ──────────────────────────────────────────────

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function createMainWindow(port) {
    const isDev = process.argv.includes("--dev");

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: "DAAN-FERN",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the frontend
    if (isDev) {
        // Dev mode: connect to Vite dev server
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        // Production: load built frontend from resources
        const frontendPath = path.join(
            process.resourcesPath,
            "frontend",
            "index.html"
        );
        mainWindow.loadFile(frontendPath);
    }

    mainWindow.once("ready-to-show", () => {
        if (splashWindow) {
            splashWindow.destroy();
            splashWindow = null;
        }
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// ──────────────────────────────────────────────
// App Lifecycle
// ──────────────────────────────────────────────

app.whenReady().then(async () => {
    createSplashWindow();

    try {
        const port = await startBackend();
        createMainWindow(port);
    } catch (err) {
        log.error(`Failed to start: ${err.message}`);
        dialog.showErrorBox(
            "DAAN-FERN Startup Error",
            `Could not start the backend server:\n\n${err.message}\n\nPlease check the logs at:\n${log.transports.file.getFile().path}`
        );
        app.quit();
    }
});

app.on("window-all-closed", () => {
    stopBackend();
    app.quit();
});

app.on("before-quit", () => {
    stopBackend();
});

// macOS specific
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && backendPort) {
        createMainWindow(backendPort);
    }
});
