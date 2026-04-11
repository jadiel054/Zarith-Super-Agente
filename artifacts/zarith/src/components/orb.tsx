import { cn } from "@/lib/utils";

interface OrbProps {
  status: "idle" | "thinking" | "executing";
  className?: string;
}

export function Orb({ status, className }: OrbProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div 
        className={cn(
          "w-32 h-32 rounded-full backdrop-blur-md transition-all duration-500",
          status === "idle" && "orb-idle bg-primary/10",
          status === "thinking" && "orb-thinking",
          status === "executing" && "orb-idle bg-primary/20 shadow-[0_0_50px_10px_hsl(var(--primary)/0.6)]"
        )}
      >
        <div className="absolute inset-0 rounded-full border border-primary/30 mix-blend-overlay"></div>
        <div className="absolute inset-2 rounded-full border border-primary/20"></div>
        <div className="absolute inset-4 rounded-full border border-primary/10"></div>
        
        {/* Core */}
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-colors duration-500",
          status === "thinking" ? "bg-secondary shadow-[0_0_20px_hsl(var(--secondary))]" : "bg-primary shadow-[0_0_20px_hsl(var(--primary))]"
        )}></div>
      </div>
      
      {/* HUD Rings */}
      <svg className="absolute inset-[-20%] w-[140%] h-[140%] animate-[spin_10s_linear_infinite]" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--primary) / 0.2)" strokeWidth="0.5" strokeDasharray="4 4" />
      </svg>
      <svg className="absolute inset-[-10%] w-[120%] h-[120%] animate-[spin_15s_linear_infinite_reverse]" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.2" strokeDasharray="1 6" />
      </svg>
    </div>
  );
}