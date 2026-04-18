import express from "express";
import cors from "cors";

// Forçamos o import de forma que o Node.js encontre o arquivo gerado pelo build
let router;
try {
  // Tentativa de carregar o arquivo compilado
  const module = await import("../artifacts/api-server/dist/index.mjs");
  router = module.default || module.router || module;
} catch (e) {
  console.error("ERRO CRÍTICO NO CARREGAMENTO DO ROUTER:", e.message);
}

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
}));

app.use(express.json({ limit: "10mb" }));

// Middleware para diagnosticar se o router existe antes de tentar usá-lo
app.use((req, res, next) => {
  if (!router) {
    return res.status(500).json({ 
      error: "O servidor não conseguiu carregar as rotas internas. Verifique os logs de build." 
    });
  }
  next();
});

// Rota principal
app.use("/api", router);

export default app;
