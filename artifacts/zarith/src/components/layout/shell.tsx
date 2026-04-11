import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden scan-lines">
      <Sidebar />
      <main className="flex-1 h-full relative z-10 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}