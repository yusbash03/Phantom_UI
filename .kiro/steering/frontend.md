---
inclusion: always
---

# PHANTOM — Frontend Steering (Phantom_UI)

This repository is the React frontend of PHANTOM. **The canonical requirements, design, task list
and project-wide steering live in the backend repository** and are not duplicated here:

- `../../backend/Phantom_API/.kiro/specs/phantom-platform/requirements.md`
- `../../backend/Phantom_API/.kiro/specs/phantom-platform/design.md`
- `../../backend/Phantom_API/.kiro/specs/phantom-platform/tasks.md` (frontend tasks are tagged `[UI]`)
- `../../backend/Phantom_API/.kiro/steering/` (product, architecture, coding-standards, security, testing)

Read the relevant sections before implementing any `[UI]` task.

## Frontend-specific rules

- Stack: React 19, Vite 8, TypeScript 5.9 (strict; pinned because openapi-typescript needs the TS 5 compiler API),
  Tailwind CSS 4, shadcn/ui, Lucide, React Router, TanStack Query, React Hook Form + Zod 4, oxlint,
  Vitest + React Testing Library, MSW 3, Playwright.
- API types are generated from the backend contract (`npm run api:generate` →
  `src/api/generated/`). Never hand-write a type that exists in the contract.
- Local dev: `npm run dev` on `:5173`; Vite proxies `/api` and `/hubs` (WebSocket) to the API on `:5080`.
- Access token in memory only; refresh is an HttpOnly cookie handled by the browser.
- The UI hides what a role cannot use, but the backend is the authority — never rely on the UI for security.
- Every data view implements loading, error and empty states. No non-functional controls. No hardcoded metrics.
- AI output is labelled "AI recommendation" and shown apart from approved values.
  Unverified locations are labelled unverified. Demo/fixture data shows a visible badge.
- Visual direction: dark navy/charcoal base, restrained electric-orange accent; red = critical,
  amber = high/medium, blue = informational, green = completed. Inter typography. Severity is always
  icon + text, never colour alone. Usable from 360 px width.
