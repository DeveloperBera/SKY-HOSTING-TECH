import { Router, type IRouter } from "express";
import { db, projectsTable, deploymentsTable, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getIO } from "../lib/socketio";
import os from "os";

const router: IRouter = Router();

router.post("/v1/admin/login", async (req, res): Promise<void> => {
  const { key } = req.body as { key?: string };
  if (!key) {
    res.status(400).json({ error: "API key is required" });
    return;
  }

  const [found] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key));

  if (!found) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  if (found.scope !== "admin") {
    res.status(403).json({ error: "This key does not have admin scope" });
    return;
  }

  res.json({ success: true, name: found.name, scope: found.scope });
});

router.get("/v1/admin/stats", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  const deployments = await db.select().from(deploymentsTable);

  const totalProjects = projects.length;
  const totalDeployments = deployments.length;
  const activeDeployments = deployments.filter(d => d.status === "live").length;
  const failedDeployments = deployments.filter(d => d.status === "failed").length;

  const io = getIO();
  const activeWebSocketConnections = io.engine.clientsCount;

  const cpuUsage = os.loadavg()[0];
  const serverLoad = Math.min(Math.round(cpuUsage * 10) / 10, 100);
  const uptime = process.uptime();

  res.json({
    totalProjects,
    totalDeployments,
    activeDeployments,
    failedDeployments,
    activeWebSocketConnections,
    serverLoad,
    uptime,
    masterApiKey: process.env["MASTER_API_KEY"] || "sk_master_skyhosting",
  });
});

export default router;
