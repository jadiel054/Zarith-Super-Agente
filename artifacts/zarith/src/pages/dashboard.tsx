import { useState, useEffect, useCallback } from "react";
import { Send, Volume2, Brain, Terminal, Loader2, Sparkles, Settings2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks?: Block[];
  timestamp: Date;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ELITE: Busca as chaves do painel para garantir que a requisição as utilize
  const getStoredKeys = useCallback(() => {
    const keys = localStorage.getItem("zarith-api-keys");
    return keys ? JSON.parse(keys) : {};
  }, []);

  const onSendMessage = async (val: string) => {
    if (!val.trim() || loading) return;

    const userMsg: LocalMessage = { 
      id: Date.now().toString(), 
      role: "user", 
      content: val, 
      timestamp: new Date() 
    };

    setMessages(p => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const userKeys = getStoredKeys();
      
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Email": user?.email || "",
          // Passamos as chaves do painel nos headers caso o backend precise delas
          "X-Gemini-Key": userKeys.gemini || "",
          "X-OpenAI-Key": userKeys.openai || "",
          "X-Claude-Key": userKeys.claude || ""
        },
        body: JSON.stringify({ 
          message: val, 
          model: "GEMINI", 
          context: messages.slice(-5) // Envia histórico recente para manter o fio da meada
        })
      });

      const data = await res.json();
      
      // Validação rigorosa da resposta para eliminar o "Sem Resposta"
      const aiContent = data.blocks || (data.text ? [{ type: "text", content: data.text }] : null);

      const aiMsg: LocalMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        blocks: aiContent || [{ 
          type: "error", 
          content: "O servidor recebeu a mensagem, mas a API do modelo não retornou dados. Verifique se a chave no painel está ativa." 
        }],
        timestamp: new Date()
      };

      setMessages(p => [...p, aiMsg]);

    } catch (e) {
      setMessages(p => [...p, { 
        id: "err", 
        role: "assistant", 
        blocks: [{ type: "error", content: "Falha de conexão com o Agente. Certifique-se que o backend está rodando no Vercel." }], 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-100 font-mono">
      {/* HEADER DE STATUS */}
      <div className="p-4 bg-zinc-950/80 border-b border-primary/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={cn("h-2 w-2 rounded-full animate-pulse", loading ? "bg-yellow-500" : "bg-primary")} />
          <span className="text-[10px] tracking-[0.2em] text-primary/60 uppercase">Zarith Core v2.5</span>
        </div>
        <div className="flex gap-4 opacity-40">
           <ShieldCheck className="h-4 w-4" />
           <Settings2 className="h-4 w-4" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-center py-10 relative">
           <Orb status={isSpeaking ? "speaking" : loading ? "thinking" : "idle"} size="lg" />
           {loading && (
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="absolute bottom-2 text-[10px] text-primary/40"
             >
               SINCRONIZANDO NEURÔNIOS...
             </motion.div>
           )}
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {messages.map(m => (
              <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                {m.content && (
                  <div className="mb-3 p-3 bg-primary/5 border border-primary/20 text-primary text-xs rounded-sm max-w-[90%]">
                    <span className="opacity-40 mr-2 font-bold">{">"}</span>{m.content}
                  </div>
                )}
                {m.blocks?.map((b, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-4 mb-3 border rounded-sm w-full transition-all",
                      b.type === "thinking" ? "bg-zinc-900/30 border-white/5 text-white/30 italic" : "bg-zinc-900/60 border-white/10 text-white/90 shadow-2xl shadow-primary/5"
                    )}
                  >
                    <div className="flex gap-3">
                      {b.type === "thinking" ? <Brain className="h-4 w-4 shrink-0 opacity-20" /> : <Terminal className="h-4 w-4 shrink-0 text-primary/70" />}
                      <div className="flex-1 space-y-2">
                        {b.model && <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">{b.model}</span>}
                        <p className="text-xs leading-relaxed">{b.content}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* INPUT ELITE */}
      <div className="p-6 bg-zinc-950 border-t border-white/5">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-primary/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
          <div className="relative flex gap-2">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && onSendMessage(input)}
              placeholder="COMANDO DE DIRETRIZ..." 
              className="bg-black border-white/10 text-primary placeholder:text-white/5 h-12"
            />
            <Button 
              onClick={() => onSendMessage(input)} 
              disabled={loading}
              className="bg-primary hover:bg-primary/80 text-black font-bold px-8 h-12 transition-all active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
                }
