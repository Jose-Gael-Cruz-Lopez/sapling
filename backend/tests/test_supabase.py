"""
test_supabase.py — Run from backend/ to verify Supabase connectivity.

Usage:
    cd backend
    python test_supabase.py
"""

import os
import sys

# Allow running from anywhere inside the project
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
INFO = "\033[94m→\033[0m"


def check(label: str, ok: bool, detail: str = ""):
    symbol = PASS if ok else FAIL
    msg = f"  {symbol}  {label}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    return ok


def main():
    print("\n\033[1mSapling — Supabase connection test\033[0m\n")
    all_ok = True

    # ── 1. Env vars ──────────────────────────────────────────────────────────
    print(f"{INFO} Checking environment variables …")
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

    url_ok = bool(supabase_url and "supabase.co" in supabase_url and "your-project" not in supabase_url)
    key_ok = bool(supabase_key and len(supabase_key) > 20 and "your-service" not in supabase_key)

    all_ok &= check("SUPABASE_URL set", url_ok, supabase_url[:40] + "…" if url_ok else "not set or still placeholder")
    all_ok &= check("SUPABASE_SERVICE_KEY set", key_ok, "looks valid" if key_ok else "not set or still placeholder")

    if not (url_ok and key_ok):
        print(f"\n  \033[93m⚠\033[0m  Set SUPABASE_URL and SUPABASE_SERVICE_KEY in backend/.env")
        print(f"  {INFO}  Get them from: Supabase Dashboard → your project → Settings → API\n")
        sys.exit(1)

    # ── 2. HTTP connectivity ──────────────────────────────────────────────────
    print(f"\n{INFO} Testing HTTP connectivity …")
    import httpx
    try:
        r = httpx.get(f"{supabase_url}/rest/v1/", headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
        }, timeout=10)
        http_ok = r.status_code < 500
        all_ok &= check("HTTP connection", http_ok, f"status {r.status_code}")
    except Exception as e:
        all_ok &= check("HTTP connection", False, str(e))
        print(f"\n  \033[93m⚠\033[0m  Cannot reach Supabase. Check your SUPABASE_URL.\n")
        sys.exit(1)

    # ── 3. Table access ───────────────────────────────────────────────────────
    print(f"\n{INFO} Checking table access …")
    from db.connection import table

    TABLES = ["users", "graph_nodes", "graph_edges", "courses", "sessions", "messages",
              "quiz_attempts", "quiz_context", "assignments", "oauth_tokens",
              "rooms", "room_members", "room_activity", "room_summaries"]

    for tname in TABLES:
        try:
            rows = table(tname).select("*", limit=1)
            all_ok &= check(f"table: {tname}", True, f"{len(rows)} row(s) returned")
        except Exception as e:
            all_ok &= check(f"table: {tname}", False, str(e))

    # ── 4. Summary ────────────────────────────────────────────────────────────
    print()
    if all_ok:
        print(f"  \033[92m✓ All checks passed — Supabase is connected and all tables are accessible.\033[0m")
    else:
        print(f"  \033[91m✗ Some checks failed. Review the output above.\033[0m")
        print(f"  {INFO}  If tables are missing, run: python db/seed.py  (after creating schema in Supabase)")
    print()
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
