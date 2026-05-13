const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn, exec } = require("child_process");
const { app, BrowserWindow, dialog } = require("electron");

const windowIcon = path.join(__dirname, "icon.ico");
const loadingHtml = path.join(__dirname, "loading.html");

const DEFAULT_PORT = (() => {
  const p = parseInt(process.env.PORT || "", 10);
  return !Number.isNaN(p) && p > 0 && p < 65536 ? p : 3000;
})();
const SERVER_HOST = "127.0.0.1";
const SERVER_START_TIMEOUT_MS = 180_000;
const SERVER_POLL_INTERVAL_MS = 400;
/** Short probe when checking if user already ran `npm run start:script` */
const EXISTING_SERVER_PROBE_MS = 2_500;
const DEBUG_LOG_MAX_BYTES = 512 * 1024;

/** @type {string | null} */
let debugLogPath = null;

function getDebugLogPath() {
  if (!debugLogPath) {
    try {
      debugLogPath = path.join(
        app.getPath("userData"),
        "electron-server-debug.log",
      );
    } catch {
      debugLogPath = path.join(
        os.tmpdir(),
        "hr-management-electron-server-debug.log",
      );
    }
  }
  return debugLogPath;
}

function debugLog(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}\n`;
  try {
    console.log(line.trimEnd());
  } catch {
    /* ignore */
  }
  try {
    const logFile = getDebugLogPath();
    fs.appendFileSync(logFile, line, "utf8");
    trimDebugLogIfNeeded(logFile);
  } catch {
    /* ignore */
  }
}

function trimDebugLogIfNeeded(logFile) {
  try {
    const st = fs.statSync(logFile);
    if (st.size <= DEBUG_LOG_MAX_BYTES) return;
    const buf = fs.readFileSync(logFile);
    const slice = buf.subarray(buf.length - DEBUG_LOG_MAX_BYTES);
    fs.writeFileSync(logFile, slice);
  } catch {
    /* ignore */
  }
}

/**
 * Windows: Explorer-launched apps often get a minimal PATH. Merge Machine+User PATH from registry layer.
 */
function getAugmentedPath(appRoot) {
  const binDir = path.join(appRoot, "node_modules", ".bin");
  const prefix = fs.existsSync(binDir) ? `${binDir}${path.delimiter}` : "";

  let base = process.env.Path || process.env.PATH || "";
  if (process.platform === "win32") {
    try {
      const ps = path.join(
        process.env.SystemRoot || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      );
      if (fs.existsSync(ps)) {
        const { execFileSync } = require("child_process");
        const machineUser = execFileSync(
          ps,
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')",
          ],
          { encoding: "utf8", timeout: 8000, windowsHide: true },
        ).trim();
        if (machineUser.length > 0) {
          base = machineUser;
          debugLog("PATH refreshed from Machine+User (PowerShell)", {
            length: base.length,
          });
        }
      }
    } catch (e) {
      debugLog(
        "PATH refresh failed, using process.env",
        String(e && e.message),
      );
    }
  }

  return `${prefix}${base}`;
}

function findNodeExecutable() {
  if (
    process.env.npm_node_execpath &&
    fs.existsSync(process.env.npm_node_execpath)
  ) {
    return process.env.npm_node_execpath;
  }
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pfx86 = process.env["ProgramFiles(x86)"] || "";
  const local = process.env.LocalAppData || "";
  const candidates = [
    path.join(pf, "nodejs", "node.exe"),
    pfx86 ? path.join(pfx86, "nodejs", "node.exe") : "",
    local ? path.join(local, "Programs", "Microsoft VS Code", "node.exe") : "",
    local ? path.join(local, "Programs", "nodejs", "node.exe") : "",
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      debugLog("Resolved node.exe", c);
      return c;
    }
  }

  const dirs = (process.env.Path || process.env.PATH || "").split(
    path.delimiter,
  );
  for (const dir of dirs) {
    if (!dir) continue;
    const n = path.join(
      dir,
      process.platform === "win32" ? "node.exe" : "node",
    );
    if (fs.existsSync(n)) {
      debugLog("Resolved node from PATH", n);
      return n;
    }
  }

  debugLog("Falling back to bare node (hope PATH is sufficient)");
  return "node";
}

function resolveNpmCmd(nodeExe) {
  const dir = path.dirname(nodeExe);
  const npmCmd = path.join(dir, "npm.cmd");
  if (process.platform === "win32" && fs.existsSync(npmCmd)) {
    debugLog("Resolved npm.cmd", npmCmd);
    return npmCmd;
  }
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function probeHttpOkOnce(port) {
  const url = `http://${SERVER_HOST}:${port}/`;
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function serverAlreadyRunning(port) {
  const deadline = Date.now() + EXISTING_SERVER_PROBE_MS;
  while (Date.now() < deadline) {
    if (await probeHttpOkOnce(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function waitForHttpOk(port, timeoutMs) {
  const url = `http://${SERVER_HOST}:${port}/`;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() > deadline) {
        reject(
          new Error(
            `Serverul nu a răspuns la timp. Verifică .env, baza de date (npm run setup) și că portul nu e ocupat. Jurnal: ${getDebugLogPath()}`,
          ),
        );
        return;
      }
      const req = http.get(url, { timeout: 2500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        setTimeout(attempt, SERVER_POLL_INTERVAL_MS);
      });
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, SERVER_POLL_INTERVAL_MS);
      });
    }
    attempt();
  });
}

