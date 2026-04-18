import { nanoid } from "nanoid";
import type { Server as SocketIOServer } from "socket.io";
import { db, deploymentsTable, deploymentLogsTable, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

// REPLACE WITH DOCKERODE FOR PRODUCTION

type Runtime = "static" | "nodejs" | "python" | "java" | "unknown";

function detectRuntime(repoUrl?: string | null): Runtime {
  if (!repoUrl) return "unknown";
  const lower = repoUrl.toLowerCase();
  if (lower.includes("flask") || lower.includes("django") || lower.includes("fastapi") || lower.includes("python")) return "python";
  if (lower.includes("spring") || lower.includes("java") || lower.includes("maven")) return "java";
  if (lower.includes("node") || lower.includes("npm") || lower.includes("express") || lower.includes("next")) return "nodejs";
  if (lower.includes("html") || lower.includes("static") || lower.includes("jekyll") || lower.includes("gatsby")) return "static";
  const runtimes: Runtime[] = ["nodejs", "python", "static", "nodejs", "python"];
  return runtimes[Math.floor(Math.random() * runtimes.length)];
}

function getRuntimeVersion(runtime: Runtime): string {
  const versions: Record<Runtime, string> = {
    nodejs: "Node.js 20.x",
    python: "Python 3.11",
    java: "Java 17 (Spring Boot)",
    static: "Static HTML/CSS/JS",
    unknown: "Unknown Runtime",
  };
  return versions[runtime];
}

function getBuildSteps(runtime: Runtime): Array<{ delay: number; level: "info" | "warn" | "error" | "success"; message: string }> {
  const base = [
    { delay: 300, level: "info" as const, message: "Initializing build environment..." },
    { delay: 600, level: "info" as const, message: "Cloning repository..." },
    { delay: 800, level: "success" as const, message: "Repository cloned successfully" },
    { delay: 400, level: "info" as const, message: "Analyzing project structure..." },
  ];

  const runtimeSteps: Record<Runtime, Array<{ delay: number; level: "info" | "warn" | "error" | "success"; message: string }>> = {
    nodejs: [
      { delay: 300, level: "info" as const, message: "Detected runtime: Node.js 20.x (package.json found)" },
      { delay: 200, level: "info" as const, message: "Running: npm install" },
      { delay: 1200, level: "info" as const, message: "added 847 packages from 412 contributors" },
      { delay: 400, level: "info" as const, message: "Running: npm run build" },
      { delay: 800, level: "info" as const, message: "> vite build" },
      { delay: 600, level: "info" as const, message: "transforming (842)..." },
      { delay: 500, level: "success" as const, message: "built in 3.42s — dist/index.html, dist/assets/index-Dz8kAkY8.js" },
    ],
    python: [
      { delay: 300, level: "info" as const, message: "Detected runtime: Python 3.11 (requirements.txt found)" },
      { delay: 200, level: "info" as const, message: "Creating virtual environment..." },
      { delay: 400, level: "info" as const, message: "Running: pip install -r requirements.txt" },
      { delay: 1000, level: "info" as const, message: "Successfully installed flask-3.0.0 gunicorn-21.2.0 sqlalchemy-2.0.21" },
      { delay: 300, level: "info" as const, message: "Running: gunicorn app:app --workers 4" },
      { delay: 400, level: "info" as const, message: "[INFO] Arbiter booted" },
      { delay: 300, level: "success" as const, message: "[INFO] Listening at: http://0.0.0.0:8000 (4 workers)" },
    ],
    java: [
      { delay: 300, level: "info" as const, message: "Detected runtime: Java 17 (pom.xml found)" },
      { delay: 200, level: "info" as const, message: "Running: mvn clean package -DskipTests" },
      { delay: 1500, level: "info" as const, message: "[INFO] Building jar: target/app-0.0.1-SNAPSHOT.jar" },
      { delay: 800, level: "info" as const, message: "[INFO] BUILD SUCCESS" },
      { delay: 400, level: "info" as const, message: "Starting Spring Boot application..." },
      { delay: 600, level: "success" as const, message: "Started Application in 3.421 seconds (JVM running for 4.12)" },
    ],
    static: [
      { delay: 300, level: "info" as const, message: "Detected runtime: Static HTML/CSS/JS" },
      { delay: 400, level: "info" as const, message: "Scanning for index.html..." },
      { delay: 200, level: "success" as const, message: "Found index.html — serving static files" },
      { delay: 300, level: "info" as const, message: "Optimizing assets..." },
      { delay: 400, level: "success" as const, message: "Assets optimized (12 files, 847 KB)" },
    ],
    unknown: [
      { delay: 300, level: "warn" as const, message: "Could not detect runtime — attempting auto-detection..." },
      { delay: 600, level: "info" as const, message: "Fallback: serving as static site" },
      { delay: 400, level: "success" as const, message: "Static deployment ready" },
    ],
  };

  const final = [
    { delay: 300, level: "info" as const, message: "Allocating deployment slot..." },
    { delay: 400, level: "info" as const, message: "Configuring SSL certificate..." },
    { delay: 300, level: "info" as const, message: "Setting up CDN edge nodes..." },
    { delay: 300, level: "success" as const, message: "Deployment complete — site is live!" },
  ];

  return [...base, ...runtimeSteps[runtime], ...final];
}

export async function runMockBuild(
  deploymentId: string,
  projectId: string,
  repoUrl: string | null | undefined,
  io: SocketIOServer
): Promise<void> {
  const runtime = detectRuntime(repoUrl);
  const runtimeVersion = getRuntimeVersion(runtime);
  const steps = getBuildSteps(runtime);
  const liveUrl = `https://${projectId.slice(0, 8)}-${nanoid(6).toLowerCase()}.skyhosting.app`;

  const emitLog = async (level: "info" | "warn" | "error" | "success", message: string) => {
    const timestamp = new Date().toISOString();
    const logId = nanoid();
    await db.insert(deploymentLogsTable).values({
      id: logId,
      deploymentId,
      level,
      message,
      timestamp: new Date(timestamp),
    });
    io.to(`deployment:${deploymentId}`).emit("deployment:log", {
      deploymentId,
      log: { timestamp, level, message },
    });
  };

  const updateStatus = async (status: "cloning" | "detecting" | "building" | "deploying" | "live" | "failed") => {
    await db.update(deploymentsTable)
      .set({ status, ...(status === "live" ? { liveUrl, completedAt: new Date() } : {}) })
      .where(eq(deploymentsTable.id, deploymentId));
    io.to(`deployment:${deploymentId}`).emit("deployment:status", { deploymentId, status });
  };

  try {
    await db.update(deploymentsTable)
      .set({ status: "cloning", startedAt: new Date(), runtime })
      .where(eq(deploymentsTable.id, deploymentId));

    io.to(`deployment:${deploymentId}`).emit("deployment:status", { deploymentId, status: "cloning" });

    for (const step of steps) {
      await new Promise<void>((resolve) => setTimeout(resolve, step.delay));

      if (step.message.includes("Analyzing")) await updateStatus("detecting");
      else if (step.message.includes("Detected runtime")) {
        await emitLog("info", `Detected runtime: ${runtimeVersion}`);
        await updateStatus("building");
        continue;
      } else if (step.message.includes("Allocating")) await updateStatus("deploying");

      await emitLog(step.level, step.message);
    }

    await updateStatus("live");

    await db.update(projectsTable)
      .set({
        status: "live",
        liveUrl,
        runtime: runtime as "static" | "nodejs" | "python" | "java" | "unknown",
        updatedAt: new Date(),
        deploymentCount: sql`${projectsTable.deploymentCount} + 1`,
      })
      .where(eq(projectsTable.id, projectId));

    logger.info({ deploymentId, projectId, liveUrl }, "Mock build completed successfully");
  } catch (err) {
    await emitLog("error", `Build failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    await db.update(deploymentsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(deploymentsTable.id, deploymentId));
    io.to(`deployment:${deploymentId}`).emit("deployment:status", { deploymentId, status: "failed" });

    await db.update(projectsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(projectsTable.id, projectId));
    logger.error({ deploymentId, err }, "Mock build failed");
  }
}
