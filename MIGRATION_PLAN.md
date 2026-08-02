# Nutrition App — Repo Segregation & Backend Consolidation Plan

**Goal:** Split the two Emergent-generated repos into **three clean repos sharing one backend**:

| New repo | Source | Stack | Purpose |
|---|---|---|---|
| `nutrition-backend` | `coaching-app-web/backend/` | FastAPI + MongoDB | **Single source of truth** for web + mobile |
| `dietitian-web` | `coaching-app-web/frontend/` | React (CRA + Radix + Tailwind) | Dietitian portal |
| `client-mobile` | `client-mobile-app/frontend/` | Expo / React Native | Client app |

**Decisions locked in:**
- Database of record: **`coaching_app`** (the web backend's DB). The mobile app's standalone backend and its `diettracker` DB are **retired**.
- Repo history: **fresh start per repo** (no `git filter-repo`; clean initial commit each).

---

## Current state (why it's messy)

- **Two backends, two databases.** Web backend (`coaching_app`, 5,484 lines, modular) vs mobile backend (`diettracker`, 1,094 lines, single `server.py`). Only the `users` collection name overlaps, and even those schemas differ.
- **The mobile app already talks to both backends.** `frontend/src/services/api.ts` → standalone Expo backend; `frontend/src/services/portalApi.ts` → the web portal backend. This dual-source split is the core problem.
- The web backend **already exposes a full client API** (`/api/client/*`) built for mobile, documented in `CLIENT_MOBILE_API.md`. So consolidation direction = fold mobile features into the web backend, not the reverse.

### Mobile backend collections → target in `coaching_app`

| Mobile collection | Web equivalent | Action |
|---|---|---|
| `users` | `users` (with roles) | Reconcile — client users already supported via `/client/auth/*` |
| `weight_logs` | `weight_entries` | Map to existing model |
| `meal_logs` | `meal_uploads` | Map / extend; mobile also has `/foods/search`, `/meals/today` (needs a food DB decision) |
| `water_logs`, `steps_logs`, `sleep_logs`, `workout_logs` | `daily_checkins` (partial) | **New** `client/*` tracking endpoints + collections |
| `progress_photos` | `files` / `meal_uploads` | **New** progress-photo endpoints (reuse storage layer in `app/core/storage.py`) |
| `goals` | client profile fields | Map onto client record or **new** `goals` collection |
| `notification_settings` | — | **New**; ties into push tokens (see `INTEGRATION_TODO.md`) |

---

## Phase 0 — Prep & safety (before touching anything)

1. Back up both MongoDB databases: `mongodump` of `coaching_app` and `diettracker`.
2. Tag current state in both repos: `git tag pre-split-snapshot`.
3. Inventory real production data: which DB has live client data today? If mobile users exist only in `diettracker`, plan a one-time user/data migration (Phase 1).
4. Confirm the deployed backend URL the mobile app uses in prod (`EXPO_PUBLIC_PORTAL_URL` vs `EXPO_PUBLIC_BACKEND_URL`).

## Phase 1 — Consolidate the database (highest risk; do while code is still together)

Do this work **inside the current `coaching-app-web` repo** so everything is in one place.

1. Add data models + handlers to the web backend for the mobile-only features (water/steps/sleep/workout/progress-photos/goals) as new modules under `app/handlers/` and `app/schemas/`, exposed under `/api/client/*`.
2. Write a one-time migration script (`backend/temp_migrate_diettracker.py`, following the existing `temp_*.py` convention) to copy any real `diettracker` data into `coaching_app`, mapping collections per the table above and de-duplicating `users` by email.
3. Verify the web backend serves every endpoint the mobile app needs (cross-check against `CLIENT_MOBILE_API.md` + the mobile app's `api.ts` call sites).
4. Run against a staging copy; validate mobile app end-to-end pointing only at the web backend.

## Phase 2 — Repoint the mobile app to a single backend

1. Move every call in `api.ts` onto `portalApi.ts` (the unified backend). Files touching `services/api`: the `(tabs)/*` screens, `check-in`, `goal-selection`, `meal-logger`, `progress-photos`, `sleep-tracker`, `workout-tracker`, `weekly-report`, `AuthContext`, `pushToken`.
2. Delete `src/services/api.ts` and the `EXPO_PUBLIC_BACKEND_URL` env var; keep one base URL.
3. Implement the 3 items in `INTEGRATION_TODO.md` (push-token endpoint, push-on-diet-plan-assign, etc.) in the backend.
4. Full regression of the mobile app against the unified backend.

## Phase 3 — Clean up Emergent scaffolding (both repos)

Remove/relocate before splitting: `.emergent/`, `.gitconfig`, `test_result.md`, `test_reports/`, `memory/`, `backend_test.py`, root `design_guidelines.json`, `temp_*.py` (after migration), `backend/data_cleanup_backups/`, `backend/local_uploads/` (move to object storage/gitignore), committed `frontend/build/`. Confirm `.venv` / `node_modules` stay ignored (currently untracked — good).

## Phase 4 — Split into three repos (fresh start)

For each new repo:

```bash
# 1. Create the target dir with only the relevant subtree
mkdir nutrition-backend && cp -r coaching-app-web/backend/* nutrition-backend/
cd nutrition-backend && git init -b main
# 2. Add per-repo .gitignore, .env.example, README, Dockerfile/CI
git add -A && git commit -m "chore: initial commit — nutrition backend split from coaching-app-web"
```

- `nutrition-backend` ← `coaching-app-web/backend/` (+ move `CLIENT_MOBILE_API.md`, `Dockerfile`, `start.sh`)
- `dietitian-web` ← `coaching-app-web/frontend/`
- `client-mobile` ← `client-mobile-app/frontend/`

Each repo gets its own `.env.example`, `README.md`, and CI workflow. Frontends reference the backend only by a configurable base URL — **no shared code copied between them** (keep the contract HTTP-only for now).

## Phase 5 — Per-repo hardening

1. **Backend:** pin/prune `requirements.txt`, add `/health`, structured config via `app/core/config.py`, containerize, deploy (Render/Fly/Railway/etc.). Lock `CORS_ORIGINS` to the web + mobile origins.
2. **Web:** set `REACT_APP_*`/craco env for the API URL; deploy static build (Vercel/Netlify/S3+CF).
3. **Mobile:** set one `EXPO_PUBLIC_PORTAL_URL`; set up EAS build/submit.
4. Point all three at the same staging backend, smoke-test, then cut prod.

---

## Optional future improvement: shared API types

Frontends currently duplicate request/response shapes by hand. Later, you can generate an OpenAPI spec from FastAPI (`/openapi.json`) and codegen a typed client for both the web and mobile apps — a lightweight way to keep the contract in sync without a monorepo. Not needed for the initial split.

## Risk register

| Risk | Mitigation |
|---|---|
| Data loss migrating `diettracker` → `coaching_app` | `mongodump` first; migrate to a staging copy; idempotent, re-runnable script |
| Duplicate `users` across DBs | De-dupe by email; decide precedence before merge |
| Mobile app breaks when standalone backend retired | Phase 2 regression before retiring `api.ts`; keep old backend running until cutover |
| `/foods/search` has no equivalent on web backend | Decide food-data source (static DB vs 3rd-party API) during Phase 1 |
| Losing git history | Accepted (fresh start); `pre-split-snapshot` tags + archived old repos preserve it |
