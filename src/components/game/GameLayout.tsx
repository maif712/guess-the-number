import { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

interface GameLayoutProps {
  children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-grow px-4 py-6 md:px-6 md:py-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
