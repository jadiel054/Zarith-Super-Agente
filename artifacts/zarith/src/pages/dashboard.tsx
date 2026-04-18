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
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Orb } from "@/components/orb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ELITE: Filtro para a IA não falar "asterisco"
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
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(cleanText));
      onEnd(); setLoading(false);
    } catch {
      onEnd(); setLoading(false);
    }
  };
  return (
    <button onClick={handleSpeak} disabled={loading} className="p-1 rounded text-white/20 hover:text-primary">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
    </button>
  );
}

function MessageBlock({ block, email, onSpeakStart, onSpeakEnd }: { block: Block; email: string | null; onSpeakStart: () => void; onSpeakEnd: () => void; }) {
  return (
    <div className={cn("rounded-sm border p-3 font-mono text-xs mb-2", 
      block.type === "thinking" ? "bg-black/40 border-white/5 text-white/40" : "bg-black border-white/10 text-white/90"
    )}>
      <div className="flex items-start gap-2">
        <BlockIcon type={block.type} />
        <p className="flex-1 whitespace-pre-wrap">{block.content}</p>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <SpeakerButton text={block.content} email={email} onStart={onSpeakStart} onEnd={onSpeakEnd} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: LocalMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Email": user?.email || "" 
        },
        body: JSON.stringify({ message: content, model: "GEMINI" }),
      });

      const data = await response.json();
      
      const aiMsg: LocalMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        blocks: data.blocks || [{ type: "text", content: data.text || "Sem resposta." }],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex justify-center py-6">
           <Orb status={isSpeaking ? "speaking" : "idle"} size="md" />
        </div>
        
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("mb-6", m.role === "user" ? "text-right" : "text-left")}>
                {m.content && (
                  <div className={cn("inline-block px-4 py-2 rounded border mb-2", m.role === "user" ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-white/5")}>
                    {m.content}
                  </div>
                )}
                {m.blocks?.map((b, i) => (
                  <MessageBlock key={i} block={b} email={user?.email || null} onSpeakStart={() => setIsSpeaking(true)} onSpeakEnd={() => setIsSpeaking(false)} />
                ))}
              </div>
            ))}
            {loading && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />}
          </div>
        </ScrollArea>

        <div className="max-w-3xl mx-auto w-full p-4 flex gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && onSendMessage(input)}
            placeholder="Digite sua mensagem..." 
            className="bg-black border-primary/20 text-primary"
          />
          <Button onClick={() => onSendMessage(input)} disabled={loading} className="bg-primary hover:bg-primary/80">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
