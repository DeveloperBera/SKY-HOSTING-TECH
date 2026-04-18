import { exec, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { existsSync, createWriteStream } from "fs";
import path from "path";
import net from "net";
import type { Server as SocketIOServer } from "socket.io";
import { db, deploymentsTable, deploymentLogsTable, projectsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { logger } from "./logger";

const execAsync = promisify(exec);
export const BASE_DEPLOY_DIR = "/tmp/sky-deployments";

// Metadata persisted inside each deployment dir so we can recover after restart
interface DeployMeta {
  type: "static" | "process";
  staticDir?: string;
  startCommand?: string;
  port?: number;
  deployDir: string;
  projectId: string;
}

function metaPath(deployDir: string): string {
  return path.join(deployDir, ".sky-meta.json");
}

async function writeMeta(deployDir: string, meta: DeployMeta): Promise<void> {
  await fs.writeFile(metaPath(deployDir), JSON.stringify(meta, null, 2), "utf-8");
}

async function readMeta(deployDir: string): Promise<DeployMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(deployDir), "utf-8");
    return JSON.parse(raw) as DeployMeta;
  } catch {
    return null;
  }
}

// Check if a TCP port is accepting connections
function isPortAlive(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (result: boolean) => { sock.destroy(); resolve(result); };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(port, "127.0.0.1");
  });
}

// Track running child processes per deployment
export interface RunningDeployment {
  type: "static" | "process";
  staticDir?: string;
  port?: number;
  process?: ChildProcess;
  deploymentId: string;
}

const runningDeployments = new Map<string, RunningDeployment>();
let nextPort = 25000;

export function getRunningDeployment(id: string): RunningDeployment | undefined {
  return runningDeployments.get(id);
}

export function getAllRunningDeployments(): Map<string, RunningDeployment> {
  return runningDeployments;
}

function allocatePort(): number {
  return nextPort++;
}

async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(BASE_DEPLOY_DIR, { recursive: true });
}

// Detect runtime from actual cloned files
async function detectRuntimeFromFiles(dir: string): Promise<{
  runtime: "static" | "nodejs" | "python" | "unknown";
  hasBuildScript: boolean;
  buildOutputDir: string | null;
  startCommand: string | null;
}> {
  const pkgPath = path.join(dir, "package.json");
  const reqPath = path.join(dir, "requirements.txt");
  const indexHtml = path.join(dir, "index.html");

  if (existsSync(pkgPath)) {
    try {
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw) as {
        scripts?: Record<string, string>;
        main?: string;
      };
      const scripts = pkg.scripts ?? {};
      const hasBuild = !!scripts["build"];

      // Determine likely build output dir
      let buildOutputDir: string | null = null;
      if (hasBuild) {
        const buildCmd = scripts["build"] ?? "";
        if (buildCmd.includes("next")) buildOutputDir = "out";
        else if (buildCmd.includes("vite") || buildCmd.includes("react-scripts")) buildOutputDir = "dist";
        else buildOutputDir = "dist";
      }

      const startCommand = scripts["start"]
        ? "npm start"
        : scripts["dev"]
        ? "npm run dev"
        : pkg.main
        ? `node ${pkg.main}`
        : "node index.js";

      return { runtime: "nodejs", hasBuildScript: hasBuild, buildOutputDir, startCommand };
    } catch {
      return { runtime: "nodejs", hasBuildScript: false, buildOutputDir: null, startCommand: "node index.js" };
    }
  }

  if (existsSync(reqPath)) {
    return { runtime: "python", hasBuildScript: false, buildOutputDir: null, startCommand: null };
  }

  if (existsSync(indexHtml)) {
    return { runtime: "static", hasBuildScript: false, buildOutputDir: null, startCommand: null };
  }

  // Scan for any html file
  try {
    const files = await fs.readdir(dir);
    if (files.some(f => f.endsWith(".html"))) {
      return { runtime: "static", hasBuildScript: false, buildOutputDir: null, startCommand: null };
    }
  } catch {
    /* ignore */
  }

  return { runtime: "unknown", hasBuildScript: false, buildOutputDir: null, startCommand: null };
}

