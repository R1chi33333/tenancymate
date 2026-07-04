# Contributing

Thanks for your interest. This project is small and contributions are welcome.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Rules

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`). Releases are cut automatically from commit messages.
- `npm run lint`, `npm run typecheck` and `npm test` must pass before a PR.
- Retrieval changes must show their effect on the eval numbers in the PR description.
- Never present the assistant's output as legal advice; the disclaimer stays.
- No emoji anywhere: code, comments, docs, commit messages.
