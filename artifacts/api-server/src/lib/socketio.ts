import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "./logger";

let io: SocketIOServer;

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket.io client connected");

    socket.on("subscribe:deployment", ({ deploymentId }: { deploymentId: string }) => {
      socket.join(`deployment:${deploymentId}`);
      logger.info({ socketId: socket.id, deploymentId }, "Subscribed to deployment");
    });

    socket.on("unsubscribe:deployment", ({ deploymentId }: { deploymentId: string }) => {
      socket.leave(`deployment:${deploymentId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket.io client disconnected");
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
