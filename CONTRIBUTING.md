# Contributing to Fetch

Thanks for your interest. Fetch is a small, focused tool — contributions that keep it that way are most welcome.

## What to Contribute

**Good fits**
- Bug fixes
- PWA / mobile improvements
- Accessibility
- Firestore rule hardening
- Performance
- Docs

**Out of scope (discuss first)**
- Server-side components
- Additional auth methods
- Native app wrappers
- Features that significantly increase bundle size

## Setup

```bash
git clone https://github.com/sandip-pathe/fetch.git
cd fetch
npm install
cp .env.example .env   # fill in your Firebase credentials
npm run dev
```

## Pull Request Guidelines

1. Keep PRs small and focused — one thing at a time
2. `npm run lint` must pass before submitting
3. If the change is visual, include a screenshot or recording
4. Use the PR template

## Issues

Before opening an issue:
- Search existing issues first
- For bugs: include browser, OS, device type, and exact steps to reproduce
- For features: explain the use case before the solution

## Code Style

- TypeScript strict mode — no `any` unless truly unavoidable
- Tailwind for all styling — no external CSS files
- No new `npm` dependencies without a prior discussion in an issue
- Components stay in `src/App.tsx` unless they grow beyond ~100 lines
