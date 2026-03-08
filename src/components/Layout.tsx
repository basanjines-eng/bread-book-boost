import { TopNav } from "@/components/TopNav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopNav />
      <main className="flex-1 overflow-auto">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
