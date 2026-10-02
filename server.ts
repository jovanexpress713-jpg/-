import path from "path";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createServerApp } from "./src/server/app";
import { config } from "./src/server/config";

async function start() {
  const app = createServerApp();
  const PORT = config.port || 3000;
  const HOST = config.host || "0.0.0.0";

  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
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
  server.listen(PORT, HOST, () => {
    console.log(`[EJAZ Transport] Enterprise Core running at http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
