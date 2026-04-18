import { createServer } from "http";
import app from "./app";
import { initSocketIO } from "./lib/socketio";
import { logger } from "./lib/logger";
import { recoverDeployments } from "./lib/realBuildEngine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");

  // Re-register all live deployments that still have files on disk after a restart
  recoverDeployments().catch((err) =>
    logger.error({ err }, "recoverDeployments failed")
  );
});
