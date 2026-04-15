import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bodyParser from "body-parser";
// Importe suas rotas aqui (exemplo)
// import router from "./routes/chat"; 

const app = express();

// --- CONFIGURAÇÕES BÁSICAS ---
app.use(cors());
app.use(bodyParser.json());

// --- SUAS ROTAS (Exemplo de como devem ficar com next) ---
app.get("/health", (req, res) => {
  res.status(200).json({ status: "Zarith Online" });
});

// --- ONDE A MÁGICA ACONTECE (MIDDLEWARE DE ERRO GLOBAL) ---
// Adicione isso SEMPRE ao final de todas as rotas
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ [Zarith Monitor]:", err.stack);

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || "Erro interno no sistema da Zarith.",
    // Só mostra detalhes técnicos se não for produção
    error: process.env.NODE_ENV !== 'production' ? err.stack : {}
  });
});

export default app;
