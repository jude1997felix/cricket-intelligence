"""
Player enrichment script.

Fetches batting style, bowling style, and role for every player in the DB
using the Cricsheet people register (for cricbuzz/cricinfo IDs) and
Cricbuzz player profile pages.

Usage:
  python enrich_players.py            # enrich all unenriched players
  python enrich_players.py --all      # re-enrich everyone (overwrite)
  python enrich_players.py --limit 50 # enrich first N unenriched players

Rate limit: 1 request/second by default (--delay to override).
"""

import os
import re
import csv
import time
import io
import zipfile
import argparse
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env.local'))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ── Cricsheet register ──────────────────────────────────────────────────────────

def load_cricsheet_register() -> dict[str, dict]:
    """Download Cricsheet people.csv and build identifier → {cricbuzz_id, cricinfo_id} map."""
    print('Downloading Cricsheet player register...')
    resp = SESSION.get('https://cricsheet.org/register/people.csv', timeout=30)
    resp.raise_for_status()

    register: dict[str, dict] = {}
    reader = csv.DictReader(io.StringIO(resp.text))
    for row in reader:
        identifier = row.get('identifier', '').strip()
        if identifier:
            register[identifier] = {
                'cricbuzz_id': row.get('key_cricbuzz', '').strip(),
                'cricinfo_id': row.get('key_cricinfo', '').strip(),
                'name': row.get('unique_name', row.get('name', '')).strip(),
            }
    print(f'  Loaded {len(register)} players from register')
    return register


# ── Style parsing ───────────────────────────────────────────────────────────────

BATTING_STYLE_MAP = {
    'right handed bat': 'RIGHT_HAND',
    'right-hand bat': 'RIGHT_HAND',
    'right hand bat': 'RIGHT_HAND',
    'left handed bat': 'LEFT_HAND',
    'left-hand bat': 'LEFT_HAND',
    'left hand bat': 'LEFT_HAND',
}

BOWLING_STYLE_MAP = {
    'right-arm fast': 'RIGHT_ARM_FAST',
    'right arm fast': 'RIGHT_ARM_FAST',
    'right-arm fast-medium': 'RIGHT_ARM_FAST',
    'right-arm medium-fast': 'RIGHT_ARM_MEDIUM',
    'right-arm medium': 'RIGHT_ARM_MEDIUM',
    'right arm medium': 'RIGHT_ARM_MEDIUM',
    'right-arm off': 'RIGHT_ARM_OFFSPIN',
    'right-arm offbreak': 'RIGHT_ARM_OFFSPIN',
    'off break': 'RIGHT_ARM_OFFSPIN',
    'off-break': 'RIGHT_ARM_OFFSPIN',
    'right-arm leg': 'RIGHT_ARM_LEGSPIN',
    'right-arm legbreak': 'RIGHT_ARM_LEGSPIN',
    'leg break': 'RIGHT_ARM_LEGSPIN',
    'leg-break': 'RIGHT_ARM_LEGSPIN',
    'left-arm fast': 'LEFT_ARM_FAST',
    'left arm fast': 'LEFT_ARM_FAST',
    'left-arm fast-medium': 'LEFT_ARM_FAST',
    'left-arm medium-fast': 'LEFT_ARM_MEDIUM',
    'left-arm medium': 'LEFT_ARM_MEDIUM',
    'left arm medium': 'LEFT_ARM_MEDIUM',
    'left-arm orthodox': 'LEFT_ARM_ORTHODOX',
    'slow left-arm orthodox': 'LEFT_ARM_ORTHODOX',
    'left arm orthodox': 'LEFT_ARM_ORTHODOX',
    'left-arm wrist': 'LEFT_ARM_WRIST_SPIN',
    'left-arm wrist-spin': 'LEFT_ARM_WRIST_SPIN',
    'chinaman': 'LEFT_ARM_WRIST_SPIN',
}

ROLE_MAP = {
    'batter': 'BATTER',
    'batsman': 'BATTER',
    'top order batter': 'BATTER',
    'middle order batter': 'BATTER',
    'opening batter': 'BATTER',
    'bowler': 'BOWLER',
    'all-rounder': 'ALL_ROUNDER',
    'allrounder': 'ALL_ROUNDER',
    'batting allrounder': 'ALL_ROUNDER',
    'bowling allrounder': 'ALL_ROUNDER',
    'wicketkeeper': 'WICKET_KEEPER',
    'wicket-keeper': 'WICKET_KEEPER',
    'wicket keeper': 'WICKET_KEEPER',
    'wicketkeeper batter': 'WICKET_KEEPER',
}


