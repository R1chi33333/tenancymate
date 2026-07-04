'use client';

import { useRef, useState } from 'react';
import { CornerDownLeft, LoaderCircle } from 'lucide-react';

interface Turn {
  question: string;
  answer: string;
  providedSections: string[];
  streaming: boolean;
  error?: string;
}

interface SectionText {
  id: string;
  heading: string;
  part: string | null;
  body: string;
}

const CITATION = /\[s\s+(\d+[A-Z]{0,3})[^\]]*\]/g;

const SUGGESTIONS = [
  'How many weeks of bond can my landlord ask for?',
  'How much notice ends a periodic tenancy?',
  'Can my landlord charge an extra bond for my dog?',
];

/** Answer text with citations rendered as buttons. */
function AnswerText({ text, onCite }: { text: string; onCite: (id: string) => void }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const index = match.index;
    parts.push(text.slice(last, index));
    const id = match[1] ?? '';
    parts.push(
      <button
        key={`${String(index)}-${id}`}
        type="button"
        onClick={() => {
          onCite(id);
        }}
        className="rounded bg-accent/15 px-1 font-mono text-xs text-accent-hover transition-colors hover:bg-accent/30"
      >
        {match[0]}
      </button>,
    );
    last = index + match[0].length;
  }
  parts.push(text.slice(last));
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{parts}</p>;
}

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<SectionText[]>([]);
  const [highlighted, setHighlighted] = useState<string>();
  const panelRef = useRef<HTMLDivElement>(null);

  async function loadSections(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const response = await fetch(`/api/sections?ids=${ids.join(',')}`);
    if (response.ok) {
      const data = (await response.json()) as { sections: SectionText[] };
      setPanel(data.sections);
    }
  }

  function focusSection(id: string): void {
    setHighlighted(id);
    const element = panelRef.current?.querySelector(`[data-section="${id}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(): Promise<void> {
    const question = input.trim();
    if (question.length < 5 || busy) {
      return;
    }
    setInput('');
    setBusy(true);
    setTurns((current) => [
      ...current,
      { question, answer: '', providedSections: [], streaming: true },
    ]);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong.');
      }

      const provided = (response.headers.get('x-provided-sections') ?? '')
        .split(',')
        .filter(Boolean);
      setTurns((current) => {
        const next = [...current];
        const turn = next.at(-1);
        if (turn) {
          turn.providedSections = provided;
        }
        return next;
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        answer += decoder.decode(value, { stream: true });
        setTurns((current) => {
          const next = [...current];
          const turn = next.at(-1);
          if (turn) {
            turn.answer = answer;
          }
          return next;
        });
      }

      setTurns((current) => {
        const next = [...current];
        const turn = next.at(-1);
        if (turn) {
          turn.streaming = false;
        }
        return next;
      });

      const cited = [...new Set([...answer.matchAll(CITATION)].map((match) => match[1] ?? ''))];
      await loadSections(cited.length > 0 ? cited : provided.slice(0, 3));
    } catch (error) {
      setTurns((current) => {
        const next = [...current];
        const turn = next.at(-1);
        if (turn) {
          turn.streaming = false;
          turn.error = error instanceof Error ? error.message : 'Something went wrong.';
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-1 py-6">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <h1 className="max-w-md text-2xl font-semibold tracking-tight">
                Ask about NZ tenancy law, get the section to prove it
              </h1>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => (
            <div key={index} className="space-y-3">
              <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm">
                {turn.question}
              </p>
              <div className="max-w-[85%] rounded-lg border border-border bg-surface-1 px-3 py-2">
                {turn.error ? (
                  <p className="text-sm text-fg-muted">{turn.error}</p>
                ) : (
                  <>
                    <AnswerText text={turn.answer} onCite={focusSection} />
                    {turn.streaming && (
                      <LoaderCircle
                        className="mt-1 size-4 animate-spin text-fg-muted"
                        strokeWidth={1.5}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex items-center gap-2 border-t border-border py-4"
        >
          <input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            placeholder="Ask about bonds, rent increases, notice periods..."
            maxLength={400}
            aria-label="Your question"
            className="flex-1 rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm placeholder:text-fg-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length < 5}
            aria-label="Send"
            className="rounded-md bg-accent p-2.5 text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <CornerDownLeft className="size-4" strokeWidth={2} />
          </button>
        </form>
      </div>

      <aside
        ref={panelRef}
        className="w-96 shrink-0 overflow-y-auto border-l border-border p-4 max-lg:hidden"
      >
        {panel.length === 0 ? (
          <p className="mt-8 text-center text-sm text-fg-muted">
            Cited sections of the Act appear here. Click a citation to jump to its text.
          </p>
        ) : (
          <div className="space-y-4">
            {panel.map((section) => (
              <section
                key={section.id}
                data-section={section.id}
                className={`rounded-lg border p-4 transition-colors ${
                  highlighted === section.id
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface-1'
                }`}
              >
                <h2 className="text-sm font-semibold">
                  <span className="font-mono text-accent-hover">s {section.id}</span>{' '}
                  {section.heading}
                </h2>
                {section.part && <p className="mt-0.5 text-xs text-fg-muted">{section.part}</p>}
                <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-fg-muted">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        )}
      </aside>
    </main>
  );
}
