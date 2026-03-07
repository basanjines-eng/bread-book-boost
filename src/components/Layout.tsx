import { TopNav } from "@/components/TopNav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopNav />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-[1400px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
