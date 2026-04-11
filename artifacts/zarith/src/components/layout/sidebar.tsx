import { Link, useLocation } from "wouter";
import { LayoutDashboard, CheckSquare, Activity, LogOut, TerminalSquare, X } from "lucide-react";
import { useListTasks } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { data: recentTasks } = useListTasks({ limit: 5 });
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
  ];

  return (
    <aside className="w-64 flex flex-col h-full bg-sidebar border-r border-sidebar-border shadow-2xl relative z-20">
      <div className="p-6 border-b border-sidebar-border flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <TerminalSquare className="w-6 h-6 text-primary" />
            <h1 className="font-mono text-xl font-bold tracking-widest text-primary glitch" data-text="ZARITH">
              ZARITH
            </h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-2 uppercase tracking-wider">
            System: Online
          </p>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-muted-foreground hover:text-primary transition-colors"
          data-testid="button-menu-close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Navigation</h2>
          <div className="space-y-1">
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
                <item.icon className={cn("w-4 h-4", location === item.href ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest flex items-center justify-between">
            <span>Recent Tasks</span>
            <Link href="/tasks" onClick={handleNavClick} className="text-primary hover:underline cursor-pointer">All</Link>
          </h2>
          <div className="space-y-2">
            {recentTasks?.map((task) => (
              <Link
                key={task.id}
                href={`/tasks`}
                onClick={handleNavClick}
                className="block p-3 rounded bg-black border border-sidebar-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-muted-foreground">ID-{task.id}</span>
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase",
                    task.status === 'completed' ? "text-primary border-primary/30" :
                    task.status === 'in_progress' ? "text-secondary border-secondary/30" :
                    task.status === 'failed' ? "text-destructive border-destructive/30" :
                    "text-muted-foreground border-muted-border"
                  )}>
                    {task.status}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{task.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {email && (
          <div className="px-3 py-2 rounded-sm bg-primary/5 border border-primary/10">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Operator</p>
            <p className="text-xs font-mono text-primary truncate">{email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          data-testid="button-logout"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:text-destructive" />
          TERMINATE SESSION
        </button>
      </div>
    </aside>
  );
}
