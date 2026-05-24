import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Github,
  CheckCircle2,
  XCircle,
  TerminalSquare,
  SendHorizonal,
  Trash2,
  Cpu,
  Zap,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/orb";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const API_BASE = "";

type ModelId = "GEMINI" | "CLAUDE" | "OPENAI" | "AUTO";

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  blocks: Block[];
  rawContent?: string;
  timestamp: Date;
}

type OrbStatus = "idle" | "thinking" | "executing" | "speaking";

function ZarithAvatar({ isThinking }: { isThinking: boolean }) {
  return (
    <div className={cn("relative w-10 h-10 rounded-full shrink-0 overflow-hidden border-2 transition-all duration-300", isThinking ? "border-primary shadow-[0_0_16px_4px_hsl(var(--primary)/0.5)] avatar-pulsate" : "border-primary/30")}>
      <img
        src="/zarith-avatar.png"
        alt="ZARITH"
        className="w-full h-full object-cover object-top"
      />
    </div>
  );
}

function BlockIcon({ type, isRunning }: { type: Block["type"]; isRunning?: boolean }) {
  if (isRunning && type === "action") {
    return (
      <span className="shrink-0 mt-0.5">
        <l-ring size="14" stroke="2" speed="1.5" color="#00ffff" />
      </span>
    );
  }
  if (isRunning && type === "thinking") {
    return (
      <span className="shrink-0 mt-0.5">
        <l-orbit size="14" speed="1.5" color="#c084fc" />
      </span>
    );
  }
  switch (type) {
    case "thinking": return <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />;
    case "action": return <Github className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />;
    case "result": return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />;
    case "error": return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />;
    default: return <TerminalSquare className="w-3.5 h-3.5 text-foreground/70 shrink-0 mt-0.5" />;
  }
}

function BlockRow({ block, isLast, isStreaming }: { block: Block; isLast: boolean; isStreaming: boolean }) {
  const isRunning = isLast && isStreaming;
  const colorMap: Record<Block["type"], string> = {
    thinking: "text-purple-300/80 bg-purple-950/20 border-purple-500/20",
    action: "text-primary/90 bg-primary/5 border-primary/20",
    result: "text-green-300 bg-green-950/20 border-green-500/20",
    error: "text-destructive bg-destructive/5 border-destructive/20",
    text: "text-foreground/90 bg-transparent border-primary/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2 text-xs font-mono px-3 py-2 rounded border", colorMap[block.type])}
    >
      <BlockIcon type={block.type} isRunning={isRunning} />
      <span className="leading-relaxed whitespace-pre-wrap break-words min-w-0">{block.content}</span>
    </motion.div>
  );
}

