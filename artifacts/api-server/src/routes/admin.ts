import { Router, type IRouter } from "express";
import { db, projectsTable, deploymentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { getIO } from "../lib/socketio";
import os from "os";

const router: IRouter = Router();

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
