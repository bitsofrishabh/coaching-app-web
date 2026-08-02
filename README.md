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
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:3000
```

`JWT_SECRET` must be a unique, non-placeholder value. You can generate one locally with:

```bash
openssl rand -hex 32
```

`CORS_ORIGINS` accepts a comma-separated list of explicit frontend origins. Wildcard origins are intentionally rejected because this API uses credentialed requests.

### One-time prerequisite for Atlas on macOS

```bash
brew install python@3.11
```
