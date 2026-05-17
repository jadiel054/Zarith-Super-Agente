import express from "express";
import cors from "cors";
import { createClient } from './lib/supabase.config';

const supabase = createClient();
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

export function logAgentAction(action, status, details) {
  supabase
    .from('agent_actions')
    .insert([{
      action,
      status,
      details,
    }])
    .then(() => {
      console.log('Ação registrada com sucesso!');
    })
    .catch((error) => {
      console.error('Erro ao registrar ação:', error);
    });
}

export default async function handler(req, res) {
  try {
    // Importa o servidor real compilado
    const module = await import("../artifacts/api-server/dist/index.mjs");
    const router = module.default || module.router || module;

    // IMPORTANTE: O rewrite da Vercel já manda a req para cá.
    // Usamos o router diretamente no nível raiz para evitar o erro de rota duplicada.
    const internalApp = express();
    internalApp.use(cors({ origin: true, credentials: true }));
    internalApp.use(express.json());
    
    // Conecta o roteador do seu Zarith
    internalApp.use("/", router);

    return internalApp(req, res);
  } catch (e) {
    console.error("ERRO NA PONTE:", e.message);
    res.status(500).json({ 
      error: "Zarith API Bridge Error", 
      details: e.message 
    });
  }
}