/** @type {import('child_process').ChildProcess | null} */
let nextServerChild = null;
let serverStartPromise = null;

function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "hr-next");
  }
  return path.join(__dirname, "..");
}

/** If resources/hr-next/.env is missing, copy from .env next to the .exe (portable / read-only install). */
function ensurePackagedEnvFile() {
  if (!app.isPackaged) return;
  const appRoot = path.join(process.resourcesPath, "hr-next");
  const dest = path.join(appRoot, ".env");
  if (fs.existsSync(dest)) return;
  const besideExe = path.join(path.dirname(process.execPath), ".env");
  if (!fs.existsSync(besideExe)) return;
  try {
    fs.copyFileSync(besideExe, dest);
    debugLog("Copied .env from beside exe to hr-next");
  } catch (e) {
    debugLog("Could not copy .env beside exe", String(e && e.message));
  }
}

function getServerPort() {
  const envPath = path.join(getAppRoot(), ".env");
  if (!fs.existsSync(envPath)) {
    return DEFAULT_PORT;
  }
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    const m = raw.match(/^\s*PORT\s*=\s*(\d+)/m);
    if (m) {
      const p = parseInt(m[1], 10);
      if (!Number.isNaN(p) && p > 0 && p < 65536) return p;
    }
  } catch {
    /* use default */
  }
  return DEFAULT_PORT;
}

