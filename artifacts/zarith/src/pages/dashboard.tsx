import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  AlertTriangle,
  Volume2,
  Copy,
  Check,
  Brain,
  Zap,
  Terminal,
  CheckCircle2,
  XCircle,
  Power,
  Github,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  FolderOpen,
  FileCode2,
  Wrench,
} from "lucide-react";
import {
  useGetDashboardSummary,
  getGetChatHistoryQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ModelId = "GEMINI" | "CLAUDE" | "OPENAI" | "GROQ";

const MODEL_CONFIG: Record<ModelId, { label: string; color: string; dot: string }> = {
  GEMINI: { label: "Gemini", color: "text-blue-400 border-blue-400/40 bg-blue-400/10", dot: "bg-blue-400" },
  CLAUDE: { label: "Claude", color: "text-orange-400 border-orange-400/40 bg-orange-400/10", dot: "bg-orange-400" },
  OPENAI: { label: "GPT-4o", color: "text-green-400 border-green-400/40 bg-green-400/10", dot: "bg-green-400" },
  GROQ:   { label: "Groq", color: "text-purple-400 border-purple-400/40 bg-purple-400/10", dot: "bg-purple-400" },
};

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
  isStreaming?: boolean;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks?: Block[];
  timestamp: Date;
}

function BlockIcon({ type }: { type: Block["type"] }) {
  switch (type) {
    case "thinking": return <Brain className="h-3 w-3 shrink-0 mt-0.5 text-white/30" />;
    case "action":   return <Github className="h-3 w-3 shrink-0 mt-0.5 text-primary" />;
    case "result":   return <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-green-400" />;
    case "error":    return <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-red-400" />;
    case "text":     return <Terminal className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />;
    default:         return null;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-white/20 hover:text-primary hover:bg-primary/10 transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SpeakerButton({ text, email, onStart, onEnd }: { text: string; email: string | null; onStart: () => void; onEnd: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleSpeak = async () => {
    if (loading) return;
    setLoading(true); onStart();
    try {
      const res = await fetch(`${API_BASE}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(email ? { "X-User-Email": email } : {}) },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { onEnd(); URL.revokeObjectURL(url); setLoading(false); };
        audio.onerror = () => { onEnd(); URL.revokeObjectURL(url); setLoading(false); fallbackSpeak(text, onEnd); };
        audio.play();
      } else { fallbackSpeak(text, onEnd); setLoading(false); }
    } catch { fallbackSpeak(text, onEnd); setLoading(false); }
  };
  return (
    <button onClick={handleSpeak} disabled={loading} className="p-1 rounded text-white/20 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
    </button>
  );
}

function fallbackSpeak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR"; u.rate = 1.1;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((vv) => vv.name.includes("Google Maria") || vv.name.includes("Luciana"));
  if (v) u.voice = v;
  u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

function MessageBlock({ block, email, onSpeakStart, onSpeakEnd }: { block: Block; email: string | null; onSpeakStart: () => void; onSpeakEnd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-sm border p-3 font-mono text-xs group relative",
        block.type === "thinking" && "bg-black/40 border-white/5 text-white/40",
        block.type === "action"   && "bg-primary/5 border-primary/20 text-primary",
        block.type === "result"   && "bg-green-950/20 border-green-500/20 text-green-400",
        block.type === "error"    && "bg-red-950/20 border-red-500/20 text-red-400",
        block.type === "text"     && "bg-black border-white/10 text-white/90"
      )}
    >
      <div className="flex items-start gap-2">
        <BlockIcon type={block.type} />
        <p className="flex-1 leading-relaxed whitespace-pre-wrap break-words min-w-0">
          {block.content}
          {block.isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-primary ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      </div>
      {!block.isStreaming && (
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
          {block.model && <span className="text-[9px] text-white/20 uppercase tracking-widest">{block.model}</span>}
          <div className="flex gap-0.5 ml-auto">
            <CopyButton text={block.content} />
            {(block.type === "text" || block.type === "result") && (
              <SpeakerButton text={block.content} email={email} onStart={onSpeakStart} onEnd={onSpeakEnd} />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ControlPanel({ isAiActive, onToggleActive, selectedModel, onSelectModel }: {
  isAiActive: boolean; onToggleActive: () => void; selectedModel: ModelId | null; onSelectModel: (m: ModelId | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-primary/15 bg-black/80 rounded-sm overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", isAiActive ? "bg-primary animate-pulse" : "bg-red-500")} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary/70">Painel de Controle</span>
          <span className={cn("text-[9px] font-mono px-2 py-0.5 border rounded-sm uppercase",
            selectedModel ? MODEL_CONFIG[selectedModel].color : "text-white/30 border-white/10")}>
            {selectedModel ? MODEL_CONFIG[selectedModel].label : "AUTO"}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-primary/40" /> : <ChevronDown className="h-3 w-3 text-primary/40" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-primary/10">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Status IA</span>
                <button onClick={onToggleActive} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-mono uppercase transition-all",
                  isAiActive ? "bg-primary/10 border-primary/30 text-primary hover:bg-red-950/20 hover:border-red-500/30 hover:text-red-400"
                             : "bg-red-950/20 border-red-500/30 text-red-400 hover:bg-primary/10 hover:border-primary/30 hover:text-primary")}>
                  <Power className="h-3 w-3" />{isAiActive ? "ONLINE — Desativar" : "OFFLINE — Ativar"}
                </button>
              </div>
              <div>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Modelo (clique para selecionar | vazio = AUTO)</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MODEL_CONFIG) as ModelId[]).map((model) => (
                    <button key={model} onClick={() => onSelectModel(selectedModel === model ? null : model)}
                      className={cn("text-[10px] font-mono px-3 py-1 border rounded-sm uppercase transition-all flex items-center gap-1.5",
                        selectedModel === model ? MODEL_CONFIG[model].color + " font-bold" : "bg-black/50 text-white/30 border-white/10 hover:border-white/30 hover:text-white/60")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", selectedModel === model ? MODEL_CONFIG[model].dot : "bg-white/20")} />
                      {MODEL_CONFIG[model].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-white/20">
                <div className="flex items-center gap-1.5"><Search className="h-2.5 w-2.5" />Busca de código</div>
                <div className="flex items-center gap-1.5"><FolderOpen className="h-2.5 w-2.5" />Multi-arquivo</div>
                <div className="flex items-center gap-1.5"><FileCode2 className="h-2.5 w-2.5" />Scaffolding completo</div>
                <div className="flex items-center gap-1.5"><Wrench className="h-2.5 w-2.5" />Auto-correção de erros</div>
              </div>
              <p className="text-[9px] font-mono text-white/20 leading-relaxed">Fallback: Gemini → Claude → GPT-4o → Groq. 429 auto-switch ativo.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { email } = useAuth();
  const { data: summary } = useGetDashboardSummary();

  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId | null>(null);
  const [isAiActive, setIsAiActive] = useState(true);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [streamingBlocks, setStreamingBlocks] = useState<Block[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingBlocks, scrollToBottom]);

  const parseBlocks = (content: string): Block[] | null => {
    try {
      const p = JSON.parse(content);
      if (Array.isArray(p) && p.length > 0 && p[0].type) return p as Block[];
    } catch {}
    return null;
  };

  const agentStatus = isStreaming ? "thinking" : (summary?.agentStatus as any) || "idle";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");
    setNetworkError(null);

    const userMsg: LocalMessage = { id: `user-${Date.now()}`, role: "user", content: message, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setStreamingBlocks([]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const resp = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(email ? { "X-User-Email": email } : {}),
        },
        body: JSON.stringify({ content: message, selectedModel: selectedModel ?? null, isAiActive }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      let activeBlocks: Block[] = [];
      let currentStreamingIdx = -1;

      const updateBlocks = (blocks: Block[]) => {
        activeBlocks = [...blocks];
        setStreamingBlocks([...activeBlocks]);
        scrollToBottom();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = sseBuffer.indexOf("\n\n")) !== -1) {
          const raw = sseBuffer.slice(0, idx);
          sseBuffer = sseBuffer.slice(idx + 2);

          let evName = "";
          let dataStr = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) evName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (evName === "block") {
              const block: Block = { ...data, isStreaming: false };
              updateBlocks([...activeBlocks, block]);
            } else if (evName === "block_start") {
              const block: Block = { type: data.type, content: "", model: data.model, isStreaming: true };
              currentStreamingIdx = activeBlocks.length;
              updateBlocks([...activeBlocks, block]);
            } else if (evName === "token" && currentStreamingIdx >= 0) {
              const blocks = [...activeBlocks];
              if (blocks[currentStreamingIdx]) {
                blocks[currentStreamingIdx] = { ...blocks[currentStreamingIdx], content: blocks[currentStreamingIdx].content + data.text };
              }
              activeBlocks = blocks;
              setStreamingBlocks([...activeBlocks]);
            } else if (evName === "block_end" && currentStreamingIdx >= 0) {
              const blocks = [...activeBlocks];
              if (blocks[currentStreamingIdx]) {
                blocks[currentStreamingIdx] = { ...blocks[currentStreamingIdx], isStreaming: false };
              }
              activeBlocks = blocks;
              currentStreamingIdx = -1;
              updateBlocks([...activeBlocks]);
            } else if (evName === "done") {
              if (data.shouldSpeak && data.text && email) {
                setIsSpeaking(true);
                fetch(`${API_BASE}/api/voice/speak`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-User-Email": email },
                  body: JSON.stringify({ text: data.text }),
                }).then(async (r) => {
                  if (!r.ok) throw new Error("voice unavailable");
                  const blob = await r.blob();
                  const url = URL.createObjectURL(blob);
                  const audio = new Audio(url);
                  audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                  audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                  audio.play();
                }).catch(() => {
                  setIsSpeaking(false);
                  if (data.text) fallbackSpeak(data.text, () => setIsSpeaking(false));
                });
              }
            }
          } catch {}
        }
      }

      const finalBlocks = activeBlocks.map((b) => ({ ...b, isStreaming: false }));
      const aiMsg: LocalMessage = { id: `ai-${Date.now()}`, role: "assistant", blocks: finalBlocks, timestamp: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
      setStreamingBlocks([]);
      queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      inputRef.current?.focus();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setNetworkError(err?.message || "Erro na conexão com o servidor.");
        if (streamingBlocks.length > 0) {
          const aiMsg: LocalMessage = { id: `ai-${Date.now()}`, role: "assistant", blocks: streamingBlocks.map((b) => ({ ...b, isStreaming: false })), timestamp: new Date() };
          setMessages((prev) => [...prev, aiMsg]);
        }
        setStreamingBlocks([]);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (streamingBlocks.length > 0) {
      const aiMsg: LocalMessage = { id: `ai-${Date.now()}`, role: "assistant", blocks: streamingBlocks.map((b) => ({ ...b, isStreaming: false })), timestamp: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
      setStreamingBlocks([]);
    }
  };

  const displayMessages: LocalMessage[] = messages;
  const hasActiveStream = isStreaming && streamingBlocks.length > 0;

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden p-3 sm:p-4 gap-3 bg-black text-white font-mono">
      <div className="flex gap-3 items-start">
        <div className="flex flex-col items-center py-3 px-4 border border-primary/20 bg-black/50 rounded-sm min-w-[100px]">
          <Orb status={isSpeaking ? "speaking" : agentStatus} size="sm" />
          <span className="mt-1.5 text-[9px] tracking-[0.2em] text-primary uppercase animate-pulse">
            {isSpeaking ? "Speaking" : isStreaming ? "Streaming" : agentStatus}
          </span>
        </div>
        <div className="flex-1">
          <ControlPanel isAiActive={isAiActive} onToggleActive={() => setIsAiActive((v) => !v)} selectedModel={selectedModel} onSelectModel={setSelectedModel} />
        </div>
      </div>

      <ScrollArea className="flex-1 rounded-sm border border-white/5 bg-black/30">
        <div className="p-3 space-y-4 min-h-full">
          <AnimatePresence initial={false}>
            {displayMessages.length === 0 && !isStreaming && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-8 w-8 text-primary/20 mb-3" />
                <p className="text-xs font-mono text-white/20 uppercase tracking-widest">ZARITH AGUARDANDO DIRETRIZ</p>
                <p className="text-[10px] font-mono text-white/10 mt-1">
                  {selectedModel ? `Modelo: ${MODEL_CONFIG[selectedModel].label}` : "Modo AUTO — Gemini → Claude → GPT-4o → Groq"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 max-w-xs">
                  {["Crie um projeto React completo", "Analise e corrija erros neste código:", "Autocode: melhore o sistema de auth", "Crie uma API REST com Express"].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="text-[9px] font-mono text-white/20 border border-white/5 rounded-sm px-2 py-1.5 hover:border-primary/30 hover:text-primary/50 transition-all text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {displayMessages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex flex-col gap-1.5", msg.role === "user" ? "items-end" : "items-start")}>
                <span className="text-[9px] font-mono text-white/20 px-1 uppercase tracking-widest">
                  {msg.role === "user" ? "OPERADOR" : "ZARITH"}
                </span>
                {msg.role === "user" ? (
                  <div className="max-w-[80%] px-4 py-2.5 rounded-sm border border-primary/30 bg-primary/5 group">
                    <p className="text-sm leading-relaxed text-primary/90">{msg.content}</p>
                    <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={msg.content ?? ""} />
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[95%] space-y-1.5">
                    {msg.blocks && msg.blocks.length > 0 ? (
                      msg.blocks.map((block, i) => (
                        <MessageBlock key={i} block={block} email={email} onSpeakStart={() => setIsSpeaking(true)} onSpeakEnd={() => setIsSpeaking(false)} />
                      ))
                    ) : (
                      <div className="rounded-sm border border-white/10 bg-black p-3 group">
                        <div className="flex items-start gap-2">
                          <Terminal className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
                          <p className="flex-1 text-xs leading-relaxed whitespace-pre-wrap text-white/90">{msg.content}</p>
                        </div>
                        <div className="flex justify-end gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={msg.content ?? ""} />
                          <SpeakerButton text={msg.content ?? ""} email={email} onStart={() => setIsSpeaking(true)} onEnd={() => setIsSpeaking(false)} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {hasActiveStream && (
              <motion.div key="streaming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-start gap-1.5">
                <span className="text-[9px] font-mono text-white/20 px-1 uppercase tracking-widest">ZARITH</span>
                <div className="w-full max-w-[95%] space-y-1.5">
                  {streamingBlocks.map((block, i) => (
                    <MessageBlock key={i} block={block} email={email} onSpeakStart={() => setIsSpeaking(true)} onSpeakEnd={() => setIsSpeaking(false)} />
                  ))}
                </div>
              </motion.div>
            )}

            {isStreaming && !hasActiveStream && (
              <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-start gap-1.5">
                <span className="text-[9px] font-mono text-white/20 px-1 uppercase tracking-widest">ZARITH</span>
                <div className="rounded-sm border border-primary/10 bg-black/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-primary/40">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[10px] font-mono uppercase tracking-widest animate-pulse">
                      {selectedModel ? `${MODEL_CONFIG[selectedModel].label} inicializando...` : "Selecionando modelo..."}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="relative group">
        <div className="absolute inset-0 bg-primary/5 blur-xl group-focus-within:bg-primary/10 transition-all" />
        <div className="relative flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAiActive ? "Digite sua diretriz para a Zarith..." : "[OFFLINE] Sistema desativado..."}
            disabled={!isAiActive || isStreaming}
            className="bg-black border-primary/30 focus:border-primary text-primary placeholder:text-primary/30 h-12 font-mono text-sm"
          />
          {isStreaming ? (
            <Button type="button" onClick={handleAbort} className="h-12 w-12 bg-red-900/50 hover:bg-red-800 border border-red-500/30 shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim() || !isAiActive} className="h-12 w-12 bg-primary hover:bg-primary/80 shrink-0 disabled:opacity-40">
              <Send className="h-5 w-5 text-black" />
            </Button>
          )}
        </div>
      </form>

      <AnimatePresence>
        {networkError && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-[10px] flex items-center gap-2 font-mono px-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />{networkError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
