import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const logLevelEnum = pgEnum("log_level", ["info", "warn", "error", "success"]);

export const deploymentLogsTable = pgTable("deployment_logs", {
  id: text("id").primaryKey(),
  deploymentId: text("deployment_id").notNull(),
  level: logLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertDeploymentLogSchema = createInsertSchema(deploymentLogsTable).omit({ timestamp: true });
export type InsertDeploymentLog = z.infer<typeof insertDeploymentLogSchema>;
export type DeploymentLog = typeof deploymentLogsTable.$inferSelect;
