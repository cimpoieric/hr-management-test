"use client";

interface MainContentProps {
  children: React.ReactNode;
}

/**
 * Wrapper pentru conținutul principal al dashboard-ului.
 * Asigură padding consistent și scroll intern.
 */
export function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">{children}</div>
    </main>
  );
}
