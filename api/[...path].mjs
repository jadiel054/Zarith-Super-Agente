import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

export default async function handler(req, res) {
  try {
    // Este caminho abaixo foi confirmado pelo seu log de build (pelo artifacts/api-server)
    const module = await import("../artifacts/api-server/dist/index.mjs");
    const router = module.default || module.router || module;

    app.use("/api", router);
    return app(req, res);
  } catch (e) {
    console.error("ERRO:", e.message);
    res.status(500).json({ error: e.message });
  }
}