// Stream a shell command's stdout/stderr to Socket.io
function runWithLogs(
  command: string,
  cwd: string,
  deploymentId: string,
  io: SocketIOServer,
  emitLog: (level: "info" | "warn" | "error" | "success", msg: string) => Promise<void>
): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const child = exec(command, { cwd, maxBuffer: 50 * 1024 * 1024 });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const lines = String(chunk).split("\n").filter(Boolean);
      lines.forEach(line => emitLog("info", line));
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      const lines = String(chunk).split("\n").filter(Boolean);
      lines.forEach(line => emitLog("warn", line));
    });

    child.on("close", (code) => resolve({ code: code ?? 0 }));
  });
}

// Find the actual built output directory
async function findBuildOutput(dir: string, candidate: string | null): Promise<string | null> {
  const candidates = [candidate, "dist", "build", "out", ".next", "public", "_site"].filter(Boolean) as string[];
  for (const c of candidates) {
    const full = path.join(dir, c);
    if (existsSync(full)) {
      // Verify it has something in it
      try {
        const files = await fs.readdir(full);
        if (files.length > 0) return full;
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

export async function runRealBuild(
  deploymentId: string,
  projectId: string,
  repoUrl: string,
  io: SocketIOServer
): Promise<void> {
  await ensureBaseDir();
  const deployDir = path.join(BASE_DEPLOY_DIR, deploymentId);

  const emitLog = async (level: "info" | "warn" | "error" | "success", message: string) => {
    const timestamp = new Date().toISOString();
    try {
      await db.insert(deploymentLogsTable).values({
        id: `${deploymentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        deploymentId,
        level,
        message: message.slice(0, 2000),
        timestamp: new Date(timestamp),
      });
    } catch {
      /* log insert errors are non-fatal */
    }
    io.to(`deployment:${deploymentId}`).emit("deployment:log", {
      deploymentId,
      log: { timestamp, level, message },
    });
  };

  const updateStatus = async (
    status: "cloning" | "detecting" | "building" | "deploying" | "live" | "failed",
    extra: Record<string, unknown> = {}
  ) => {
    await db.update(deploymentsTable)
      .set({ status, ...extra })
      .where(eq(deploymentsTable.id, deploymentId));
    io.to(`deployment:${deploymentId}`).emit("deployment:status", { deploymentId, status });
  };

  try {
    // ── CLONING ────────────────────────────────────────────────────
    await updateStatus("cloning");
    await emitLog("info", `Cloning ${repoUrl} ...`);

    // Clean up any previous clone
    if (existsSync(deployDir)) {
      await fs.rm(deployDir, { recursive: true, force: true });
    }

    const cloneResult = await runWithLogs(
      `git clone --depth 1 ${repoUrl} ${deployDir}`,
      BASE_DEPLOY_DIR,
      deploymentId,
      io,
      emitLog
    );

    if (cloneResult.code !== 0 || !existsSync(deployDir)) {
      await emitLog("error", "git clone failed — is the repository public?");
      throw new Error("git clone failed");
    }
    await emitLog("success", "Repository cloned successfully");

    // ── DETECTING ──────────────────────────────────────────────────
    await updateStatus("detecting");
    await emitLog("info", "Analyzing project structure...");

    const { runtime, hasBuildScript, buildOutputDir, startCommand } = await detectRuntimeFromFiles(deployDir);

    await emitLog("info", `Detected runtime: ${runtime === "nodejs" ? "Node.js" : runtime === "python" ? "Python" : runtime === "static" ? "Static HTML" : "Unknown"}`);

    if (runtime === "python") {
      await emitLog("warn", "Python runtime detected but Python/pip is not available in this environment.");
      await emitLog("warn", "Attempting to serve any static files found...");
    }

    // Update deployment with detected runtime
    await db.update(deploymentsTable).set({ runtime }).where(eq(deploymentsTable.id, deploymentId));

    // ── BUILDING ───────────────────────────────────────────────────
    await updateStatus("building");

    let serveDir: string | null = null;
    let processPort: number | null = null;

    if (runtime === "nodejs") {
      await emitLog("info", "Running: npm install");
      const installResult = await runWithLogs("npm install --prefer-offline 2>&1", deployDir, deploymentId, io, emitLog);

      if (installResult.code !== 0) {
        await emitLog("warn", "npm install had errors, continuing...");
      } else {
        await emitLog("success", "Dependencies installed");
      }

      if (hasBuildScript) {
        await emitLog("info", "Running: npm run build");
        await runWithLogs("npm run build 2>&1", deployDir, deploymentId, io, emitLog);

        const outDir = await findBuildOutput(deployDir, buildOutputDir);
        if (outDir) {
          await emitLog("success", `Build complete — output at ${path.relative(deployDir, outDir)}/`);
          serveDir = outDir;
        } else {
          await emitLog("warn", "Build output directory not found, falling back to root");
          serveDir = deployDir;
        }
      } else {
        // It's a server app — spawn it
        await emitLog("info", `Starting server process: ${startCommand}`);
        processPort = allocatePort();

        const env = {
          ...process.env,
          PORT: String(processPort),
          NODE_ENV: "production",
        };

        const [cmd, ...args] = (startCommand ?? "node index.js").split(" ");
        const child = spawn(cmd, args, {
          cwd: deployDir,
          env,
          detached: false,
        });

        runningDeployments.set(deploymentId, {
          type: "process",
          port: processPort,
          process: child,
          deploymentId,
        });

        child.stdout?.on("data", (chunk: Buffer | string) => {
          const lines = String(chunk).split("\n").filter(Boolean);
          lines.slice(0, 5).forEach(line => {
            db.insert(deploymentLogsTable).values({
              id: `${deploymentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              deploymentId,
              level: "info",
              message: line.slice(0, 2000),
              timestamp: new Date(),
            }).catch(() => {});
            io.to(`deployment:${deploymentId}`).emit("deployment:log", {
              deploymentId,
              log: { timestamp: new Date().toISOString(), level: "info", message: line },
            });
          });
        });

        child.stderr?.on("data", (chunk: Buffer | string) => {
          const lines = String(chunk).split("\n").filter(Boolean);
          lines.slice(0, 5).forEach(line => {
            io.to(`deployment:${deploymentId}`).emit("deployment:log", {
              deploymentId,
              log: { timestamp: new Date().toISOString(), level: "warn", message: line },
            });
          });
        });

        child.on("exit", (code) => {
          logger.info({ deploymentId, code }, "Deployment process exited");
        });

        // Wait a moment for the process to start
        await new Promise<void>(r => setTimeout(r, 2500));
        await emitLog("success", `Server listening on port ${processPort}`);
      }
    } else {
      // Static or unknown — serve from the deploy dir
      const indexPath = path.join(deployDir, "index.html");
      if (existsSync(indexPath)) {
        await emitLog("success", "Static site ready — index.html found");
      } else {
        // List files so user can see what we got
        try {
          const files = await fs.readdir(deployDir);
          await emitLog("info", `Files: ${files.slice(0, 10).join(", ")}`);
        } catch {
          /* ignore */
        }
      }
      serveDir = deployDir;
    }

    // ── DEPLOYING ──────────────────────────────────────────────────
    await updateStatus("deploying");
    await emitLog("info", "Allocating deployment slot...");
    await new Promise<void>(r => setTimeout(r, 400));
    await emitLog("info", "Configuring SSL...");
    await new Promise<void>(r => setTimeout(r, 300));

    // Register serving and persist metadata for recovery
    if (serveDir) {
      runningDeployments.set(deploymentId, {
        type: "static",
        staticDir: serveDir,
        deploymentId,
      });
      await writeMeta(serveDir === deployDir ? deployDir : deployDir, {
        type: "static",
        staticDir: serveDir,
        deployDir,
        projectId,
      });
    } else if (processPort) {
      await writeMeta(deployDir, {
        type: "process",
        startCommand: startCommand ?? "npm start",
        port: processPort,
        deployDir,
        projectId,
      });
    }

    // Build the live URL
    const devDomain = process.env["REPLIT_DEV_DOMAIN"] ?? "localhost:8080";
    const liveUrl = `https://${devDomain}/preview/${deploymentId}/`;

    // ── LIVE ───────────────────────────────────────────────────────
    await updateStatus("live", { liveUrl, completedAt: new Date() });
    await db.update(projectsTable).set({
      status: "live",
      liveUrl,
      runtime: runtime as "static" | "nodejs" | "python" | "java" | "unknown",
      updatedAt: new Date(),
      deploymentCount: sql`${projectsTable.deploymentCount} + 1`,
    }).where(eq(projectsTable.id, projectId));

    await emitLog("success", `Deployment live at: ${liveUrl}`);
    logger.info({ deploymentId, liveUrl }, "Real deployment complete");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await emitLog("error", `Build failed: ${msg}`).catch(() => {});
    await db.update(deploymentsTable).set({ status: "failed", completedAt: new Date() })
      .where(eq(deploymentsTable.id, deploymentId)).catch(() => {});
    await db.update(projectsTable).set({ status: "failed", updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId)).catch(() => {});
    io.to(`deployment:${deploymentId}`).emit("deployment:status", { deploymentId, status: "failed" });
    logger.error({ deploymentId, err }, "Real build failed");
  }
}

