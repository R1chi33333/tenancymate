# Roadmap

Development follows small, releasable increments. Each item below is one loop.

## Milestone: v0.1.0 — Corpus and retrieval

- [x] Loop 1: repository scaffold, CI, deployable page with the standing disclaimer
- [x] Loop 2: corpus pipeline — fetch, split by section with hierarchy, tested against the real Act
- [ ] Loop 3: embeddings (local MiniLM) into pgvector on Neon, plus a Postgres full-text index for BM25-style retrieval
- [ ] Loop 4: retrieval API — vector search first, hybrid (vector + full text) behind a flag for the eval comparison
- [ ] Release v0.1.0

## Milestone: v0.2.0 — Evaluation

- [ ] Loop 5: hand-built eval set of 40 plus QA pairs (question, expected sections, answer points)
- [ ] Loop 6: eval script — recall at k for vector-only versus hybrid, results table in the README
- [ ] Release v0.2.0

## Milestone: v0.3.0 — Answers

- [ ] Loop 7: Claude generation with mandatory [s 42] citations and an explicit "the Act does not directly address this" path
- [ ] Loop 8: citation accuracy metric in the eval, README updated with the numbers
- [ ] Release v0.3.0

## Milestone: v1.0.0 — Ship

- [ ] Loop 9: chat UI with streaming, citation panel that scrolls and highlights the cited section
- [ ] Loop 10: rate limiting and a daily usage cap
- [ ] Loop 11: Playwright e2e, README results and screenshot, deploy
- [ ] Release v1.0.0

## Later

- [ ] Tenancy Services guidance documents as a second corpus
- [ ] Conversation memory within a session
- [ ] Te reo Maori interface strings
