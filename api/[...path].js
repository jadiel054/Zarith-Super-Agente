// @ts-nocheck
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
// O caminho abaixo precisa existir no repositório para funcionar no runtime
import router from "../artifacts/api-server/src/routes/index";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
  })
);

app.use(express.json({ limit: "10mb" }));

// Rota principal
app.use("/api", router);

// Middleware de Erro com tipagem forçada para evitar o "Emit skipped"
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  return (res as any).status(statusCode).json({ 
    error: err.message || "Internal server error" 
  });
});

export default app;
    