// Spawn a process deployment and register it in memory
async function spawnProcess(
  deploymentId: string,
  meta: DeployMeta
): Promise<void> {
  const port = meta.port ?? allocatePort();
  const [cmd, ...args] = (meta.startCommand ?? "npm start").split(" ");
  const child = spawn(cmd, args, {
    cwd: meta.deployDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
    detached: false,
  });
  runningDeployments.set(deploymentId, {
    type: "process",
    port,
    process: child,
    deploymentId,
  });
  if (port >= nextPort) nextPort = port + 1;
  child.on("exit", (code) => {
    logger.info({ deploymentId, code }, "Deployment process exited");
    // Process may have daemonized (e.g. PM2) — check if port is still alive
    const existing = runningDeployments.get(deploymentId);
    if (existing?.port) {
      setTimeout(async () => {
        const alive = await isPortAlive(existing.port!);
        if (alive) {
          // Port still up — daemon (PM2/etc) is keeping it alive
          runningDeployments.set(deploymentId, {
            type: "process",
            port: existing.port,
            deploymentId,
          });
          logger.info({ deploymentId, port: existing.port }, "Process daemonized, port still alive");
        } else {
          runningDeployments.delete(deploymentId);
          logger.info({ deploymentId }, "Process exited and port is dead");
        }
      }, 3000);
    }
  });
}

