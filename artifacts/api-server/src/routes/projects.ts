import { Router, type IRouter } from "express";
import { nanoid } from "nanoid";
import { db, projectsTable, deploymentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/projects", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
  res.json(projects);
});

router.post("/v1/projects", async (req, res): Promise<void> => {
  const { name, description, repoUrl } = req.body as { name: string; description?: string; repoUrl?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const id = nanoid();
  const [project] = await db.insert(projectsTable).values({
    id,
    name,
    description: description || null,
    repoUrl: repoUrl || null,
  }).returning();
  res.status(201).json(project);
});

router.get("/v1/projects/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/v1/projects/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

router.get("/v1/dashboard/summary", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable);
  const totalProjects = projects.length;
  const liveDeployments = projects.filter(p => p.status === "live").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deployments = await db.select().from(deploymentsTable);
  const buildsToday = deployments.filter(d => new Date(d.createdAt) >= today).length;
  const completed = deployments.filter(d => d.status === "live" || d.status === "failed");
  const successRate = completed.length > 0
    ? Math.round((deployments.filter(d => d.status === "live").length / completed.length) * 100)
    : 100;

  const runtimeBreakdown = {
    static: projects.filter(p => p.runtime === "static").length,
    nodejs: projects.filter(p => p.runtime === "nodejs").length,
    python: projects.filter(p => p.runtime === "python").length,
    java: projects.filter(p => p.runtime === "java").length,
  };

  res.json({ totalProjects, liveDeployments, buildsToday, successRate, runtimeBreakdown });
});

export default router;
