import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

// Middleware básico de JSON (nativo do Express, não precisa de body-parser)
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: "Zarith Online", engine: "Claude-3.5-Sonnet" });
});

// --- MIDDLEWARE DE ERRO QUE A ZARITH SUGERIU ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ [Zarith Monitor]:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Erro interno no sistema da Zarith.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor da Zarith ativo na porta ${PORT}`);
});

export default app;
