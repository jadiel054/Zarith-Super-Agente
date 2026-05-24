import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

// CORS: allow configured origins + localhost in dev
const allowedOrigins = new Set<string>([
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const envOrigin = process.env.CORS_ORIGIN;
if (envOrigin) {
  envOrigin.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => allowedOrigins.add(o));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // In dev, allow all
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      callback(new Error(`CORS: origem não permitida — ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
  })
);

app.use(express.json({ limit: "10mb" }));

app.use("/api", router);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled error");
  res.status(err.status ?? err.statusCode ?? 500).json({
    error: err.message ?? "Internal server error",
  });
});

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 Zarith API ativo na porta ${PORT} [${process.env.NODE_ENV ?? "development"}]`);
  if (envOrigin) logger.info(`🌐 CORS permitido para: ${envOrigin}`);
});

export default app;
