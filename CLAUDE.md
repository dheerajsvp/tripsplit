# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo currently contains only planning documents (`TRIPSPLIT_PLAN.md`, and a duplicate of it at
`CLAUDE.md.md` which can be deleted/ignored). **No code has been scaffolded yet** — there is no
`backend/`, `frontend/`, or `.github/workflows/` directory. Nothing builds, lints, or tests until
Milestone 1.1 creates the Django project and Milestone 2.1 creates the Vite project.

`TRIPSPLIT_PLAN.md` is the authoritative spec: full data model, API contract (request/response
JSON shapes), frontend page/route spec, and a milestone checklist (1 = backend, 2 = frontend,
3 = deploy, 4 = stretch). Work through it **one numbered milestone step at a time** — don't jump
ahead or generate the whole app in one pass. After finishing a step, run its tests and explain what
was written before moving to the next step. Tick checkboxes off in the plan file as steps complete.

## Commands

None exist yet. Once scaffolded per the plan, these will be the standard commands:

- Backend tests: `cd backend && python manage.py test`
- Backend dev server: `cd backend && python manage.py runserver`
- Backend single test: `cd backend && python manage.py test trips.tests.test_balances.ClassName.test_method`
- Frontend dev server: `cd frontend && npm run dev`
- Frontend tests (Vitest): `cd frontend && npm test`
- Frontend build: `cd frontend && npm run build`

## Architecture (as specified by the plan)

This is a **monorepo**: Django REST Framework backend in `backend/`, React+TS (Vite) frontend in
`frontend/`. The backend is a single Django app, `trips`.

**Business logic lives in `trips/services/`, not in views/models.** `services/balances.py` and
`services/upi.py` must be pure Python with no Django imports — this is what makes them unit-testable
in isolation and is the most important structural rule in this codebase. Views/serializers call into
these services; they don't reimplement the logic.

**Core domain invariant: money is always an integer number of paise**, both backend and frontend —
never a float, anywhere. Rupee strings are the only representation that crosses the API boundary
(converted via `Decimal`, rejecting >2 decimal places); paise integers are the only representation
used internally and in arithmetic.

**Data model** (`Group` → `Member` → `Expense`/`ExpenseShare`/`Settlement`, all scoped to a `Group`
via `share_code`): there are no user accounts — access is purely by unguessable share-link, like
Google Docs link-sharing. Every write path that touches a `Member` must validate that member belongs
to the same `Group` as the other entities in the request (expenses, shares, settlements can't cross
groups). `PROTECT` (not `CASCADE`) is used on member foreign keys so a member with history can't be
deleted and silently break balance totals.

**Balances are derived, never stored.** `compute_net_balances` recomputes net position from the full
expense/settlement history on every request; `simplify_debts` recomputes the suggested minimal
payment list fresh every time too (greedy two-max-heap algorithm, ≤ n−1 transfers, deterministic via
member-id tie-breaking). Only completed `Settlement` rows are persisted. This means balances always
sum to exactly 0 — that invariant should be asserted in tests, and preserved in any change to the
expense/settlement logic.

**UPI integration is the product's distinguishing feature**: `services/upi.py` builds
`upi://pay?...` deep links consumed by the frontend for one-tap mobile payment or QR-code rendering
on desktop. See plan section 5.4 for the exact link format and encoding rules.

See `TRIPSPLIT_PLAN.md` sections 3–7 for the full golden rules, data model, algorithm
specifications, API contract, and frontend page spec before implementing any part of this system.
