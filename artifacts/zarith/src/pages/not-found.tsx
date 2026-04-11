import { TerminalSquare } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden scan-lines">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.05)_0%,rgba(0,0,0,0)_70%)]"></div>
      
      <div className="w-full max-w-md p-8 bg-black border border-destructive/30 shadow-[0_0_30px_rgba(255,0,0,0.05)] relative z-10 rounded-sm text-center">
        <TerminalSquare className="w-12 h-12 text-destructive mb-4 mx-auto" />
        <h1 className="font-mono text-3xl font-bold tracking-[0.2em] text-destructive glitch mb-2" data-text="ERROR_404">
          ERROR_404
        </h1>
        <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mb-8">
          Directive Not Found
        </p>
        
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-sm mb-8 text-left text-xs font-mono text-destructive/80 space-y-1">
          <p>&gt; Executing path resolution...</p>
          <p>&gt; Target coordinates invalid.</p>
          <p>&gt; Route disconnected from core.</p>
        </div>

        <Link href="/" className="inline-flex items-center justify-center gap-2 h-12 px-6 font-mono uppercase tracking-widest bg-destructive/10 text-destructive border border-destructive/50 hover:bg-destructive hover:text-black transition-all rounded-sm cursor-pointer w-full">
          Return to Core
        </Link>
      </div>
    </div>
  );
}
