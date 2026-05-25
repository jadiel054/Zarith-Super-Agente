import dotenv from "dotenv";
dotenv.config();

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

// ── CORS ULTRA-PERMISSIVO ─────────────────────────────────────────────────────
// origin: '*' aceita qualquer origem (Vercel, Render, localhost, etc.)
// Nota: '*' é incompatível com credentials:true — autenticação via X-User-Email header
const corsOptions: cors.CorsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-User-Email",
    "X-Requested-With",
    "Accept",
  ],
  optionsSuccessStatus: 200, // Some browsers (IE11) choke on 204
};

// Responde preflight OPTIONS para todas as rotas ANTES de qualquer middleware
app.options("*", cors(corsOptions));

// Aplica CORS em todas as demais rotas
app.use(cors(corsOptions));

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── ROTAS ─────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── ERRO GLOBAL ───────────────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled error");
  res.status(err.status ?? err.statusCode ?? 500).json({
    error: err.message ?? "Internal server error",
  });
});

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 Zarith API ativo na porta ${PORT} [${process.env.NODE_ENV ?? "development"}]`);
});

export default app;
