import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn, type ChildProcess } from "child_process";
import type { Server } from "http";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: "25mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(
  app: express.Application,
  options: { landingPath?: string } = {},
) {
  const landingPath = options.landingPath ?? "/";
  const landingAtRoot = landingPath === "/";

  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log(`Serving Expo manifest routing; QR landing page at ${landingPath}`);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Expo Go (phone) preview: the Expo client sends an `expo-platform` header.
    // Browsers never send it, so the web app served at "/" is unaffected and
    // the mobile manifest/QR flow keeps working as before.
    const platform = req.header("expo-platform");
    if (
      (platform === "ios" || platform === "android") &&
      (req.path === "/" || req.path === "/manifest")
    ) {
      return serveExpoManifest(platform, res);
    }

    // Browser-facing QR landing page. In production this is "/"; in dev web
    // preview it is moved off "/" (e.g. "/mobile") so the real web app owns "/".
    if (req.path === landingPath) {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  if (landingAtRoot) {
    // Production: also serve the pre-built static Expo web bundle + project
    // assets. Skipped in dev, where Metro (proxied) serves the web assets and
    // mounting these here would shadow Metro's "/assets" responses.
    app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
    app.use(express.static(path.resolve(process.cwd(), "static-build")));
  }

  log(
    `Expo routing: manifest on expo-platform header (/ and /manifest); QR landing at ${landingPath}`,
  );
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

const METRO_WEB_PORT = 8081;
const METRO_WEB_TARGET = `http://localhost:${METRO_WEB_PORT}`;

/**
 * Dev-only: start the Expo web (Metro) dev server as a child process so the
 * real React Native app renders in the browser via react-native-web. The app's
 * API base URL is pinned to the Replit dev domain so web API calls resolve to
 * this same origin (the proxy below forwards everything except /api to Metro).
 */
function startMetroWeb(): ChildProcess {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  const publicUrl = domain ? `https://${domain}` : undefined;

  log(`Starting Expo web (Metro) dev server on port ${METRO_WEB_PORT}...`);
  if (publicUrl) log(`Web API base (EXPO_PUBLIC_API_URL): ${publicUrl}`);

  const metro = spawn("npm", ["run", "web:metro"], {
    stdio: ["ignore", "pipe", "pipe"],
    // Own process group so shutdown can tear down the whole Metro tree
    // (npm -> expo -> metro) instead of orphaning a process holding :8081.
    detached: true,
    env: {
      ...process.env,
      BROWSER: "none",
      ...(publicUrl
        ? {
            EXPO_PUBLIC_API_URL: publicUrl,
            EXPO_PACKAGER_PROXY_URL: publicUrl,
            REACT_NATIVE_PACKAGER_HOSTNAME: domain,
          }
        : {}),
    },
  });

  metro.stdout?.on("data", (d) => process.stdout.write(`[Metro] ${d}`));
  metro.stderr?.on("data", (d) => process.stderr.write(`[Metro] ${d}`));
  metro.on("exit", (code) => log(`[Metro] exited with code ${code}`));

  const cleanup = () => {
    if (metro.killed || metro.pid === undefined) return;
    try {
      // Negative pid signals the entire process group (npm + expo + metro).
      process.kill(-metro.pid, "SIGTERM");
    } catch {
      try {
        metro.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  return metro;
}

/**
 * Dev-only: forward every non-/api request (HTML, JS bundles, assets and the
 * Metro HMR websocket) to the Expo web dev server, so the browser sees the live
 * app on the same origin that serves the API.
 */
function setupWebProxy(app: express.Application, server: Server) {
  const proxy = createProxyMiddleware({
    target: METRO_WEB_TARGET,
    changeOrigin: true,
    ws: true,
    pathFilter: (pathname) => !pathname.startsWith("/api"),
    on: {
      proxyRes: (proxyRes) => {
        // Allow embedding inside the Replit preview iframe.
        delete proxyRes.headers["x-frame-options"];
        delete proxyRes.headers["content-security-policy"];
      },
      error: (_err, _req, res) => {
        // Metro is still warming up (first web bundle can take a while).
        if (res && "writeHead" in res && !res.headersSent) {
          res.writeHead(503, {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": "4",
          });
          res.end(
            `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="4"></head><body style="font-family:-apple-system,system-ui,sans-serif;background:#0B1426;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="margin:0 0 8px">King Speech</h2><p style="opacity:.7;margin:0">Запускаем веб-версию… первая сборка может занять минуту.</p></div></body></html>`,
          );
        }
      },
    },
  });

  app.use(proxy);
  server.on("upgrade", proxy.upgrade!);
  log(`Proxying web requests to Expo dev server at ${METRO_WEB_TARGET}`);
}

function listen(server: Server) {
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );
}

(async () => {
  const isProd = process.env.NODE_ENV === "production";

  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  if (isProd) {
    // Production: serve the pre-built static Expo bundles + landing page.
    configureExpoAndLanding(app);
    const server = await registerRoutes(app);
    setupErrorHandler(app);
    listen(server);
    return;
  }

  // Development: run the app as a web preview in the browser. The API is served
  // here on /api/*, the mobile (Expo Go) manifest stays on the expo-platform
  // header with its QR landing moved to /mobile, and everything else is proxied
  // to the Expo web dev server.
  startMetroWeb();
  configureExpoAndLanding(app, { landingPath: "/mobile" });
  const server = await registerRoutes(app);
  setupWebProxy(app, server);
  setupErrorHandler(app);
  listen(server);
})();
