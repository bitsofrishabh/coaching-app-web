# DietTracker Pro

A unified management platform for dietitians and coaches to handle clients, diet plans, progress tracking, and finances.

## Architecture

- **Frontend**: React 19 + Create React App (via CRACO) + Tailwind CSS + shadcn/ui, running on port 5000
- **Backend**: FastAPI (Python 3.12) + MongoDB (Motor async driver), running on port 8000
- **Database**: MongoDB Atlas (connection via MONGO_URL secret)
- **Auth**: JWT-based authentication

## Project Structure

```
frontend/         React application
  src/
    components/   UI components (app/ and ui/)
    pages/        Application views
    lib/          API client and utilities
    context/      Auth context
  plugins/        Build-time plugins (visual-edits, health-check)
  craco.config.js CRACO webpack config with Replit proxy support

backend/
  server.py       FastAPI app with all routes and logic (3500+ lines)
  requirements.txt Python dependencies
  .env            Local env file (MONGO_URL, DB_NAME, JWT_SECRET)
  local_uploads/  Local file storage fallback
```

## Workflows

- **Start application** — Frontend dev server: `cd frontend && npm start` (port 5000, webview)
- **Backend API** — FastAPI server: `cd backend && python3 -m uvicorn server:app --host localhost --port 8000 --reload` (port 8000, console)

## Environment Variables / Secrets

- `MONGO_URL` — MongoDB Atlas connection string (secret)
- `DB_NAME` — MongoDB database name (secret)
- `JWT_SECRET` — JWT signing secret (set in backend/.env)

## Key Features

- Client CRUD and progress tracking (weight, adherence)
- Diet plan builder and meal review system
- Real-time chat between coach and client
- Finance tracker for coach income and expenses
- Mobile Client API for future mobile app integration

## Development Notes

- The frontend uses CRACO to extend Create React App with custom webpack/babel plugins
- `craco.config.js` has `allowedHosts: "all"` and `host: "0.0.0.0"` configured for Replit's proxy
- Backend `.env` is loaded from `backend/.env` (not committed, contains secrets)
- The babel-metadata-plugin has a null-check fix for `traverse()` calls on cached ASTs
- Frontend connects to backend via `REACT_APP_BACKEND_URL=http://localhost:8000`
- File uploads use local storage fallback (no EMERGENT_LLM_KEY configured)
