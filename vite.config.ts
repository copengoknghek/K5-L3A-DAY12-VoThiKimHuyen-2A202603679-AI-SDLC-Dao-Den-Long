import { defineConfig } from "vite";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import {
  loadLeaderboardFromFile,
  saveLeaderboardToFile,
  type LeaderboardFile,
} from "./src/leaderboard.js";

function leaderboardApi(root: string): Plugin {
  const path = join(root, "leaderboard.json");
  const handler = (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/__leaderboard")) {
      next();
      return;
    }
  if (req.method === "GET") {
      const body = JSON.stringify(loadLeaderboardFromFile(path));
      res.setHeader("Content-Type", "application/json");
      res.end(body);
      return;
    }
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as LeaderboardFile;
          saveLeaderboardToFile(path, data);
          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 400;
          res.end("bad json");
        }
      });
      return;
    }
    res.statusCode = 405;
    res.end();
  };
  return {
    name: "leaderboard-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [leaderboardApi(resolve(__dirname))],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        bench: resolve(__dirname, "bench.html"),
      },
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
  },
});