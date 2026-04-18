// ... (mantenha os imports de UI e Lucide)
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const onSendMessage = async (val: string) => {
    if (!val.trim() || loading) return;

    // Adiciona msg do usuário na tela imediatamente
    setMessages(p => [...p, { id: Date.now().toString(), role: "user", content: val, timestamp: new Date() }]);
    setInput("");
    setLoading(true);

    try {
      // 1. Pegamos as chaves que VOCÊ salvou no painel (localStorage)
      const savedSettings = localStorage.getItem("zarith-settings");
      const config = savedSettings ? JSON.parse(savedSettings) : {};

      // 2. Chamada para a API com os Headers de Elite
      const res = await fetch(`${window.location.origin}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Email": user?.email || "",
          // Enviamos as chaves para que o backend não dê erro 500 por falta de credencial
          "Authorization": `Bearer ${config.apiKey || ""}`, 
          "X-Gemini-Key": config.geminiKey || "",
          "X-OpenAI-Key": config.openaiKey || "",
          "X-Claude-Key": config.claudeKey || ""
        },
        body: JSON.stringify({ 
          message: val, 
          model: config.selectedModel || "GEMINI",
          stream: false 
        })
      });

      // Se o servidor der erro 500, capturamos aqui para não ficar "Sem Resposta"
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro no Servidor (${res.status}): ${errorText.slice(0, 50)}`);
      }

      const data = await res.json();
      
      setMessages(p => [...p, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        blocks: data.blocks || [{ type: "text", content: data.text || data.response }],
        timestamp: new Date()
      }]);

    } catch (e: any) {
      console.error("Erro Zarith:", e);
      setMessages(p => [...p, { 
        id: "err", 
        role: "assistant", 
        blocks: [{ type: "error", content: `CONEXÃO INTERROMPIDA: ${e.message}. Verifique os Logs do Vercel.` }], 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ... (mantenha o restante do retorno do componente igual ao anterior)
        }
                                                             
