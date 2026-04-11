import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Send, Terminal } from "lucide-react";
import { useGetDashboardSummary, useGetChatHistory, useSendMessage, getGetChatHistoryQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
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

  const agentStatus = sendMessage.isPending ? "thinking" : summary?.agentStatus || "idle";

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
      }
    });
  };

  return (
    <div className="flex-1 h-full flex flex-col lg:flex-row gap-6 p-6">
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        {/* Core Display */}
        <div className="bg-black border border-primary/20 rounded-sm p-6 flex flex-col items-center justify-center relative overflow-hidden flex-1 min-h-[300px]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          <Orb status={agentStatus as any} className="mb-8" />
          <div className="text-center font-mono">
            <h2 className="text-primary text-xl font-bold tracking-widest mb-1 glitch" data-text="ZARITH_CORE">ZARITH_CORE</h2>
            <p className="text-muted-foreground text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              Status: <span className="text-primary animate-pulse">{agentStatus}</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-black border border-primary/20 rounded-sm p-4 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Active Tasks</p>
            <p className="text-2xl text-primary font-mono">{summary?.inProgressTasks || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Pending</p>
            <p className="text-2xl text-secondary font-mono">{summary?.pendingTasks || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Completed</p>
            <p className="text-2xl text-muted-foreground font-mono">{summary?.completedTasks || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Messages</p>
            <p className="text-2xl text-primary font-mono">{summary?.totalMessages || 0}</p>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="w-full lg:w-2/3 flex flex-col bg-black border border-primary/20 rounded-sm relative overflow-hidden h-full">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        <div className="p-3 border-b border-primary/20 flex items-center gap-2 bg-primary/5">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-primary uppercase tracking-widest">Direct Link Active</span>
        </div>
        
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {chatHistory?.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                    {msg.role === 'user' ? 'Operator' : 'Zarith'} // {format(new Date(msg.createdAt), 'HH:mm:ss')}
                  </span>
                  <div className={`p-3 max-w-[80%] rounded-sm font-mono text-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary/10 border border-primary/30 text-primary' 
                      : 'bg-secondary/10 border border-secondary/30 text-secondary'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {sendMessage.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-start"
                >
                  <span className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">
                    Zarith // Processing
                  </span>
                  <div className="p-3 max-w-[80%] rounded-sm font-mono text-sm bg-secondary/5 border border-secondary/20 text-secondary/70 flex items-center gap-2">
                    <div className="w-1 h-3 bg-secondary animate-pulse"></div>
                    Processing direct query...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-primary/20 bg-black">
          <form onSubmit={handleSend} className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command directive..."
              className="flex-1 bg-primary/5 border-primary/30 font-mono text-primary placeholder:text-primary/30 rounded-sm focus-visible:ring-primary h-12"
              disabled={sendMessage.isPending}
            />
            <Button 
              type="submit" 
              disabled={sendMessage.isPending || !input.trim()}
              className="h-12 w-12 p-0 bg-primary/10 text-primary border border-primary/50 hover:bg-primary hover:text-black rounded-sm transition-all"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}