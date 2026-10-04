# TripSplit — Project Plan

A group trip expense splitter (Splitwise-style) for India. Members add shared expenses, the app works out who owes whom using the fewest possible payments, and each payment gets a **UPI deep link / QR code** so people can settle in one tap.

> **How to use this file with Claude Code:** put it in the root of the repo (you can also save a copy as `CLAUDE.md`, which Claude Code reads automatically at the start of a session). Work one milestone at a time, e.g. *"Read TRIPSPLIT_PLAN.md and do Milestone 1.1. Explain each file after you write it."* Tick the checkboxes as you go.

---

## 1. Goals and non-goals

**Goals (v1)**
- Create a trip with members (name + UPI ID) and get a shareable link.
- Add, list and delete expenses; split equally between all or selected members.
- Show net balances and a minimal list of suggested payments.
- One-tap UPI payment link on mobile, QR code on desktop, "Copy UPI ID" fallback.
- "Mark as paid" to record settlements.
- Deployed, with a live demo link and a solid README.

**Non-goals (v1)**
- No user accounts or login. Access is by share link (like Google Docs "anyone with the link").
- No real payment processing or payment confirmation (plain UPI links can't confirm payment).
- No multi-currency.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, Django 5.x, Django REST Framework |
| Database | PostgreSQL in production, SQLite for local dev (via `DATABASE_URL`) |
| Frontend | React + TypeScript (Vite), Tailwind CSS, React Router |
| QR codes | `qrcode.react` |
| Backend hosting | Render (or Railway), Gunicorn, WhiteNoise for admin static files |
| DB hosting | Render PostgreSQL or Neon |
| Frontend hosting | Vercel |
| CI | GitHub Actions (run backend tests + frontend build on every push) |

**Repo layout (monorepo)**
```
tripsplit/
├── TRIPSPLIT_PLAN.md
├── README.md
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── config/            # settings.py, urls.py, wsgi.py
│   └── trips/
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── admin.py
│       ├── services/
│       │   ├── balances.py   # pure Python money logic (no Django imports)
│       │   └── upi.py        # UPI link + rupee/paise helpers
│       └── tests/
│           ├── test_balances.py
│           ├── test_upi.py
│           └── test_api.py
├── frontend/
│   ├── src/
│   │   ├── api/client.ts
│   │   ├── types.ts
│   │   ├── lib/money.ts
│   │   ├── lib/upi.ts
│   │   ├── pages/
│   │   └── components/
│   └── ...
└── .github/workflows/ci.yml
```

---

## 3. Golden rules (Claude Code must follow these)

1. **Money is always an integer number of paise.** Never use `float` for money anywhere (backend or frontend). Convert rupee input with `Decimal` on the backend; reject more than 2 decimal places instead of rounding silently.
2. **Equal splits are deterministic.** Leftover paise go one each to members in ascending id order. Example: ₹100 split 3 ways → 3334, 3333, 3333 paise.
3. **Balances always sum to exactly 0.** Tests must assert this invariant.
4. **Suggested payments are computed fresh on every request**, never stored. Only *completed* settlements are stored, because any new expense changes who owes whom.
5. **Keep business logic in `trips/services/`** as pure functions with no Django imports, so it is easy to unit test.
6. **Validate group membership everywhere.** A member from another trip must never be usable as payer, split participant, or settlement party.
7. **Multi-row writes use `transaction.atomic`** (an expense and its shares are saved together or not at all).
8. **Work in small steps.** After each step: run the tests, then explain what was written and why. Don't generate the whole app in one go.
9. **No secrets in code.** Everything environment-specific comes from environment variables; provide `.env.example`.

---

## 4. Data model

```
Group        id, name, share_code (unique, 8 url-safe chars, auto), created_at
Member       id, group → Group, name, upi_id
             unique (group, name)
Expense      id, group → Group, paid_by → Member (PROTECT), amount_paise (>0),
             description, created_at
ExpenseShare id, expense → Expense (CASCADE), member → Member (PROTECT), share_paise
             unique (expense, member)
Settlement   id, group → Group, from_member → Member, to_member → Member,
             amount_paise (>0), paid_at
             check: from_member != to_member
```

- `PROTECT` on member foreign keys: you can't delete someone who has expenses or payments, otherwise the books won't balance.
- UPI ID validation regex: `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`

---

## 5. Core algorithms (`trips/services/balances.py`)

### 5.1 `split_equally(total_paise, member_ids) -> dict[id, int]`
`base, remainder = divmod(total, n)`; first `remainder` members (sorted by id) get `base + 1`, the rest get `base`. Raise `ValueError` for zero members or non-positive amounts.

### 5.2 `compute_net_balances(expenses, settlements, member_ids) -> dict[id, int]`
- For each expense: payer `+= amount`; each member in shares `-= share`. Raise if shares don't sum to amount.
- For each settlement (from → to, amount): `from += amount`, `to -= amount`.
- Positive = is owed money; negative = owes money. Include every member (0 if no activity).

### 5.3 `simplify_debts(balances) -> list[Transfer]`
Greedy with two max-heaps:
1. Creditors (balance > 0) and debtors (balance < 0) into separate heaps.
2. Pop the largest of each, transfer `min(credit, debt)`, record `Transfer(from=debtor, to=creditor, amount)`.
3. Push back whoever still has a remaining balance; repeat until a heap is empty.

Properties: at most **n − 1** transfers for n non-zero members, O(n log n). Not guaranteed to be the absolute minimum (that problem is NP-hard), which is fine for v1. Use member id as heap tie-breaker so output is deterministic. Raise if balances don't sum to 0.

### 5.4 UPI helpers (`trips/services/upi.py`)
- `paise_to_rupees_str(45050) -> "450.50"` (integer maths only)
- `rupees_to_paise("450.5") -> 45050` (Decimal; reject > 2 decimal places)
- `build_upi_link(upi_id, payee_name, amount_paise, note)`:
  ```
  upi://pay?pa=<upi_id>&pn=<name>&am=<450.00>&cu=INR&tn=<note>
  ```
  URL-encode with spaces as `%20` (`urlencode(..., quote_via=quote, safe="@")`), note max 50 chars.

---

## 6. API contract

Base path: `/api/`. All group URLs use `share_code`. Amounts are **sent as rupee strings** (`"450.50"`) and **returned as both** `amount_paise` (int) and a display string.

| Method | Path | Purpose |
|---|---|---|
| POST | `/groups/` | Create trip with members |
| GET | `/groups/{code}/` | Trip details + members |
| POST | `/groups/{code}/members/` | Add a member |
| GET | `/groups/{code}/expenses/` | List expenses (newest first) |
| POST | `/groups/{code}/expenses/` | Add expense |
| DELETE | `/groups/{code}/expenses/{id}/` | Delete expense |
| GET | `/groups/{code}/settlements/` | List recorded payments |
| POST | `/groups/{code}/settlements/` | Mark a payment as done |
| GET | `/groups/{code}/balances/` | Net balances + suggested payments with UPI links |

**Create trip**
```json
POST /api/groups/
{ "name": "Munnar Trip",
  "members": [ {"name": "Dheeraj", "upi_id": "dheeraj@okaxis"},
               {"name": "Arjun",   "upi_id": "arjun@ybl"},
               {"name": "Meera",   "upi_id": "meera@paytm"} ] }
→ 201 { "id": 1, "name": "Munnar Trip", "share_code": "kX3_p9Qa", "members": [...] }
```
Validation: at least 2 members, unique names (case-insensitive), valid UPI IDs.

**Add expense**
```json
POST /api/groups/kX3_p9Qa/expenses/
{ "paid_by": 1, "amount": "1500.00", "description": "Houseboat",
  "split_between": [1, 2, 3] }      // optional; defaults to all members
→ 201 { "id": 7, "paid_by_name": "Dheeraj", "amount_paise": 150000,
        "amount_display": "1500.00",
        "shares": [ {"member": 1, "member_name": "Dheeraj", "share_paise": 50000, "share": "500.00"}, ... ] }
```
Validation: amount 0.01 – 10,00,000; payer and split members must belong to this trip.

**Mark as paid**
```json
POST /api/groups/kX3_p9Qa/settlements/
{ "from_member": 2, "to_member": 1, "amount": "500.00" }
```
Validation: both in trip, not the same person, amount > 0.

**Balances**
```json
GET /api/groups/kX3_p9Qa/balances/
→ { "group": "Munnar Trip", "total_spent": "1500.00", "is_settled": false,
    "balances": [ {"member_id": 1, "name": "Dheeraj", "balance_paise": 100000, "balance": "+1000.00"}, ... ],
    "suggested_payments": [
      { "from_member": 2, "from_name": "Arjun", "to_member": 1, "to_name": "Dheeraj",
        "to_upi_id": "dheeraj@okaxis", "amount_paise": 50000, "amount": "500.00",
        "upi_link": "upi://pay?pa=dheeraj@okaxis&pn=Dheeraj&am=500.00&cu=INR&tn=TripSplit%3A%20Munnar%20Trip" } ] }
```

---

## 7. Frontend spec

**Pages (React Router)**
| Route | Page | Contents |
|---|---|---|
| `/` | Home / Create Trip | Trip name, dynamic list of members (name + UPI ID, add/remove rows), "Create trip" → redirect to `/t/{code}` |
| `/t/:code` | Trip Dashboard | Trip name, "Copy share link" + WhatsApp share button, members list, expense list with delete, "Add expense" button, total spent |
| `/t/:code/add` | Add Expense (or modal) | Description, amount, paid by (select), split between (checkboxes, all checked by default), live preview of each share |
| `/t/:code/settle` | Balances & Settle Up | Balance per member (green = gets back, red = owes), suggested payments as cards, settlement history |

**Payment card behaviour**
- Shows "Arjun pays Dheeraj ₹500.00".
- **Mobile** (detect with `navigator.userAgent` / touch + screen width): "Pay ₹500 via UPI" button that opens `upi_link`.
- **Desktop:** QR code of `upi_link` (`qrcode.react`) with "Scan with any UPI app".
- Always: "Copy UPI ID" button (fallback, since some apps block prefilled P2P links).
- "Mark as paid" → confirm dialog → POST settlement → refetch balances.
- WhatsApp reminder button: `https://wa.me/?text=` + encoded "Hey Arjun, you owe ₹500 for Munnar Trip. Pay here: {upi_link}".

**Frontend rules**
- Typed API client in `src/api/client.ts` with types in `src/types.ts` matching section 6.
- API base URL from `import.meta.env.VITE_API_URL`.
- `lib/money.ts`: format paise for display (`₹1,500.00`, Indian grouping via `Intl.NumberFormat('en-IN')`). Never do money arithmetic with floats in the UI; display only.
- Mobile-first layout; test at 375px width.
- Loading, empty ("No expenses yet — add your first one"), and error states on every page.
- Remember recently opened trips in `localStorage` so the home page can list them.

---

## 8. Testing plan

**Backend unit tests (`test_balances.py`, `test_upi.py`)**
- [ ] Equal split: divisible amount; ₹100 / 3 → 3334, 3333, 3333; shares always sum to total; deterministic regardless of input order; errors on zero members / zero amount.
- [ ] Net balances: simple 3-person case; one person paid everything; partial split (subset of members); settlements move balances toward 0; balances always sum to 0; member with no activity shows 0.
- [ ] Simplify debts: already settled → []; 2 people → 1 transfer; 5+ people → ≤ n − 1 transfers; applying the transfers zeroes every balance; error if balances don't sum to 0.
- [ ] A randomized test: 200 random trips, assert sum-to-zero, ≤ n − 1 transfers, transfers settle everyone.
- [ ] UPI: valid/invalid IDs; `paise_to_rupees_str` (5 → "0.05", 45050 → "450.50"); `rupees_to_paise` rejects "10.999" and non-numbers; link contains correct `pa`, `am`, `cu=INR`, encodes spaces as `%20`.

**Backend API tests (`test_api.py`)**
- [ ] Create trip (success, < 2 members, duplicate names, bad UPI ID).
- [ ] Add expense (success, default split = everyone, payer from another trip → 400, split member from another trip → 400, negative / 3-decimal amount → 400).
- [ ] Balances end-to-end with UPI links present.
- [ ] Mark as paid reduces the debt; fully paid trip returns `is_settled: true`.
- [ ] Delete expense updates balances; unknown share code → 404.

**Frontend**
- [ ] Vitest for `lib/money.ts` and `lib/upi.ts`.
- [ ] Manual test on a real phone with GPay/PhonePe/Paytm using ₹1 between friends.

---

## 9. Milestones

### Milestone 1 — Backend (Day 1)
- [ ] 1.1 Scaffold `backend/` (Django project `config`, app `trips`), settings from env vars (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`), DRF + `django-cors-headers` + `dj-database-url`, `requirements.txt`, `.env.example`.
- [ ] 1.2 `services/balances.py` and `services/upi.py` + their unit tests (write tests first if you can). All passing.
- [ ] 1.3 Models + migrations + admin registration.
- [ ] 1.4 Serializers with validation (section 6).
- [ ] 1.5 Views + URLs.
- [ ] 1.6 API tests. All passing.
- [ ] 1.7 Manual smoke test with the DRF browsable API or Postman: create trip → add 3 expenses → check balances → mark paid → check balances.
- [ ] **Learning checkpoint:** ask Claude Code to explain the debt-simplification algorithm with a 4-person example, and why money is stored in paise.

### Milestone 2 — Frontend (Day 2)
- [ ] 2.1 Scaffold `frontend/` with Vite (React + TS), Tailwind, React Router, `.env` with `VITE_API_URL`.
- [ ] 2.2 `types.ts`, `api/client.ts`, `lib/money.ts`, `lib/upi.ts` (+ Vitest tests).
- [ ] 2.3 Create Trip page.
- [ ] 2.4 Trip Dashboard + Add Expense form with live share preview.
- [ ] 2.5 Balances & Settle Up page: payment cards, UPI button / QR, Copy UPI ID, Mark as paid, WhatsApp reminder.
- [ ] 2.6 Loading / empty / error states; mobile layout check at 375px.
- [ ] **Learning checkpoint:** ask Claude Code to explain how the frontend talks to the backend (CORS, fetch, state refresh after "Mark as paid").

### Milestone 3 — Deploy & polish (Day 3)
- [ ] 3.1 Backend production setup: `gunicorn`, `whitenoise`, `DEBUG=False`, `collectstatic`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, build/start commands. Deploy to Render with PostgreSQL; run migrations.
- [ ] 3.2 Deploy frontend to Vercel with `VITE_API_URL` pointing to the backend; set SPA rewrite so `/t/:code` routes work on refresh; add the Vercel URL to `CORS_ALLOWED_ORIGINS`.
- [ ] 3.3 GitHub Actions CI: backend tests + frontend lint/build on push.
- [ ] 3.4 Real-phone test of the full flow with ₹1 payments in 2–3 UPI apps.
- [ ] 3.5 README (see section 10), screenshots, a GIF of the pay flow, 30-second demo video for LinkedIn.
- [ ] **Learning checkpoint:** ask Claude Code for 10 interview questions about this project and practise answering them without help.

### Milestone 4 — Stretch (only after v1 is live)
- [ ] Unequal splits: exact amounts and percentages (validate they sum to the total).
- [ ] Expense categories (food, travel, stay) + spending pie chart.
- [ ] Edit expense.
- [ ] Export trip summary as PDF.
- [ ] Simple rate limiting on write endpoints (DRF throttling).
- [ ] Optional login (to see "my trips" across devices).

---

## 10. README outline

1. One-line pitch + live demo link + screenshot/GIF.
2. Features.
3. Tech stack.
4. Architecture diagram (React → DRF API → PostgreSQL).
5. **How the debt simplification works** (short explanation + example).
6. **Design decisions:** paise integers, deterministic splits, computed-not-stored suggestions, share-link access.
7. **Limitations (be honest):** payment confirmation is manual; some UPI apps block prefilled P2P links; share links are the only access control; greedy algorithm isn't always the theoretical minimum.
8. Running locally (backend + frontend), running tests.
9. Future improvements.

---

## 11. Resume entry (fill in real numbers once built)

> **TripSplit — Group Expense Splitter with UPI Settlement** | React, TypeScript, Django REST Framework, PostgreSQL | [Live] [GitHub]
> - Built and deployed a full-stack expense-sharing app that settles group debts with at most n−1 payments using a greedy heap-based debt-simplification algorithm.
> - Integrated UPI deep links and QR codes for one-tap settlement; stored money as integer paise to eliminate floating-point rounding errors.
> - Wrote XX unit and API tests (including randomized invariant tests) running in GitHub Actions CI.

---

## 12. Interview prep (be able to answer these yourself)

- Why store money as integers in paise instead of floats? What goes wrong with floats?
- Walk through the debt-simplification algorithm on a whiteboard. Why is it at most n−1 payments? Is it always optimal?
- Where do the leftover paise go in an uneven split, and why does it need to be deterministic?
- Why compute suggested payments on every request instead of storing them?
- How would you confirm a payment actually happened? (Payment gateway such as Razorpay + webhooks.)
- What happens if two people add expenses at the same time? (Each expense is independent and atomic; balances are derived, so there's no shared counter to corrupt.)
- What are the security risks of share-link access, and how would you add proper accounts?
- Why `PROTECT` instead of `CASCADE` on member foreign keys?
- How would this scale to 10,000 trips? (Indexes on `share_code` and foreign keys, query prefetching, caching balances.)
