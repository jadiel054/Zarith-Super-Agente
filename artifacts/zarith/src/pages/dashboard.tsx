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

// --- FUNÇÃO DE VOZ DA ZARITH ---
const speak = (text: string) => {
  if (!window.speechSynthesis) return;
  
  // Cancela falas anteriores para não encavalar
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.1; // Velocidade levemente acelerada (estilo IA)
  utterance.pitch = 1.0;

  // Tenta selecionar uma voz feminina se disponível no celular
  const voices = window.speechSynthesis.getVoices();
  const femaleVoice = voices.find(v => v.name.includes('Google Maria') || v.name.includes('Luciana') || v.name.includes('Female'));
  if (femaleVoice) utterance.voice = femaleVoice;

  window.speechSynthesis.speak(utterance);
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
  const prevPending = useRef(false);

  const agentStatus = sendMessage.isPending ? "thinking" : (summary?.agentStatus as any) || "idle";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, sendMessage.isPending]);

  // --- MONITOR DE RESPOSTA (ONDE A VOZ É ATIVADA) ---
  useEffect(() => {
    if (prevPending.current && !sendMessage.isPending && chatHistory) {
      const lastMsg = [...chatHistory].reverse().find((m: any) => m.role === "assistant");
      if (lastMsg) {
        setLastResponseId(lastMsg.id);
        setQuickLastResponse(lastMsg.content);
        
        // DISPARA A VOZ AQUI
        speak(lastMsg.content);
      }
      const timer = setTimeout(() => setLastResponseId(null), 2500);
      return () => clearTimeout(timer);
    }
    prevPending.current = sendMessage.isPending;
  }, [sendMessage.isPending, chatHistory]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleMutationError = (err: unknown) => {
    const e = err as any;
    const msg =
      e?.data?.error ??
      e?.data?.message ??
      e?.message ??
      "Falha ao enviar mensagem. Verifique a conexão com o servidor.";
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
      {/* Restante do layout permanece igual */}
      <div className="flex lg:hidden items-center gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Orb status={agentStatus} size="sm" />
          <span className="text-[9px] font-mono text-primary uppercase tracking-widest animate-pulse">
            {agentStatus}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          {[
            { label: "Active", value: summary?.inProgressTasks ?? 0, color: "text-secondary" },
            { label: "Pending", value: summary?.pendingTasks ?? 0, color: "text-secondary" },
            { label: "Done", value: summary?.completedTasks ?? 0, color: "text-primary" },
            { label: "Msgs", value: summary?.totalMessages ?? 0, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black border border-primary/20 rounded-sm p-2">
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">{label}</p>
              <p className={`text-lg font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <QuickCommand
        value={quickInput}
        onChange={setQuickInput}
        onSubmit={handleQuickSend}
        isPending={sendMessage.isPending}
        lastResponse={quickLastResponse}
        focused={quickFocused}
        onFocus={() => setQuickFocused(true)}
        onBlur={() => setQuickFocused(false)}
        className="lg:hidden"
      />

      <div className="hidden lg:flex lg:flex-row flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col gap-4">
          <div className="bg-black border border-primary/20 rounded-sm p-6 flex flex-col items-center justify-center relative overflow-hidden flex-1 min-h-[260px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <Orb status={agentStatus} size="lg" className="mb-6" />
            <div className="text-center font-mono">
              <h2 className="text-primary text-xl font-bold tracking-widest mb-1">ZARITH_CORE</h2>
              <p className="text-muted-foreground text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                Status: <span className="text-primary animate-pulse">{agentStatus}</span>
              </p>
            </div>
          </div>

          <div className="bg-black border border-primary/20 rounded-sm p-4 grid grid-cols-2 gap-4">
            {[
              { label: "Active Tasks", value: summary?.inProgressTasks ?? 0, color: "text-secondary" },
              { label: "Pending", value: summary?.pendingTasks ?? 0, color: "text-secondary" },
              { label: "Completed", value: summary?.completedTasks ?? 0, color: "text-muted-foreground" },
              { label: "Messages", value: summary?.totalMessages ?? 0, color: "text-primary" },
            ].map(({ label, value, color }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{label}</p>
                <p className={`text-2xl font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <QuickCommand
            value={quickInput}
            onChange={setQuickInput}
            onSubmit={handleQuickSend}
            isPending={sendMessage.isPending}
            lastResponse={quickLastResponse}
            focused={quickFocused}
            onFocus={() => setQuickFocused(true)}
            onBlur={() => setQuickFocused(false)}
          />
        </div>

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

// ... (Subcomponentes QuickCommand e ChatPanel permanecem os mesmos do seu código)
// Apenas garanta que eles estão abaixo do export default Dashboard no arquivo.
          
