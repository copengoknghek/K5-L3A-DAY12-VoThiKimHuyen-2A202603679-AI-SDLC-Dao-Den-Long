#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { platform, cpus, totalmem } from "node:os";
import { loadContract, repoRoot } from "../sim/contract.js";

function usage(): void {
  console.error("Usage: bench --seed <int> --duration <seconds> --out <file>");
}

function parseArgs(argv: string[]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed") out.seed = Number(argv[++i]);
    else if (a === "--duration") out.duration = Number(argv[++i]);
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

function contentType(file: string): string {
  const ext = extname(file);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

function serveStatic(root: string, port: number): Promise<{ close: () => void; url: string }> {
  const clientRoot = join(root, "dist", "client");
  const devRoot = root;
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      try {
        let path = req.url?.split("?")[0] ?? "/";
        if (path === "/") path = "/bench.html";
        const built = join(clientRoot, path.replace(/^\//, ""));
        const dev = join(devRoot, path.replace(/^\//, ""));
        const file = existsSync(built) ? built : dev;
        if (!existsSync(file) || statSync(file).isDirectory()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType(file) });
        res.end(readFileSync(file));
      } catch {
        res.writeHead(500);
        res.end("error");
      }
    });
    server.listen(port, "127.0.0.1", () => {
      resolvePromise({
        close: () => server.close(),
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

async function runWithPuppeteer(url: string, seed: number, duration: number): Promise<unknown> {
  const mod = await import("puppeteer");
  const puppeteer = mod.default ?? mod;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--window-size=1280,720",
      "--no-sandbox",
      "--disable-gpu-vsync",
      "--disable-frame-rate-limit",
      "--use-gl=angle",
      "--enable-webgl",
    ],
    defaultViewport: { width: 1280, height: 720 },
  });
  try {
    const page = await browser.newPage();
    let peakRss = 0;
    const proc = browser.process();
    const poll = setInterval(() => {
      if (proc && proc.pid) {
        try {
          if (process.platform === "win32") return;
          const ps = spawnSync("ps", ["-o", "rss=", "-p", String(proc.pid)], { encoding: "utf-8" });
          const mb = Number(ps.stdout.trim()) / 1024;
          if (mb > peakRss) peakRss = mb;
        } catch {
          /* optional */
        }
      }
    }, 500);
    await page.goto(`${url}/bench.html?seed=${seed}&duration=${duration}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.waitForFunction(() => (window as { __BENCH_RESULT__?: unknown }).__BENCH_RESULT__ != null, {
      timeout: (duration + 15) * 1000,
    });
    clearInterval(poll);
    const result = await page.evaluate(() => (window as { __BENCH_RESULT__?: unknown }).__BENCH_RESULT__);
    if (peakRss > 0 && result && typeof result === "object" && result !== null) {
      (result as { peak_mem_mb: number | null }).peak_mem_mb = Math.round(peakRss * 10) / 10;
    }
    return result;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.seed === undefined || args.duration === undefined || args.out === undefined) {
    usage();
    process.exit(1);
  }
  const root = repoRoot();
  loadContract(root);
  const port = 49217 + (args.seed as number) % 200;
  const host = await serveStatic(root, port);
  try {
    let payload: unknown;
    try {
      payload = await runWithPuppeteer(host.url, args.seed as number, args.duration as number);
    } catch (e) {
      console.error(
        "Bench cần puppeteer (npm i). Lỗi:",
        e instanceof Error ? e.message : String(e),
      );
      payload = {
        contract_version: "1.3",
        avg_fps: 0,
        p1_low_fps: 0,
        frame_ms_p95: 0,
        frames: 0,
        load_ms: 0,
        peak_mem_mb: null,
        vsync_off: false,
        renderer: `Three.js (headless fallback) — ${platform()} ${cpus()[0]?.model ?? ""} RAM ${Math.round(totalmem() / 1e9)}GB`,
        os: `${platform()} ${process.arch}`,
        error: "puppeteer_unavailable",
      };
      process.exitCode = 1;
    }
    writeFileSync(resolve(String(args.out)), JSON.stringify(payload, null, 2) + "\n", "utf-8");
  } finally {
    host.close();
  }
  process.exit(process.exitCode ?? 0);
}

main();