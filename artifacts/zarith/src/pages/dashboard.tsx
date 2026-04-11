import { useState, useRef, useEffect } from "react";
import { Send, Terminal } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentStatus = sendMessage.isPending ? "thinking" : (summary?.agentStatus as any) || "idle";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, sendMessage.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const message = input;
    setInput("");
    sendMessage.mutate({ data: { content: message } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden p-3 sm:p-6 gap-4">
      {/* Mobile: orb + stats row */}
      <div className="flex lg:hidden items-center gap-4">
        {/* Small orb on mobile */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Orb status={agentStatus} size="sm" />
          <span className="text-[9px] font-mono text-primary uppercase tracking-widest animate-pulse">
            {agentStatus}
          </span>
        </div>

        {/* Stats grid on mobile */}
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

      {/* Desktop: side panel */}
      <div className="hidden lg:flex lg:flex-row flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col gap-6">
          {/* Core display */}
          <div className="bg-black border border-primary/20 rounded-sm p-6 flex flex-col items-center justify-center relative overflow-hidden flex-1 min-h-[300px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <Orb status={agentStatus} size="lg" className="mb-8" />
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
        </div>

        {/* Chat — desktop */}
        <ChatPanel
          chatHistory={chatHistory}
          isPending={sendMessage.isPending}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          scrollRef={scrollRef}
          className="flex-1"
        />
      </div>

      {/* Chat — mobile (fills remaining space) */}
      <ChatPanel
        chatHistory={chatHistory}
        isPending={sendMessage.isPending}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        scrollRef={scrollRef}
        className="flex-1 min-h-0 lg:hidden"
      />
    </div>
  );
}

interface ChatPanelProps {
  chatHistory: any;
  isPending: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

function ChatPanel({ chatHistory, isPending, input, setInput, onSend, scrollRef, className }: ChatPanelProps) {
  return (
    <div className={`flex flex-col bg-black border border-primary/20 rounded-sm relative overflow-hidden ${className ?? ""}`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="p-3 border-b border-primary/20 flex items-center gap-2 bg-primary/5 shrink-0">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono text-primary uppercase tracking-widest">Direct Link Active</span>
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {chatHistory?.map((msg: any) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                  {msg.role === 'user' ? 'Operator' : 'Zarith'} // {format(new Date(msg.createdAt), 'HH:mm:ss')}
                </span>
                <div
                  className={`p-3 max-w-[85%] rounded-sm font-mono text-xs sm:text-sm break-words ${
                    msg.role === 'user'
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'bg-secondary/10 border border-secondary/30 text-secondary'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-start"
              >
                <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                  Zarith // Processing
                </span>
                <div className="p-3 max-w-[80%] rounded-sm font-mono text-sm bg-secondary/5 border border-secondary/20 text-secondary/70 flex items-center gap-2">
                  <div className="w-1 h-3 bg-secondary animate-pulse" />
                  Processing directive...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="p-3 sm:p-4 border-t border-primary/20 bg-black shrink-0">
        <form onSubmit={onSend} className="flex gap-2 sm:gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command directive..."
            data-testid="input-chat"
            className="flex-1 bg-primary/5 border-primary/30 font-mono text-primary placeholder:text-primary/30 rounded-sm focus-visible:ring-primary h-10 sm:h-12 text-sm"
            disabled={isPending}
          />
          <Button
            type="submit"
            disabled={isPending || !input.trim()}
            data-testid="button-send-message"
            className="h-10 sm:h-12 w-10 sm:w-12 p-0 bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black rounded-sm transition-all shrink-0"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
