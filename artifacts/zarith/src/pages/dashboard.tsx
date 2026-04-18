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

// ELITE: Função para limpar markdown (asteriscos, etc) antes de falar
const cleanTextForSpeech = (text: string) => {
  return text
    .replace(/\*\*/g, "") // Remove negrito
    .replace(/\*/g, "")   // Remove itálico/bullet
    .replace(/#/g, "")    // Remove headers
    .replace(/`/g, "")    // Remove code blocks
    .replace(/\[.*\]\(.*\)/g, "") // Remove links markdown
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

// ... (Mantenha as interfaces BlockIcon e CopyButton iguais ao seu código original)

// ─── Speaker Button ELITE ───────────────────────────────────────────────────

function SpeakerButton({
  text,
  email,
  onStart,
  onEnd,
}: {
  text: string;
  email: string | null;
  onStart: () => void;
  onEnd: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSpeak = async () => {
    if (loading) return;
    setLoading(true);
    onStart();

    // Filtra o texto antes de enviar para a API ou fallback
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
          audio.onerror = () => { onEnd(); setLoading(false); URL.revokeObjectURL(url); };
          audio.play();
          return;
        }
      }
      // Fallback para voz do sistema se a API falhar ou não houver email
      fallbackSpeak(cleanText, () => { onEnd(); setLoading(false); });
    } catch {
      fallbackSpeak(cleanText, () => { onEnd(); setLoading(false); });
    }
  };

  return (
    <button
      onClick={handleSpeak}
      disabled={loading}
      className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
      title="Ouvir Resposta"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}

// ... (O restante das funções do Dashboard seguem aqui conforme seu arquivo original)
