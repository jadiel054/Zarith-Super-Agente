import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CheckSquare,
  Activity,
  LogOut,
  TerminalSquare,
  X,
  Settings,
  GitCommit,
  MessageSquare,
  CheckCircle2,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useListTasks, useGetDashboardSummary } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  onClose?: () => void;
  lastMessageId?: string | null;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  borderColor: string;
}

function StatCard({ icon: Icon, label, value, color, borderColor }: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-sm border bg-black/40", borderColor)}>
      <Icon className={cn("w-4 h-4 shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest truncate">{label}</p>
        <p className={cn("text-sm font-mono font-bold", color)}>{value}</p>
      </div>
    </div>
  );
}

export function Sidebar({ onClose, lastMessageId }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { data: recentTasks } = useListTasks({ limit: 3 });
  const { data: summary } = useGetDashboardSummary();
  const { email, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const handleNavClick = () => {
    onClose?.();
  };

  const navItems = [
    { href: "/dashboard", label: "COMMAND CENTER", icon: LayoutDashboard },
    { href: "/tasks", label: "TASKS", icon: CheckSquare },
    { href: "/logs", label: "ACTIVITY LOGS", icon: Activity },
    { href: "/settings", label: "SYSTEM CONFIG", icon: Settings },
  ];

  // Scroll suave para a última mensagem no chat
  const handleScrollToLastMessage = (e: React.MouseEvent) => {
    e.preventDefault();
    if (lastMessageId) {
      const el = document.getElementById(lastMessageId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
    // Se não estiver no dashboard, navega primeiro
    if (location !== "/dashboard" && location !== "/") {
      setLocation("/dashboard");
    }
    onClose?.();
  };

  return (
    <aside className="w-64 flex flex-col h-full bg-sidebar border-r border-sidebar-border shadow-2xl relative z-20">
      {/* Header */}
      <div className="p-5 border-b border-sidebar-border flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <TerminalSquare className="w-6 h-6 text-primary" />
            <h1 className="font-mono text-xl font-bold tracking-widest text-primary glitch" data-text="ZARITH">
              ZARITH
            </h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-1.5 uppercase tracking-wider">
            Engenheira Autônoma
          </p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-muted-foreground hover:text-primary transition-colors"
          data-testid="button-menu-close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats — 4 Contadores */}
      <div className="px-4 py-3 border-b border-sidebar-border space-y-2">
        <h2 className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
          Sistema — Métricas
        </h2>
        <StatCard
          icon={GitCommit}
          label="Total de Tarefas"
          value={summary?.totalTasks ?? 0}
          color="text-primary"
          borderColor="border-primary/20"
        />
        <StatCard
          icon={CheckCircle2}
          label="Concluídas"
          value={summary?.completedTasks ?? 0}
          color="text-green-400"
          borderColor="border-green-500/20"
        />
        <StatCard
          icon={Clock}
          label="Em Progresso"
          value={summary?.inProgressTasks ?? 0}
          color="text-yellow-400"
          borderColor="border-yellow-500/20"
        />
        <StatCard
          icon={MessageSquare}
          label="Mensagens"
          value={summary?.totalMessages ?? 0}
          color="text-blue-400"
          borderColor="border-blue-500/20"
        />

        {/* Link para última mensagem */}
        {lastMessageId && (
          <a
            href="#"
            onClick={handleScrollToLastMessage}
            className="flex items-center justify-between px-3 py-2 rounded-sm border border-primary/15 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-all group mt-1"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <span className="text-[10px] font-mono text-primary/70 truncate">Última mensagem</span>
            </div>
            <ArrowRight className="w-3 h-3 text-primary/40 group-hover:text-primary transition-colors shrink-0" />
          </a>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-4 space-y-1 overflow-y-auto">
        <h2 className="text-[9px] font-mono text-muted-foreground mb-3 uppercase tracking-widest">
          Navegação
        </h2>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-all duration-200 group relative overflow-hidden",
              location === item.href
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            {location === item.href && (
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
            )}
            <item.icon
              className={cn(
                "w-4 h-4",
                location === item.href ? "text-primary" : "text-muted-foreground group-hover:text-primary"
              )}
            />
            {item.label}
          </Link>
        ))}

        {/* Recent Tasks */}
        {recentTasks && recentTasks.length > 0 && (
          <div className="pt-4">
            <h2 className="text-[9px] font-mono text-muted-foreground mb-3 uppercase tracking-widest flex items-center justify-between">
              <span>Tarefas Recentes</span>
              <Link
                href="/tasks"
                onClick={handleNavClick}
                className="text-primary hover:underline cursor-pointer text-[9px]"
              >
                Ver todas
              </Link>
            </h2>
            <div className="space-y-1.5">
              {recentTasks.map((task: any) => (
                <Link
                  key={task.id}
                  href="/tasks"
                  onClick={handleNavClick}
                  className="block p-2.5 rounded-sm bg-black border border-sidebar-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-muted-foreground">#{task.id}</span>
                    <span
                      className={cn(
                        "text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase",
                        task.status === "completed"
                          ? "text-primary border-primary/30"
                          : task.status === "in_progress"
                          ? "text-yellow-400 border-yellow-500/30"
                          : task.status === "failed"
                          ? "text-destructive border-destructive/30"
                          : "text-muted-foreground border-muted-foreground/20"
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono truncate text-sidebar-foreground">{task.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {email && (
          <div className="px-3 py-2 rounded-sm bg-primary/5 border border-primary/10">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
              Operador
            </p>
            <p className="text-xs font-mono text-primary truncate">{email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          data-testid="button-logout"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:text-destructive" />
          ENCERRAR SESSÃO
        </button>
      </div>
    </aside>
  );
}
