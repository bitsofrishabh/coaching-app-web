# Coaching App Web

## Run Frontend

```bash
cd frontend
yarn
yarn start
```

## Run Backend (One Command)

```bash
./backend/start.sh
```

`backend/start.sh` will:
- create `.venv` if missing
- install/update dependencies only when `requirements.txt` changes
- start FastAPI on `0.0.0.0:8000`
- auto-recreate `.venv` if it detects an Atlas-incompatible LibreSSL runtime

### Required backend env (`backend/.env`)

```env
MONGO_URL=...
DB_NAME=...
JWT_SECRET=change-me
CORS_ORIGINS=http://localhost:3000
```

### One-time prerequisite for Atlas on macOS

```bash
brew install python@3.11
```
