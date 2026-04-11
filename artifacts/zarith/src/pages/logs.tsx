import { useGetRecentActivity } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, TerminalSquare, AlertTriangle, CheckSquare, MessageSquare } from "lucide-react";

export default function Logs() {
  const { data: logs } = useGetRecentActivity({ limit: 100 });

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'task_created': return <CheckSquare className="w-4 h-4 text-secondary" />;
      case 'task_completed': return <CheckSquare className="w-4 h-4 text-primary" />;
      case 'task_failed': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'message_sent': return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
      case 'agent_response': return <TerminalSquare className="w-4 h-4 text-primary" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'task_completed': return 'border-primary/30 bg-primary/5';
      case 'task_failed': return 'border-destructive/30 bg-destructive/5';
      case 'agent_response': return 'border-primary/20 bg-black';
      case 'task_created': return 'border-secondary/20 bg-secondary/5';
      default: return 'border-muted-border bg-black';
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-bold text-primary tracking-widest uppercase">System Logs</h1>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Chronological Activity Feed</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary/20 before:to-transparent">
          {logs?.map((log) => (
            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-sm border border-primary/30 bg-black shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_10px_rgba(0,255,255,0.1)] z-10">
                {getLogIcon(log.type)}
              </div>
              
              <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-sm border ${getLogColor(log.type)} backdrop-blur-sm`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">{log.type.replace('_', ' ')}</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                </div>
                <p className="text-sm font-mono text-foreground">{log.description}</p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="mt-2 p-2 bg-black border border-primary/10 rounded-sm text-[10px] text-muted-foreground font-mono overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
        {logs?.length === 0 && (
          <div className="h-40 flex items-center justify-center border border-dashed border-primary/20 rounded-sm">
            <span className="font-mono text-muted-foreground uppercase tracking-widest">No activity recorded in current cycle</span>
          </div>
        )}
      </div>
    </div>
  );
}