function ToolsPanel({ blocks, isStreaming }: { blocks: Block[]; isStreaming: boolean }) {
  const toolBlocks = blocks.filter((b) => b.type === "action" || b.type === "result" || b.type === "error");
  if (toolBlocks.length === 0 && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-72 shrink-0 border-l border-primary/15 bg-black flex flex-col"
    >
      <div className="px-4 py-3 border-b border-primary/15 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Ferramentas Executadas</span>
        {isStreaming && (
          <span className="ml-auto">
            <l-dot-pulse size="20" speed="1.3" color="#00ffff" />
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {toolBlocks.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-start gap-2 p-2 rounded border text-[10px] font-mono",
              b.type === "action" && "border-primary/20 bg-primary/5 text-primary/90",
              b.type === "result" && "border-green-500/20 bg-green-950/20 text-green-300",
              b.type === "error" && "border-destructive/20 bg-destructive/5 text-destructive",
            )}
          >
            {b.type === "action" && isStreaming && i === toolBlocks.length - 1 ? (
              <span className="shrink-0 mt-0.5">
                <l-ring size="12" stroke="2" speed="1.5" color="#00ffff" />
              </span>
            ) : (
              <Github className="w-3 h-3 shrink-0 mt-0.5" />
            )}
            <span className="break-words min-w-0">{b.content}</span>
          </motion.div>
        ))}
        {isStreaming && toolBlocks.length === 0 && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <l-waveform size="16" stroke="2" speed="1" color="#00ffff" />
            <span>Processando...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { email } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [orbStatus, setOrbStatus] = useState<OrbStatus>("idle");
  const [selectedModel, setSelectedModel] = useState<ModelId>("AUTO");
  const [currentBlocks, setCurrentBlocks] = useState<Block[]>([]);
  const [showTools, setShowTools] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentBlocks]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      blocks: [{ type: "text", content }],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setOrbStatus("thinking");
    setCurrentBlocks([]);
    setShowTools(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(email ? { "X-User-Email": email } : {}),
        },
        body: JSON.stringify({ content, selectedModel: selectedModel === "AUTO" ? undefined : selectedModel }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const blocks: Block[] = data.blocks ?? [{ type: "text", content: data.text ?? "Sem resposta." }];
      setCurrentBlocks(blocks);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentBlocks([]);
      setOrbStatus("idle");
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        blocks: [{ type: "error", content: `Falha na comunicação: ${err.message}` }],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setCurrentBlocks([]);
      setOrbStatus("idle");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentBlocks([]);
    setShowTools(false);
    setOrbStatus("idle");
  };

  const allCurrentBlocks = [...currentBlocks];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: Orb + Status */}
      <div className="hidden xl:flex w-52 shrink-0 border-r border-primary/15 bg-black flex-col items-center pt-8 pb-4 gap-6">
        <Orb status={orbStatus} size="lg" />

        <div className="w-full px-4 space-y-3">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest text-center">Sistema</div>

          {(["AUTO", "GEMINI", "CLAUDE", "OPENAI"] as ModelId[]).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedModel(m)}
              disabled={isStreaming}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider transition-all",
                selectedModel === m
                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                  : "border-primary/15 text-muted-foreground hover:border-primary/30 hover:text-primary/60"
              )}
            >
              <Cpu className="w-3 h-3 shrink-0" />
              <span>{m}</span>
              {selectedModel === m && isStreaming && (
                <span className="ml-auto">
                  <l-bouncy size="12" speed="1.5" color="#00ffff" />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto w-full px-4">
          <div className={cn(
            "text-[9px] font-mono text-center py-1 rounded-sm border uppercase tracking-widest transition-all",
            isStreaming
              ? "border-primary/40 text-primary bg-primary/5 animate-pulse"
              : "border-primary/15 text-muted-foreground"
          )}>
            {isStreaming ? "PROCESSANDO" : "AGUARDANDO"}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/15 bg-black shrink-0">
          <div className="flex items-center gap-3">
            <TerminalSquare className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">Chat Operacional</span>
            <span className={cn(
              "text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider",
              isStreaming ? "border-primary/40 text-primary bg-primary/5" : "border-primary/15 text-muted-foreground"
            )}>
              {selectedModel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowTools((v) => !v)}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] font-mono text-muted-foreground hover:text-primary uppercase"
            >
              <Activity className="w-3.5 h-3.5 mr-1" />Tools
            </Button>
            <Button
              onClick={clearChat}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] font-mono text-muted-foreground hover:text-destructive uppercase"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 min-w-0">
            {messages.length === 0 && !isStreaming && (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40 select-none">
                <Zap className="w-12 h-12 text-primary" />
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-center">
                  ZARITH aguarda sua instrução
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {msg.role === "assistant" && (
                  <ZarithAvatar isThinking={false} />
                )}
                {msg.role === "user" && (
                  <div className="w-10 h-10 rounded-full shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-primary uppercase">
                      {email ? email[0] : "U"}
                    </span>
                  </div>
                )}
                <div className={cn("flex flex-col gap-1.5 max-w-[80%] min-w-0", msg.role === "user" ? "items-end" : "items-start")}>
                  {msg.role === "user" ? (
                    <div className="px-4 py-2.5 rounded-sm bg-primary/10 border border-primary/25 text-sm font-mono text-primary/90 break-words">
                      {msg.blocks[0]?.content}
                    </div>
                  ) : (
                    <div className="space-y-1.5 w-full">
                      {msg.blocks.map((block, i) => (
                        <BlockRow key={i} block={block} isLast={false} isStreaming={false} />
                      ))}
                    </div>
                  )}
                  <span className="text-[9px] font-mono text-muted-foreground/50">
                    {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}

            {/* Streaming response */}
            {isStreaming && (
              <div className="flex gap-3">
                <ZarithAvatar isThinking={true} />
                <div className="flex flex-col gap-1.5 max-w-[80%] min-w-0">
                  {allCurrentBlocks.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-primary/20 bg-primary/5">
                      <l-waveform size="16" stroke="2" speed="1" color="#00ffff" />
                      <span className="text-xs font-mono text-primary/70">Inicializando...</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 w-full">
                      {allCurrentBlocks.map((block, i) => (
                        <BlockRow
                          key={i}
                          block={block}
                          isLast={i === allCurrentBlocks.length - 1}
                          isStreaming={isStreaming}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Tools panel */}
          <AnimatePresence>
            {showTools && (
              <ToolsPanel
                blocks={messages.flatMap((m) => m.blocks).concat(currentBlocks)}
                isStreaming={isStreaming}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-primary/15 bg-black shrink-0">
          <div className={cn(
            "flex gap-2 items-end rounded-sm border p-2 transition-all duration-200",
            isStreaming ? "border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]" : "border-primary/20 focus-within:border-primary focus-within:shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              rows={1}
              placeholder="Digite sua instrução para ZARITH... (Enter para enviar)"
              className="flex-1 bg-transparent resize-none outline-none font-mono text-sm text-foreground placeholder:text-muted-foreground/40 max-h-32 overflow-y-auto"
              style={{ minHeight: "1.5rem" }}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="sm"
              className="h-8 w-8 p-0 bg-primary text-black hover:bg-primary/80 rounded-sm shrink-0"
            >
              {isStreaming ? (
                <l-ring size="14" stroke="2" speed="2" color="black" />
              ) : (
                <SendHorizonal className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/40 mt-1.5 uppercase tracking-widest">
            Enter para enviar · Shift+Enter para nova linha · Modelo: {selectedModel}
          </p>
        </div>
      </div>
    </div>
  );
}
