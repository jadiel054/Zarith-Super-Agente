import express from "express";
import cors from "cors";
// Ajustado para apontar para a pasta de build (dist)
import router from "../artifacts/api-server/dist/index.mjs"; 

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

// Middleware de Erro
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({ 
    error: err.message || "Internal server error" 
  });
});

export default app;
