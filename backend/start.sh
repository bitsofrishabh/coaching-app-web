#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
REQ_FILE="${SCRIPT_DIR}/requirements.txt"
ENV_FILE="${SCRIPT_DIR}/.env"
STAMP_FILE="${VENV_DIR}/.requirements_hash"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

python_ssl_version() {
  local candidate="$1"
  "${candidate}" -c 'import ssl; print(ssl.OPENSSL_VERSION)' 2>/dev/null || true
}

is_libressl() {
  local candidate="$1"
  local ssl_version
  ssl_version="$(python_ssl_version "${candidate}")"
  [[ "${ssl_version}" == *"LibreSSL"* ]]
}

pick_python() {
  local candidate
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "${candidate}" >/dev/null 2>&1 && ! is_libressl "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it with MONGO_URL and DB_NAME before starting."
  exit 1
fi

cd "${SCRIPT_DIR}"

PYTHON_BIN="$(pick_python || true)"
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "No compatible Python runtime found."
  echo "Python linked with OpenSSL is required for MongoDB Atlas."
  echo "On macOS: brew install python@3.11"
  exit 1
fi

RECREATE_VENV=0
if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  RECREATE_VENV=1
elif "${VENV_DIR}/bin/python" -c 'import ssl, sys; sys.exit(0 if "LibreSSL" in ssl.OPENSSL_VERSION else 1)'; then
  RECREATE_VENV=1
fi

if [[ "${RECREATE_VENV}" -eq 1 ]]; then
  rm -rf "${VENV_DIR}"
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

REQ_HASH="$(shasum "${REQ_FILE}" | awk '{print $1}')"
CURRENT_HASH=""
if [[ -f "${STAMP_FILE}" ]]; then
  CURRENT_HASH="$(cat "${STAMP_FILE}")"
fi

if [[ "${REQ_HASH}" != "${CURRENT_HASH}" ]]; then
  python -m pip install --upgrade pip setuptools wheel
  pip install -r "${REQ_FILE}"
  echo "${REQ_HASH}" > "${STAMP_FILE}"
fi

exec uvicorn server:app --reload --host "${HOST}" --port "${PORT}"
