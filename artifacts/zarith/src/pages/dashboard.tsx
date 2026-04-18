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
  Mic,
  MicOff,
  MessageSquare,
  Command,
  ListTodo,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import {
  useGetDashboardSummary,
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getGetChatHistoryQueryKey,
  getGetDashboardSummaryQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useShell } from "@/components/layout/shell";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ELITE: Função para limpar markdown antes da voz falar
const cleanTextForSpeech = (text: string) => {
  return text
    .replace(/\*\*/g, "") 
    .replace(/\*/g, "")   
    .replace(/#/g, "")    
    .replace(/`/g, "")    
    .replace(/\[.*\]\(.*\)/g, "") 
    .trim();
};

type ModelId = "GEMINI" | "CLAUDE" | "OPENAI";

const MODEL_CONFIG: Record<ModelId, { label: string; color: string; dot: string }> = {
  GEMINI: { label: "Gemini 2.5", color: "text-blue-400 border-blue-400/40 bg-blue-400/10", dot: "bg-blue-400" },
  CLAUDE: { label: "Claude 3.5", color: "text-orange-400 border-orange-400/40 bg-orange-400/10", dot: "bg-orange-400" },
  OPENAI: { label: "GPT-4o", color: "text-green-400 border-green-400/40 bg-green-400/10", dot: "bg-green-400" },
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
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded text-white/20 hover:text-primary hover:bg-primary/10 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function fallbackSpeak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 500));
  u.lang = "pt-BR";
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

function SpeakerButton({ text, email, onStart, onEnd }: { text: string; email: string | null; onStart: () => void; onEnd: () => void; }) {
  const [loading, setLoading] = useState(false);
  const handleSpeak = async () => {
    if (loading) return;
    setLoading(true);
    onStart();
    const cleanText = cleanTextForSpeech(text);
    try {
      if (email) {
        const r = await fetch(`${API_BASE}/api/voice/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Email": email },
          body: JSON.stringify({ text: cleanText }),
        });
        if (r.ok) {
          const blob = await r.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { onEnd(); setLoading(false); URL.revokeObjectURL(url); };
          audio.play();
          return;
        }
      }
      fallbackSpeak(cleanText, () => { onEnd(); setLoading(false); });
    } catch {
      fallbackSpeak(cleanText, () => { onEnd(); setLoading(false); });
    }
  };
  return (
    <button onClick={handleSpeak} disabled={loading} className="p-1 rounded text-white/20 hover:text-primary transition-colors">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
    </button>
  );
}

function MessageBlock({ block, email, onSpeakStart, onSpeakEnd }: { block: Block; email: string | null; onSpeakStart: () => void; onSpeakEnd: () => void; }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-sm border p-3 font-mono text-xs group relative", 
      block.type === "thinking" && "bg-black/40 border-white/5 text-white/40",
      block.type === "text" && "bg-black border-white/10 text-white/90"
    )}>
      <div className="flex items-start gap-2">
        <BlockIcon type={block.type} />
        <p className="flex-1 leading-relaxed whitespace-pre-wrap break-words">{block.content}</p>
      </div>
      {!block.isStreaming && (
        <div className="flex items-center justify-end mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={block.content} />
          {(block.type === "text" || block.type === "result") && (
            <SpeakerButton text={block.content} email={email} onStart={onSpeakStart} onEnd={onSpeakEnd} />
          )}
        </div>
      )}
    </motion.div>
  );
}

// COMPONENTE PRINCIPAL DASHBOARD
function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiActive, setIsAiActive] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelId | null>("GEMINI");

  const onSendMessage = async (content: string) => {
    if (!content.trim()) return;
    const newMessage: LocalMessage = {
      id: Math.random().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    // Lógica de envio para API viria aqui...
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4 overflow-hidden">
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        <div className="flex justify-center py-8">
           <Orb status={isSpeaking ? "speaking" : "idle"} size="md" />
        </div>
        
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                {m.content && (
                  <div className={cn("px-4 py-2 rounded-sm text-sm font-mono", m.role === "user" ? "bg-primary/20 border border-primary/30 text-primary" : "bg-white/5 border border-white/10")}>
                    {m.content}
                  </div>
                )}
                {m.blocks?.map((b, i) => (
                  <MessageBlock key={i} block={b} email={user?.email || null} onSpeakStart={() => setIsSpeaking(true)} onSpeakEnd={() => setIsSpeaking(false)} />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="max-w-3xl mx-auto w-full space-y-4">
          <div className="flex gap-2">
            <Input 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && onSendMessage(input)}
              placeholder="Comando para Zarith..." 
              className="bg-black border-primary/20 text-primary font-mono"
            />
            <Button onClick={() => onSendMessage(input)} className="bg-primary hover:bg-primary/80">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// A LINHA QUE FALTAVA PARA NÃO QUEBRAR O BUILD:
export default Dashboard;
        
