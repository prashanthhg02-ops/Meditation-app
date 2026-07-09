from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, render_template

app = Flask(__name__, static_folder="static", template_folder="templates")

DATA_DIR = Path(__file__).resolve().parent / "data"
SESSIONS_FILE = DATA_DIR / "sessions.json"


def _ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SESSIONS_FILE.exists():
        SESSIONS_FILE.write_text("[]", encoding="utf-8")


def _read_sessions() -> list[dict]:
    _ensure_storage()
    try:
        return json.loads(SESSIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        # Corrupt file fallback
        return []


def _write_sessions(sessions: list[dict]) -> None:
    _ensure_storage()
    SESSIONS_FILE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/history")
def get_history():
    sessions = _read_sessions()
    # newest first, capped
    sessions_sorted = sorted(sessions, key=lambda x: x.get("completed_at", ""), reverse=True)
    return jsonify({"sessions": sessions_sorted[:50]})


@app.post("/api/history")
def post_history():
    payload = request.get_json(silent=True) or {}

    session_type = payload.get("type", "session")
    pattern = payload.get("pattern")
    duration_seconds = payload.get("duration_seconds")
    completed_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    # basic validation
    try:
        duration_seconds = int(duration_seconds)
    except Exception:
        duration_seconds = 0

    entry = {
        "type": session_type,
        "pattern": pattern,
        "duration_seconds": duration_seconds,
        "completed_at": completed_at,
    }

    sessions = _read_sessions()
    sessions.append(entry)
    _write_sessions(sessions)

    return jsonify({"ok": True, "entry": entry})


if __name__ == "__main__":
    # For local dev
    app.run(host="127.0.0.1", port=5000, debug=True)

