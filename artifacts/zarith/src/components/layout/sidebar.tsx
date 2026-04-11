import { Link, useLocation } from "wouter";
import { LayoutDashboard, CheckSquare, Activity, LogOut, TerminalSquare } from "lucide-react";
import { useGetRecentActivity, useListTasks } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: recentTasks } = useListTasks({ limit: 5 });

  const handleLogout = () => {
    localStorage.removeItem("zarith_authenticated");
    setLocation("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "COMMAND CENTER", icon: LayoutDashboard },
    { href: "/tasks", label: "TASKS", icon: CheckSquare },
    { href: "/logs", label: "ACTIVITY LOGS", icon: Activity },
  ];

  return (
    <aside className="w-64 flex flex-col h-full bg-sidebar border-r border-sidebar-border shadow-2xl relative z-20">
      <div className="p-6 border-b border-sidebar-border">
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

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Navigation</h2>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-all duration-200 group relative overflow-hidden",
                  location === item.href
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {location === item.href && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></span>
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
            <Link href="/tasks" className="text-primary hover:underline cursor-pointer">All</Link>
          </h2>
          <div className="space-y-2">
            {recentTasks?.map((task) => (
              <Link
                key={task.id}
                href={`/tasks?id=${task.id}`}
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

      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:text-destructive" />
          TERMINATE SESSION
        </button>
      </div>
    </aside>
  );
}