import { Router, type IRouter } from "express";
import express from "express";
import http from "http";
import path from "path";
import { existsSync } from "fs";
import { getRunningDeployment } from "./realBuildEngine";
import { logger } from "./logger";

const previewRouter: IRouter = Router();

// Route: /preview/:deploymentId/*
previewRouter.use("/preview/:deploymentId", (req, res, next) => {
  const deploymentId = Array.isArray(req.params["deploymentId"])
    ? req.params["deploymentId"][0]
    : req.params["deploymentId"];

  const deployment = getRunningDeployment(deploymentId);

  if (!deployment) {
    res.status(404).send(`
      <html>
      <head><title>Not Found — Sky Hosting</title></head>
      <body style="background:#0B0F19;color:#fff;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="text-align:center">
          <div style="font-size:48px;color:#00FF41;margin-bottom:16px">SKY_HOSTING</div>
          <div style="font-size:24px;margin-bottom:8px">404 — Deployment Not Found</div>
          <div style="color:#666;font-size:14px">Deployment <code style="color:#00FF41">${deploymentId}</code> is not running.</div>
          <div style="margin-top:16px;color:#666;font-size:12px">The server may have restarted. Re-trigger the deployment to bring it back online.</div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (deployment.type === "static" && deployment.staticDir) {
    // Serve static files
    const staticMiddleware = express.static(deployment.staticDir, {
      index: ["index.html", "index.htm"],
      fallthrough: true,
    });

    // Strip the /preview/:id prefix before serving
    req.url = req.url || "/";
    staticMiddleware(req, res, () => {
      // If not found, serve index.html for SPA fallback
      const indexPath = path.join(deployment.staticDir!, "index.html");
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("File not found");
      }
    });
    return;
  }

  if (deployment.type === "process" && deployment.port) {
    // Proxy to the running child process
    const targetPort = deployment.port;
    const targetPath = req.url || "/";

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`,
        "x-forwarded-for": req.ip ?? "",
        "x-forwarded-proto": "https",
        "x-real-ip": req.ip ?? "",
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      logger.warn({ deploymentId, err: err.message }, "Proxy error");
      res.status(502).send(`
        <html>
        <head><title>Bad Gateway — Sky Hosting</title></head>
        <body style="background:#0B0F19;color:#fff;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center">
            <div style="font-size:48px;color:#00FF41;margin-bottom:16px">SKY_HOSTING</div>
            <div style="font-size:24px;margin-bottom:8px">502 — Bad Gateway</div>
            <div style="color:#666;font-size:14px">The deployment process is not responding on port ${targetPort}.</div>
            <div style="margin-top:8px;color:#444;font-size:12px">${err.message}</div>
          </div>
        </body>
        </html>
      `);
    });

    if (req.body && req.method !== "GET" && req.method !== "HEAD") {
      const bodyStr = JSON.stringify(req.body);
      proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyStr));
      proxyReq.write(bodyStr);
    }

    proxyReq.end();
    return;
  }

  next();
});

export default previewRouter;
