import path from "path";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createServerApp } from "./src/server/app";
import { config } from "./src/server/config";

async function start() {
  const app = createServerApp();
  const HOST = "0.0.0.0";
  const TARGET_PORT = config.port || 3000;

  // In AI Studio dev environment, the dev server must bind to port 3000.
  const LISTEN_PORT = process.env.NODE_ENV === "production" ? (TARGET_PORT || 3000) : 3000;
  // Share the app's HTTP server with Vite HMR so proxied previews use the same
  // external WebSocket endpoint instead of Vite's separate fallback port.
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: LISTEN_PORT,
        hmr: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("{/*splat}", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

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
