import path from "path";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createServerApp } from "./src/server/app";
import { config } from "./src/server/config";

async function start() {
  const app = createServerApp();
  const HOST = config.host || "0.0.0.0";
  const TARGET_PORT = config.port || 3000;

  // In AI Studio / Cloud Run containers, Nginx reverse proxy binds to 8080 and proxies traffic to 3000.
  // We bind to 3000 internally so requests hitting the external APP_PORT (8080) are smoothly served.
  const LISTEN_PORT = (TARGET_PORT === 8080 || !TARGET_PORT) ? 3000 : TARGET_PORT;

  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: LISTEN_PORT,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE" && LISTEN_PORT !== 3000) {
      console.warn(`[EJAZ Transport] Port ${LISTEN_PORT} is already bound by container proxy. Binding to internal port 3000.`);
      server.listen(3000, HOST, () => {
        console.log(`[EJAZ Transport] Enterprise Core running at http://${HOST}:3000 (accessible externally on port ${TARGET_PORT})`);
      });
    } else {
      console.error("Server listen error:", err);
      process.exit(1);
    }
  });

  server.listen(LISTEN_PORT, HOST, () => {
    console.log(`[EJAZ Transport] Enterprise Core running at http://${HOST}:${LISTEN_PORT} (configured APP_PORT=${TARGET_PORT})`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
