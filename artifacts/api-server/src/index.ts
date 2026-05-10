import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
}));

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
  logger.info(`🚀 Servidor da Zarith ativo na porta ${PORT}`);
});

export default app;
