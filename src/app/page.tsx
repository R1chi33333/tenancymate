import { Scale } from 'lucide-react';

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-6">
      <div className="border-b border-border bg-surface-1 px-4 py-1.5 text-center text-xs text-fg-muted">
        General information, not legal advice.
      </div>
      <header className="flex items-center justify-between border-b border-border py-4">
        <div className="flex items-center gap-2">
          <Scale className="size-5 text-accent" strokeWidth={1.5} />
          <span className="text-sm font-semibold">TenancyMate</span>
        </div>
        <a
          href="https://github.com/R1chi33333/tenancymate"
          className="text-sm text-fg-muted transition-colors hover:text-fg"
        >
          GitHub
        </a>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
          NZ tenancy law answers, with the section to prove it
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-fg-muted">
          Retrieval-augmented answers over the Residential Tenancies Act 1986, every claim cited to
          its section, with a published evaluation set. Under construction.
        </p>
      </main>

      <footer className="border-t border-border py-4 text-xs text-fg-muted">
        MIT licensed. General information, not legal advice. Source: Residential Tenancies Act 1986
        via legislation.govt.nz (CC BY 4.0).
      </footer>
    </div>
  );
}
