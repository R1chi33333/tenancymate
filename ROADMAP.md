# Roadmap

Development follows small, releasable increments. Each item below is one loop.

## Milestone: v0.1.0 — Corpus and retrieval

- [x] Loop 1: repository scaffold, CI, deployable page with the standing disclaimer
- [x] Loop 2: corpus pipeline — fetch, split by section with hierarchy, tested against the real Act
- [x] Loop 3: embeddings (local MiniLM) into pgvector on Neon, plus a full-text index
- [x] Loop 4: retrieval — vector search and hybrid RRF fusion behind one interface
- [ ] Release v0.1.0

## Milestone: v0.2.0 — Evaluation

- [x] Loop 5: hand-built eval set of 46 QA pairs with verified expected sections
- [x] Loop 6: eval script — recall@k, heading-chunk improvement measured and published
- [x] Release v0.2.0

## Milestone: v0.3.0 — Answers

- [x] Loop 7: generation over Groq free tier with the citation contract enforced
- [x] Loop 8: citation accuracy eval with cached answers; corpus bug found and fixed
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
