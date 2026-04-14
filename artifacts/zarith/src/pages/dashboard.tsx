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

  useEffect(() => {
    if (prevPending.current && !sendMessage.isPending && chatHistory) {
      const lastMsg = [...chatHistory].reverse().find((m: any) => m.role === "assistant");
      if (lastMsg) {
        setLastResponseId(lastMsg.id);
        setQuickLastResponse(lastMsg.content);
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
      {/* ── Mobile top area ────────────────────────────────────── */}
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

      {/* Mobile quick command */}
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

      {/* ── Desktop layout ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-row flex-1 gap-6 overflow-hidden">
        {/* Left panel: Orb + Stats + Quick Command */}
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

          {/* Stats */}
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

          {/* Quick Command — desktop (below stats) */}
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

        {/* Chat panel */}
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

      {/* Chat — mobile */}
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

// ── Quick Command widget ─────────────────────────────────────────────────────

interface QuickCommandProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  lastResponse: string | null;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  className?: string;
}

function QuickCommand({
  value, onChange, onSubmit, isPending, lastResponse, focused, onFocus, onBlur, className,
}: QuickCommandProps) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div
        className={`bg-black rounded-sm border transition-all duration-300 relative overflow-hidden ${
          focused
            ? "border-primary shadow-[0_0_16px_rgba(0,255,255,0.35)]"
            : "border-primary/20 hover:border-primary/40"
        }`}
      >
        {focused && (
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        )}
        <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
          <Zap className={`w-3 h-3 shrink-0 transition-colors ${focused ? "text-primary" : "text-primary/40"}`} />
          <span className={`text-[9px] font-mono uppercase tracking-widest transition-colors ${focused ? "text-primary" : "text-primary/40"}`}>
            Quick Command
          </span>
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2 px-3 pb-3">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Execute a directive..."
            disabled={isPending}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-primary placeholder:text-primary/25 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !value.trim()}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-sm bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-black disabled:opacity-30 transition-all"
          >
            {isPending ? (
              <motion.div
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </button>
        </form>
      </div>

      {/* Last response preview */}
      <AnimatePresence>
        {lastResponse && (
          <motion.div
            key="response"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/5 border border-secondary/20 rounded-sm px-3 py-2">
              <p className="text-[9px] font-mono text-secondary/60 uppercase tracking-widest mb-1">Zarith // Last Response</p>
              <p className="text-xs font-mono text-secondary line-clamp-3">{lastResponse}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Chat Panel ───────────────────────────────────────────────────────────────

interface ChatPanelProps {
  chatHistory: any;
  isPending: boolean;
  networkError: string | null;
  onDismissError: () => void;
  input: string;
  setInput: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  lastResponseId: number | null;
  className?: string;
}

function ChatPanel({
  chatHistory, isPending, networkError, onDismissError,
  input, setInput, onSend, scrollRef, lastResponseId, className,
}: ChatPanelProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`flex flex-col bg-black border border-primary/20 rounded-sm relative overflow-hidden ${className ?? ""}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="p-3 border-b border-primary/20 flex items-center gap-2 bg-primary/5 shrink-0">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono text-primary uppercase tracking-widest">Direct Link Active</span>
      </div>

      {/* Network error banner */}
      <AnimatePresence>
        {networkError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="flex items-start gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/30">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="flex-1 text-xs font-mono text-destructive break-all">{networkError}</p>
              <button onClick={onDismissError} className="text-destructive/60 hover:text-destructive shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {chatHistory?.map((msg: any) => {
              const isJustArrived = msg.role === "assistant" && msg.id === lastResponseId;
              const isErrorMsg = msg.role === "assistant" && msg.content?.startsWith("⚠️");
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                    {msg.role === "user" ? "Operator" : "Zarith"} // {format(new Date(msg.createdAt), "HH:mm:ss")}
                  </span>
                  <motion.div
                    animate={isJustArrived ? {
                      boxShadow: [
                        "0 0 0px rgba(0,255,255,0)",
                        "0 0 18px rgba(0,255,255,0.6)",
                        "0 0 8px rgba(0,255,255,0.3)",
                        "0 0 0px rgba(0,255,255,0)",
                      ],
                    } : {}}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className={`p-3 max-w-[85%] rounded-sm font-mono text-xs sm:text-sm break-words ${
                      msg.role === "user"
                        ? "bg-primary/10 border border-primary/30 text-primary"
                        : isErrorMsg
                          ? "bg-destructive/10 border border-destructive/40 text-destructive"
                          : "bg-secondary/10 border border-secondary/30 text-secondary"
                    }`}
                  >
                    {msg.content}
                  </motion.div>
                </motion.div>
              );
            })}

            {isPending && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-start"
              >
                <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                  Zarith // Processing
                </span>
                <div className="p-3 max-w-[80%] rounded-sm font-mono text-sm bg-secondary/5 border border-secondary/20 text-secondary/70 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-3 bg-secondary/70 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3], scaleY: [0.6, 1, 0.6] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  Processando diretiva...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div
        className={`p-3 sm:p-4 border-t bg-black shrink-0 transition-all duration-300 ${
          focused ? "border-primary/50 shadow-[0_-4px_20px_rgba(0,255,255,0.08)]" : "border-primary/20"
        }`}
      >
        <form onSubmit={onSend} className="flex gap-2 sm:gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Enter command directive..."
            data-testid="input-chat"
            disabled={isPending}
            className={`flex-1 bg-primary/5 font-mono text-primary placeholder:text-primary/30 rounded-sm h-10 sm:h-12 text-sm transition-all duration-300 disabled:opacity-60 ${
              focused
                ? "border-primary shadow-[0_0_12px_rgba(0,255,255,0.25)] ring-1 ring-primary/30"
                : "border-primary/30 focus-visible:ring-primary"
            }`}
          />
          <Button
            type="submit"
            disabled={isPending || !input.trim()}
            data-testid="button-send-message"
            className="h-10 sm:h-12 w-10 sm:w-12 p-0 bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black rounded-sm transition-all shrink-0 disabled:opacity-40"
          >
            {isPending ? (
              <motion.div
                className="w-3 h-3 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            ) : (
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