def parse_style(raw: str, style_map: dict) -> str | None:
    if not raw:
        return None
    lower = raw.lower().strip()
    for key, val in style_map.items():
        if key in lower:
            return val
    return None


def fetch_cricbuzz_profile(cricbuzz_id: str) -> dict:
    """Scrape batting style, bowling style, role from a Cricbuzz player profile."""
    url = f'https://www.cricbuzz.com/profiles/{cricbuzz_id}'
    try:
        resp = SESSION.get(url, timeout=15)
        if resp.status_code != 200:
            return {}
        html = resp.text

        batting_raw = ''
        bowling_raw = ''
        role_raw = ''

        m = re.search(r'Batting Style.{0,300}', html)
        if m:
            batting_raw = re.sub(r'<[^>]+>', '', m.group())[:80]

        m = re.search(r'Bowling Style.{0,300}', html)
        if m:
            bowling_raw = re.sub(r'<[^>]+>', '', m.group())[:80]

        m = re.search(r'Playing Role.{0,300}', html)
        if m:
            role_raw = re.sub(r'<[^>]+>', '', m.group())[:80]

        return {
            'batting_style': parse_style(batting_raw, BATTING_STYLE_MAP),
            'bowling_style': parse_style(bowling_raw, BOWLING_STYLE_MAP),
            'role': parse_style(role_raw, ROLE_MAP),
            'batting_raw': batting_raw,
            'bowling_raw': bowling_raw,
        }
    except Exception as e:
        return {'error': str(e)}


# ── DB helpers ──────────────────────────────────────────────────────────────────

def get_unenriched_players(limit: int | None) -> list[dict]:
    q = sb.table('players') \
        .select('player_id, name, cricsheet_identifier') \
        .is_('batting_style', 'null')
    if limit:
        q = q.limit(limit)
    return q.execute().data or []


def get_all_players(limit: int | None) -> list[dict]:
    q = sb.table('players').select('player_id, name, cricsheet_identifier')
    if limit:
        q = q.limit(limit)
    return q.execute().data or []


def update_player(player_id: str, updates: dict):
    sb.table('players').update(updates).eq('player_id', player_id).execute()


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true', help='Re-enrich all players, not just unenriched')
    parser.add_argument('--limit', type=int, help='Max players to process')
    parser.add_argument('--delay', type=float, default=1.0, help='Seconds between requests (default 1.0)')
    args = parser.parse_args()

    register = load_cricsheet_register()

    players = get_all_players(args.limit) if args.all else get_unenriched_players(args.limit)
    print(f'\nPlayers to enrich: {len(players)}')

    ok = skipped = errors = 0

    for i, player in enumerate(players):
        name = player['name']
        cricsheet_id = player.get('cricsheet_identifier', '')

        # Look up cricbuzz ID via Cricsheet register
        reg_entry = register.get(cricsheet_id, {})
        cricbuzz_id = reg_entry.get('cricbuzz_id', '')

        if not cricbuzz_id:
            skipped += 1
            print(f'  [{i+1}/{len(players)}] SKIP {name} — no cricbuzz ID in register')
            continue

        profile = fetch_cricbuzz_profile(cricbuzz_id)

        if 'error' in profile:
            errors += 1
            print(f'  [{i+1}/{len(players)}] ERROR {name}: {profile["error"]}')
        else:
            updates = {k: v for k, v in {
                'batting_style': profile.get('batting_style'),
                'bowling_style': profile.get('bowling_style'),
                'role': profile.get('role'),
                'cricinfo_id': reg_entry.get('cricinfo_id') or None,
                'cricbuzz_id': cricbuzz_id,
            }.items() if v is not None}

            if updates:
                update_player(player['player_id'], updates)
                ok += 1
                print(f'  [{i+1}/{len(players)}] ✓ {name} — bat:{profile.get("batting_style")} bowl:{profile.get("bowling_style")} role:{profile.get("role")}')
            else:
                skipped += 1
                print(f'  [{i+1}/{len(players)}] ~ {name} — no styles parsed (bat_raw: "{profile.get("batting_raw","")}")')

        time.sleep(args.delay)

    print(f'\nDone — {ok} enriched, {skipped} skipped, {errors} errors')


if __name__ == '__main__':
    main()
