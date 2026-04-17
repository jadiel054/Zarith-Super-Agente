import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
// @ts-ignore - Evita erro de importação se o caminho for resolvido apenas no build
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

// Rota principal da API
app.use("/api", router);

// Middleware de Erro Corrigido para TypeScript (Resolve o erro TS2339)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode: number = err.status ?? err.statusCode ?? 500;
  
  // Usamos (res as any) para garantir que o compilador da Vercel não trave no .status
  return (res as any).status(statusCode).json({ 
    error: err.message ?? "Internal server error" 
  });
});

export default app;
