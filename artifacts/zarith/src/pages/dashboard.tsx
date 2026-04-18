import { useState, useEffect, useCallback } from "react";
import { Send, Volume2, Brain, Terminal, Loader2, Sparkles, Settings2, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  // MELHORIA 1: Sincronização real com o Painel de Configurações
  const getStoredKeys = useCallback(() => {
    try {
      // Tenta as duas chaves comuns que o seu sistema pode estar usando
      const data = localStorage.getItem("zarith-api-keys") || localStorage.getItem("zarith-settings");
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
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
      const keys = getStoredKeys();
      
      // MELHORIA 2: Rota dinâmica baseada no Deploy atual
      const res = await fetch(`${window.location.origin}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Email": user?.email || "",
          // Injeta as chaves do painel diretamente no cabeçalho
          "X-Gemini-Key": keys.gemini || keys.geminiKey || "",
          "X-OpenAI-Key": keys.openai || keys.openaiKey || "",
          "X-Claude-Key": keys.claude || keys.claudeKey || ""
        },
        body: JSON.stringify({ 
          message: val, 
          model: keys.selectedModel || "GEMINI", 
          context: messages.slice(-3) 
        })
      });

      // MELHORIA 3: Tratamento de Erro 500 (O erro do seu log)
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Servidor offline ou erro 500: ${errorData.slice(0, 30)}`);
      }

      const data = await res.json();
      
      // MELHORIA 4: Varredura profunda por conteúdo (evita o "Sem Resposta")
      const aiBlocks = data.blocks || 
                       (data.text ? [{ type: "text", content: data.text }] : 
                       data.response ? [{ type: "text", content: data.response }] : 
                       null);

      const aiMsg: LocalMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        blocks: aiBlocks || [{ 
          type: "error", 
          content: "Zarith recebeu o pacote, mas o cérebro retornou vazio. Verifique se as APIs no painel estão salvas corretamente." 
        }],
        timestamp: new Date()
      };

      setMessages(p => [...p, aiMsg]);

    } catch (e: any) {
      setMessages(p => [...p, { 
        id: "err", 
        role: "assistant", 
        blocks: [{ type: "error", content: `FALHA CRÍTICA: ${e.message}` }], 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-100 font-mono">
      {/* HEADER */}
      <div className="p-4 bg-zinc-950/80 border-b border-primary/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={cn("h-2 w-2 rounded-full", loading ? "bg-yellow-500 animate-pulse" : "bg-primary")} />
          <span className="text-[10px] tracking-[0.2em] text-primary/60 uppercase">Zarith Core v2.5</span>
        </div>
        <div className="flex gap-4 opacity-40">
           <ShieldCheck className="h-4 w-4" />
           <Settings2 className="h-4 w-4 cursor-pointer hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-center py-10 relative">
           <Orb status={isSpeaking ? "speaking" : loading ? "thinking" : "idle"} size="lg" />
           <AnimatePresence>
             {loading && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                 className="absolute bottom-2 text-[10px] text-primary/40"
               >
                 PROCESSANDO NEURÔNIOS...
               </motion.div>
             )}
           </AnimatePresence>
        </div>
        
        <ScrollArea className="flex-1 px-6">
          <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {messages.map(m => (
              <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                {m.content && (
                  <div className="mb-3 p-3 bg-primary/5 border border-primary/20 text-primary text-xs rounded-sm max-w-[90%] shadow-[0_0_15px_rgba(var(--primary),0.1)]">
                    <span className="opacity-40 mr-2 font-bold">{">"}</span>{m.content}
                  </div>
                )}
                {m.blocks?.map((b, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-4 mb-3 border rounded-sm w-full",
                      b.type === "thinking" ? "bg-zinc-900/30 border-white/5 text-white/30 italic" : 
                      b.type === "error" ? "bg-red-950/20 border-red-500/50 text-red-400" :
                      "bg-zinc-900/60 border-white/10 text-white/90 shadow-2xl"
                    )}
                  >
                    <div className="flex gap-3">
                      {b.type === "thinking" ? <Brain className="h-4 w-4 shrink-0 opacity-20" /> : 
                       b.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> :
                       <Terminal className="h-4 w-4 shrink-0 text-primary/70" />}
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

      {/* INPUT */}
      <div className="p-6 bg-zinc-950 border-t border-white/5">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-primary/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
          <div className="relative flex gap-2">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && onSendMessage(input)}
              placeholder="ENVIAR DIRETRIZ..." 
              className="bg-black border-white/10 text-primary placeholder:text-white/5 h-12 focus-visible:ring-primary/50"
            />
            <Button 
              onClick={() => onSendMessage(input)} 
              disabled={loading}
              className="bg-primary hover:bg-primary/80 text-black font-bold px-8 h-12"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
          }
    
