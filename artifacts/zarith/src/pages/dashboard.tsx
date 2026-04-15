import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Zap, AlertTriangle, X, Volume2 } from "lucide-react";
import {
  useGetDashboardSummary,
  useGetChatHistory,
  useSendMessage,
  getGetChatHistoryQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

// --- INTERFACE E FUNÇÃO DE VOZ ---
interface MessageSegment {
  type: 'text' | 'emotion';
  content: string;
}

const speak = (segments: MessageSegment[], onStart?: () => void, onEnd?: () => void) => {
  if (!window.speechSynthesis || !segments.length) return;
  
  window.speechSynthesis.cancel();
  if (onStart) onStart();

  let currentIndex = 0;
  const playNext = () => {
    if (currentIndex >= segments.length) {
      if (onEnd) onEnd();
      return;
    }

    const segment = segments[currentIndex];
    currentIndex++;

    if (segment.type === 'text') {
      const utterance = new SpeechSynthesisUtterance(segment.content);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.includes('Google Maria') || v.name.includes('Luciana'));
      if (femaleVoice) utterance.voice = femaleVoice;

      utterance.onend = playNext;
      utterance.onerror = playNext;
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(playNext, 800); 
    }
  };
  playNext();
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: summary } = useGetDashboardSummary();
  const { data: chatHistory } = useGetChatHistory();
  const sendMessage = useSendMessage();

  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPending = useRef(false);

  const agentStatus = sendMessage.isPending ? "thinking" : (summary?.agentStatus as any) || "idle";

  // Monitor de Resposta Automática
  useEffect(() => {
    if (prevPending.current && !sendMessage.isPending && chatHistory) {
      const segments = (sendMessage.data as any)?.segments;
      if (segments) {
        speak(segments, () => setIsSpeaking(true), () => setIsSpeaking(false));
      }
    }
    prevPending.current = sendMessage.isPending;
  }, [sendMessage.isPending, chatHistory]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    // "Acorda" o áudio no clique do usuário (necessário para celular)
    const silent = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(silent);

    const message = input.trim();
    setInput("");
    sendMessage.mutate(
      { data: { content: message } },
      { 
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (err: any) => setNetworkError(err?.message || "Erro na conexão")
      }
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden p-3 sm:p-6 gap-4 bg-black text-white font-mono">
      
      {/* Orb de Status */}
      <div className="flex flex-col items-center py-4 border border-primary/20 bg-black/50 rounded-lg">
        <Orb status={isSpeaking ? "speaking" : agentStatus} size="lg" />
        <span className="mt-2 text-[10px] tracking-[0.2em] text-primary uppercase animate-pulse">
          {isSpeaking ? "Zarith Speaking" : agentStatus}
        </span>
      </div>

      {/* Área de Chat */}
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4">
          {chatHistory?.map((msg: any) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-sm border ${msg.role === 'user' ? 'bg-primary/10 border-primary/30' : 'bg-black border-white/10'}`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                
                {msg.role === 'assistant' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => speak([{ type: 'text', content: msg.content }], () => setIsSpeaking(true), () => setIsSpeaking(false))}
                    className="mt-2 h-7 w-7 p-0 text-primary hover:bg-primary/20"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {sendMessage.isPending && <div className="text-primary animate-pulse text-xs">ZARITH ESTÁ PENSANDO...</div>}
        </div>
      </ScrollArea>

      {/* Input de Comando */}
      <form onSubmit={handleSend} className="relative group">
        <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all" />
        <div className="relative flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua diretriz para a Zarith..."
            className="bg-black border-primary/30 focus:border-primary text-primary placeholder:text-primary/30 h-12"
          />
          <Button type="submit" disabled={sendMessage.isPending} className="h-12 w-12 bg-primary hover:bg-primary/80">
            <Send className="h-5 w-5 text-black" />
          </Button>
        </div>
      </form>

      {networkError && (
        <div className="text-red-500 text-[10px] flex items-center gap-2">
          <AlertTriangle className="h-3 w-3" /> {networkError}
        </div>
      )}
    </div>
  );
            }
