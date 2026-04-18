import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued", "cloning", "detecting", "building", "deploying", "live", "failed", "taken_down"
]);

export const deploymentsTable = pgTable("deployments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  status: deploymentStatusEnum("status").notNull().default("queued"),
  runtime: text("runtime").notNull().default("unknown"),
  branch: text("branch"),
  commitHash: text("commit_hash"),
  liveUrl: text("live_url"),
  repoUrl: text("repo_url"),
  envVars: jsonb("env_vars").$type<Record<string, string>>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deploymentsTable).omit({ createdAt: true });
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deploymentsTable.$inferSelect;
