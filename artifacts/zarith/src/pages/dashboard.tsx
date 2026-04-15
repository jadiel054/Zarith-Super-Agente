import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Zap, AlertTriangle, X } from "lucide-react";
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
import { format } from "date-fns";

// --- INTERFACE E FUNÇÃO DE VOZ DA ZARITH ---
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
      const femaleVoice = voices.find(v => 
        v.name.includes('Google Maria') || 
        v.name.includes('Luciana') || 
        v.name.includes('Female')
      );
      if (femaleVoice) utterance.voice = femaleVoice;

      utterance.onend = playNext;
      utterance.onerror = playNext;
      window.speechSynthesis.speak(utterance);
    } else {
      // EMOÇÃO: Pausa dramática para simular expressão (ex: [laugh])
      // No futuro, aqui dispararemos o áudio do modelo Bark
      console.log(`Zarith Emotion: ${segment.content}`);
      setTimeout(playNext, 1000); 
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
  const [quickInput, setQuickInput] = useState("");
  const [quickFocused, setQuickFocused] = useState(false);
  const [quickLastResponse, setQuickLastResponse] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastResponseId, setLastResponseId] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const prevPending = useRef(false);

  const agentStatus = sendMessage.isPending ? "thinking" : (summary?.agentStatus as any) || "idle";

  // Auto-scroll do chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, sendMessage.isPending]);

  // --- MONITOR DE RESPOSTA E ATIVAÇÃO DE VOZ ---
  useEffect(() => {
    if (prevPending.current && !sendMessage.isPending && chatHistory) {
      const lastMsg = [...chatHistory].reverse().find((m: any) => m.role === "assistant");
      
      // Captura os segmentos vindo do backend (JSON processado)
      const segments = (sendMessage.data as any)?.segments;

      if (segments && segments.length > 0) {
        speak(segments, () => setIsSpeaking(true), () => setIsSpeaking(false));
      } else if (lastMsg) {
        // Fallback para texto simples
        speak([{ type: 'text', content: lastMsg.content }], () => setIsSpeaking(true), () => setIsSpeaking(false));
      }

      if (lastMsg) {
        setLastResponseId(lastMsg.id);
        setQuickLastResponse(lastMsg.content);
      }
      
      const timer = setTimeout(() => setLastResponseId(null), 2500);
      return () => clearTimeout(timer);
    }
    prevPending.current = sendMessage.isPending;
  }, [sendMessage.isPending, chatHistory, sendMessage.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleMutationError = (err: unknown) => {
    const e = err as any;
    const msg = e?.data?.error ?? e?.data?.message ?? e?.message ?? "Falha ao enviar mensagem.";
    setNetworkError(msg);
    setTimeout(() => setNetworkError(null), 8000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    const message = input.trim();
    setInput("");
    setNetworkError(null);
    sendMessage.mutate(
      { data: { content: message } },
      { onSuccess: invalidate, onError: handleMutationError }
    );
  };

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim() || sendMessage.isPending) return;
    const message = quickInput.trim();
    setQuickInput("");
    setQuickLastResponse(null);
    setNetworkError(null);
    sendMessage.mutate(
      { data: { content: message } },
      { onSuccess: invalidate, onError: handleMutationError }
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden p-3 sm:p-6 gap-4">
      
      {/* HEADER MOBILE */}
      <div className="flex lg:hidden items-center gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Orb status={isSpeaking ? "speaking" : agentStatus} size="sm" />
          <span className="text-[9px] font-mono text-primary uppercase tracking-widest animate-pulse">
            {isSpeaking ? "falando..." : agentStatus}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          {[
            { label: "Active", value: summary?.inProgressTasks ?? 0, color: "text-secondary" },
            { label: "Msgs", value: summary?.totalMessages ?? 0, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black border border-primary/20 rounded-sm p-2">
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">{label}</p>
              <p className={`text-lg font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-row flex-1 gap-6 overflow-hidden">
        {/* SIDEBAR DESKTOP */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="bg-black border border-primary/20 rounded-sm p-6 flex flex-col items-center justify-center relative overflow-hidden flex-1 min-h-[260px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <Orb status={isSpeaking ? "speaking" : agentStatus} size="lg" className="mb-6" />
            <div className="text-center font-mono">
              <h2 className="text-primary text-xl font-bold tracking-widest mb-1">ZARITH_CORE</h2>
              <p className="text-muted-foreground text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Status: <span className="text-primary animate-pulse">{isSpeaking ? "SPEAKING" : agentStatus}</span>
              </p>
            </div>
          </div>

          <div className="bg-black border border-primary/20 rounded-sm p-4 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Active Tasks</p>
              <p className="text-2xl font-mono text-secondary">{summary?.inProgressTasks ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Messages</p>
              <p className="text-2xl font-mono text-primary">{summary?.totalMessages ?? 0}</p>
            </div>
          </div>
        </div>

        {/* CHAT PRINCIPAL (Desktop) */}
        <ChatPanel
          chatHistory={chatHistory}
          isPending={sendMessage.isPending}
          networkError={networkError}
          onDismissError={() => setNetworkError(null)}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          scrollRef={scrollRef}
          lastResponseId={lastResponseId}
          className="flex-1"
        />
      </div>

      {/* CHAT PRINCIPAL (Mobile) */}
      <ChatPanel
        chatHistory={chatHistory}
        isPending={sendMessage.isPending}
        networkError={networkError}
        onDismissError={() => setNetworkError(null)}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        scrollRef={scrollRef}
        lastResponseId={lastResponseId}
        className="flex-1 min-h-0 lg:hidden"
      />
    </div>
  );
}

// Nota: Certifique-se de que os componentes QuickCommand e ChatPanel 
// estão definidos ou importados corretamente no seu arquivo original.
      
