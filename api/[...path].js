import express from "express";
import cors from "cors";
// Importamos o módulo inteiro para verificar como ele exporta o router
import * as routerModule from "../artifacts/api-server/dist/index.mjs";

const app = express();

// Log para te ajudar a depurar na aba "Logs" da Vercel
const router = routerModule.default || routerModule.router || routerModule;
console.log("Estado do Router:", router ? "Carregado" : "Falhou");

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
  })
);

app.use(express.json({ limit: "10mb" }));

// Rota principal - se o router for uma função/middleware, ele aplica
if (typeof router === 'function' || (router && router.stack)) {
  app.use("/api", router);
} else {
  app.get("/api/health", (req, res) => res.json({ status: "Router não é uma função válida" }));
}

// Middleware de Erro
app.use((err, req, res, next) => {
  console.error("Erro capturado:", err.message);
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({ 
    error: err.message || "Internal server error" 
  });
});

export default app;
