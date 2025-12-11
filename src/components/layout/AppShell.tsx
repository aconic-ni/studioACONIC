import type React from 'react';
import { AppHeader } from './AppHeader';
import { VisibilityGroupWidget } from '../executive/VisibilityGroupWidget';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col grid-bg text-primary-foreground">
      <AppHeader />
      <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
       <VisibilityGroupWidget />
      <footer className="py-4 text-center text-sm bg-card text-card-foreground border-t">
        Stvaer © 2025 <em>for</em> ACONIC
      </footer>
    </div>
  );
}