function killServerProcessTree() {
  if (!nextServerChild || !nextServerChild.pid) return;
  const pid = nextServerChild.pid;
  debugLog("Killing server process tree", { pid });
  if (process.platform === "win32") {
    exec(`taskkill /PID ${pid} /T /F`, () => {});
  } else {
    try {
      nextServerChild.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  nextServerChild = null;
}

function attachChildLogging(child) {
  if (!child.stdout || !child.stderr) return;
  const append = (buf, label) => {
    const s = buf.toString("utf8");
    if (!s.trim()) return;
    for (const line of s.split(/\r?\n/)) {
      if (line) debugLog(`[child ${label}]`, line);
    }
  };
  child.stdout.on("data", (d) => append(d, "stdout"));
  child.stderr.on("data", (d) => append(d, "stderr"));
}

function spawnNextServer(appRoot, port) {
  if (nextServerChild && !nextServerChild.killed) {
    debugLog("spawnNextServer: child already tracked, skipping new spawn");
    return Promise.resolve();
  }

  const pkgPath = path.join(appRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return Promise.reject(
      new Error(
        `Lipsește package.json în ${appRoot}. Instalarea aplicației pare incompletă. Jurnal: ${getDebugLogPath()}`,
      ),
    );
  }

  const startScript = path.join(appRoot, "scripts", "start.js");
  if (!fs.existsSync(startScript)) {
    return Promise.reject(
      new Error(
        `Lipsește scripts/start.js în ${appRoot}. Jurnal: ${getDebugLogPath()}`,
      ),
    );
  }

  const augmentedPath = getAugmentedPath(appRoot);
  const env = {
    ...process.env,
    Path: augmentedPath,
    PATH: augmentedPath,
    PORT: String(port),
    HOST: process.env.HOST || "0.0.0.0",
    ELECTRON_RUN: "1",
  };

  debugLog("--- server start ---", {
    appRoot,
    port,
    packaged: app.isPackaged,
    execPath: process.execPath,
    cwd: process.cwd(),
    pathHead: augmentedPath.split(path.delimiter).slice(0, 6).join(" | "),
  });

  return tryStartWithExistingServer(port).then((already) => {
    if (already) {
      debugLog("HTTP already responding; using existing server (no spawn)");
      return Promise.resolve();
    }
    return spawnChildAndWait(appRoot, port, env, startScript);
  });
}

function tryStartWithExistingServer(port) {
  debugLog("Probing for existing server", {
    port,
    ms: EXISTING_SERVER_PROBE_MS,
  });
  return serverAlreadyRunning(port).then((ok) => {
    debugLog("Existing server probe result", ok);
    return ok;
  });
}

function spawnChildAndWait(appRoot, port, env, startScript) {
  const nodeExe = findNodeExecutable();
  const npmCmd = resolveNpmCmd(nodeExe);

  return new Promise((resolve, reject) => {
    let settled = false;
    let npmTried = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      nextServerChild = null;
      reject(err);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    waitForHttpOk(port, SERVER_START_TIMEOUT_MS).then(succeed).catch(fail);

    function wireExit(c) {
      c.on("exit", (code, signal) => {
        debugLog("child exit", { code, signal, pid: c.pid });
        if (nextServerChild === c) nextServerChild = null;
        if (!settled && code !== 0 && code != null) {
          fail(
            new Error(
              `Serverul s-a oprit neașteptat (cod ${code}${signal ? `, ${signal}` : ""}). Verifică .env și baza de date (npm run setup). Jurnal: ${getDebugLogPath()}`,
            ),
          );
        }
      });
    }

    function trySpawn(exe, args, label) {
      debugLog("Spawning", label, { exe, args, cwd: appRoot });
      const c = spawn(exe, args, {
        cwd: appRoot,
        env,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      nextServerChild = c;
      attachChildLogging(c);
      wireExit(c);
      c.on("error", (err) => {
        debugLog("spawn error", label, err.message, err.code);
        if (nextServerChild === c) nextServerChild = null;
        if (!npmTried && label === "node+start.js") {
          npmTried = true;
          trySpawn(npmCmd, ["run", "start:script"], "npm run start:script");
          return;
        }
        fail(
          new Error(
            `Nu s-a putut porni serverul (${label}): ${err.message}. Instalează Node.js 20+ (și npm). Jurnal: ${getDebugLogPath()}`,
          ),
        );
      });
    }

    trySpawn(nodeExe, [startScript], "node+start.js");
  });
}

function startEmbeddedServerIfNeeded() {
  if (serverStartPromise) return serverStartPromise;

  ensurePackagedEnvFile();
  const appRoot = getAppRoot();
  const port = getServerPort();
  debugLog("startEmbeddedServerIfNeeded", { appRoot, port });
  serverStartPromise = spawnNextServer(appRoot, port).catch((err) => {
    serverStartPromise = null;
    throw err;
  });

  return serverStartPromise;
}

function createMainWindow(port) {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(loadingHtml);

  startEmbeddedServerIfNeeded()
    .then(() => {
      if (mainWindow.isDestroyed()) return;
      debugLog("Loading app URL", `http://${SERVER_HOST}:${port}/`);
      mainWindow.loadURL(`http://${SERVER_HOST}:${port}`);
    })
    .catch((err) => {
      debugLog("FATAL start", err.message);
      dialog.showErrorBox(
        "HR Management — eroare pornire",
        `${err.message || String(err)}\n\nJurnal: ${getDebugLogPath()}`,
      );
      if (!mainWindow.isDestroyed()) {
        mainWindow.close();
      }
      app.quit();
    });

  return mainWindow;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const w = wins[0];
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(() => {
    debugLog("app ready", {
      userData: app.getPath("userData"),
      packaged: app.isPackaged,
    });
    const port = getServerPort();
    createMainWindow(port);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      killServerProcessTree();
      app.quit();
    }
  });

  app.on("before-quit", () => {
    killServerProcessTree();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const port = getServerPort();
      createMainWindow(port);
    }
  });
}