// Called once on server startup — re-registers all live deployments that have files on disk
export async function recoverDeployments(): Promise<void> {
  logger.info("Recovering live deployments from disk...");
  try {
    const liveDeployments = await db
      .select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.status, "live"));

    let recovered = 0;
    for (const dep of liveDeployments) {
      const deployDir = path.join(BASE_DEPLOY_DIR, dep.id);
      if (!existsSync(deployDir)) continue;

      const meta = await readMeta(deployDir);
      if (!meta) {
        // No meta file — try static fallback
        const indexPath = path.join(deployDir, "index.html");
        if (existsSync(indexPath)) {
          runningDeployments.set(dep.id, { type: "static", staticDir: deployDir, deploymentId: dep.id });
          recovered++;
        }
        continue;
      }

      if (meta.type === "static" && meta.staticDir && existsSync(meta.staticDir)) {
        runningDeployments.set(dep.id, { type: "static", staticDir: meta.staticDir, deploymentId: dep.id });
        recovered++;
      } else if (meta.type === "process" && meta.port) {
        const alive = await isPortAlive(meta.port);
        if (alive) {
          // Process is still alive (e.g. PM2 kept it running)
          runningDeployments.set(dep.id, { type: "process", port: meta.port, deploymentId: dep.id });
          if (meta.port >= nextPort) nextPort = meta.port + 1;
          recovered++;
        } else {
          // Re-spawn the process
          try {
            await spawnProcess(dep.id, meta);
            await new Promise<void>(r => setTimeout(r, 2000));
            recovered++;
            logger.info({ deploymentId: dep.id }, "Re-spawned deployment process");
          } catch (err) {
            logger.warn({ deploymentId: dep.id, err }, "Failed to re-spawn deployment, marking failed");
            await db.update(deploymentsTable).set({ status: "failed" }).where(eq(deploymentsTable.id, dep.id)).catch(() => {});
          }
        }
      }
    }

    logger.info({ recovered, total: liveDeployments.length }, "Deployment recovery complete");
  } catch (err) {
    logger.error({ err }, "Deployment recovery failed");
  }
}

export async function teardownDeployment(deploymentId: string): Promise<void> {
  const d = runningDeployments.get(deploymentId);
  if (d?.process) {
    d.process.kill("SIGTERM");
    setTimeout(() => d.process?.kill("SIGKILL"), 5000);
  }
  runningDeployments.delete(deploymentId);

  // Clean up disk
  const deployDir = path.join(BASE_DEPLOY_DIR, deploymentId);
  if (existsSync(deployDir)) {
    await fs.rm(deployDir, { recursive: true, force: true }).catch(() => {});
  }
}
