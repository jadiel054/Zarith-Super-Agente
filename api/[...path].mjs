import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
}));

app.use(express.json({ limit: "10mb" }));

// Handler para todas as rotas da API
export default async function handler(req, res) {
  try {
    // Importa o router dinamicamente dentro do handler
    const module = await import("../artifacts/api-server/dist/index.mjs");
    const router = module.default || module.router || module;

    // Conecta o router ao app do Express
    app.use("/api", router);
    
    // Processa a requisição
    return app(req, res);
  } catch (e) {
    console.error("ERRO NO BACKEND:", e.message);
    res.status(500).json({ error: "Falha ao carregar rotas internas", details: e.message });
  }
}
