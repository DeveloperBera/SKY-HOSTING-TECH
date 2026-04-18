import { Router, type IRouter, type Request } from "express";
import { nanoid } from "nanoid";
import { db, deploymentsTable, deploymentLogsTable, projectsTable, apiKeysTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getIO } from "../lib/socketio";
import { runRealBuild, teardownDeployment } from "../lib/realBuildEngine";

const router: IRouter = Router();

router.post("/v1/deploy", async (req: Request, res): Promise<void> => {
  const { projectId, repoUrl, branch, envVars } = req.body as {
    projectId: string;
    repoUrl?: string;
    branch?: string;
    envVars?: Record<string, string>;
  };

  if (!projectId) {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const id = nanoid();
  const effectiveRepoUrl = repoUrl || project.repoUrl;

  const [deployment] = await db.insert(deploymentsTable).values({
    id,
    projectId,
    projectName: project.name,
    status: "queued",
    runtime: "unknown",
    branch: branch || "main",
    repoUrl: effectiveRepoUrl || null,
    envVars: envVars || null,
  }).returning();

  await db.update(projectsTable)
    .set({ status: "building", updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  const io = getIO();
  setImmediate(() => {
    runRealBuild(id, projectId, effectiveRepoUrl ?? "", io).catch(console.error);
  });

  res.status(201).json(deployment);
});

router.get("/v1/deployments", async (req, res): Promise<void> => {
  const projectId = req.query["projectId"] as string | undefined;
  const query = db.select().from(deploymentsTable).orderBy(desc(deploymentsTable.createdAt));
  const deployments = projectId
    ? await db.select().from(deploymentsTable).where(eq(deploymentsTable.projectId, projectId)).orderBy(desc(deploymentsTable.createdAt))
    : await query;
  res.json(deployments);
});

router.get("/v1/deployments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const [deployment] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id));
  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }
  res.json(deployment);
});

router.delete("/v1/deployments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  await db.update(deploymentsTable).set({ status: "taken_down" }).where(eq(deploymentsTable.id, id));
  await teardownDeployment(id).catch(() => {});
  res.status(204).send();
});

router.get("/v1/logs/:deploymentId", async (req, res): Promise<void> => {
  const deploymentId = Array.isArray(req.params["deploymentId"])
    ? req.params["deploymentId"][0]
    : req.params["deploymentId"];
  const logs = await db.select().from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(deploymentLogsTable.timestamp);
  res.json({ deploymentId, logs: logs.map(l => ({ timestamp: l.timestamp.toISOString(), level: l.level, message: l.message })) });
});

router.get("/v1/activity", async (_req, res): Promise<void> => {
  const deployments = await db.select().from(deploymentsTable)
    .orderBy(desc(deploymentsTable.createdAt))
    .limit(20);

  const activity = deployments.map(d => ({
    id: d.id,
    type: d.status === "live" ? "deployed"
      : d.status === "failed" ? "failed"
      : d.status === "taken_down" ? "taken_down"
      : "created",
    projectName: d.projectName,
    deploymentId: d.id,
    message: d.status === "live" ? `Deployed ${d.projectName} successfully`
      : d.status === "failed" ? `Build failed for ${d.projectName}`
      : d.status === "taken_down" ? `${d.projectName} taken down`
      : `Deployment created for ${d.projectName}`,
    timestamp: d.createdAt.toISOString(),
  }));

  res.json(activity);
});

export default router;
