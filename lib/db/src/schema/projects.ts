import { pgTable, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const runtimeEnum = pgEnum("runtime", ["static", "nodejs", "python", "java", "unknown"]);
export const projectStatusEnum = pgEnum("project_status", ["idle", "building", "live", "failed", "taken_down"]);

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  runtime: runtimeEnum("runtime").notNull().default("unknown"),
  status: projectStatusEnum("status").notNull().default("idle"),
  liveUrl: text("live_url"),
  repoUrl: text("repo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deploymentCount: integer("deployment_count").notNull().default(0),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
