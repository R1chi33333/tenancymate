import { Scale } from 'lucide-react';
import { Chat } from './chat';

export default function Home() {
  return (
    <div className="mx-auto flex h-screen max-w-[1200px] flex-col px-4 sm:px-6">
      <div className="border-b border-border bg-surface-1 px-4 py-1.5 text-center text-xs text-fg-muted">
        General information, not legal advice.
      </div>
      <header className="flex items-center justify-between border-b border-border py-4">
        <div className="flex items-center gap-2">
          <Scale className="size-5 text-accent" strokeWidth={1.5} />
          <span className="text-sm font-semibold">TenancyMate</span>
          <span className="hidden text-xs text-fg-muted sm:inline">
            Residential Tenancies Act 1986
          </span>
        </div>
        <a
          href="https://github.com/R1chi33333/tenancymate"
          className="text-sm text-fg-muted transition-colors hover:text-fg"
        >
          GitHub
        </a>
      </header>

      <Chat />

      <footer className="border-t border-border py-3 text-xs text-fg-muted">
        General information, not legal advice. Source: Residential Tenancies Act 1986 via
        legislation.govt.nz (CC BY 4.0). Answers are rate limited daily.
      </footer>
    </div>
  );
}
