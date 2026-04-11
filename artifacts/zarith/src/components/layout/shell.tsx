import { ReactNode, useState } from "react";
import { Sidebar } from "./sidebar";
import { Menu, X, TerminalSquare } from "lucide-react";

export function Shell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden scan-lines">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on lg+, drawer on mobile */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 h-full relative z-10 overflow-hidden flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20 bg-black lg:hidden">
          <div className="flex items-center gap-2">
            <TerminalSquare className="w-5 h-5 text-primary" />
            <span className="font-mono text-lg font-bold tracking-widest text-primary">ZARITH</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-sm border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
            data-testid="button-menu-open"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
