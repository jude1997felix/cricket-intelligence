"""
Cricsheet auto-ingestion script.

Downloads YAML data directly from cricsheet.org, processes only new matches
(skips already-ingested ones), and loads into Supabase.

Usage:
  python ingest.py                          # ingest all configured competitions
  python ingest.py --competition IPL        # ingest one competition
  python ingest.py --competition T20I       # ingest T20 internationals
  python ingest.py --list                   # show available competitions

Competitions are configured in COMPETITION_CONFIG below.
Add new ones here as scope expands (BBL, PSL, CPL, WPL, etc.)
"""

import os
import sys
import io
import zipfile
import argparse
import tempfile
import shutil
import yaml
import requests
from datetime import date
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env.local'))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Competition registry ────────────────────────────────────────────────────────
# Add new competitions here as scope expands. order matters for display only.
COMPETITION_CONFIG: dict[str, dict] = {
    'IPL': {
        'url': 'https://cricsheet.org/downloads/ipl_male_yaml.zip',
        'label': 'Indian Premier League (men)',
        'db_value': 'IPL',
        'weight_as': 'primary',       # primary = counts toward ipl_game_count
    },
    'SMAT': {
        'url': 'https://cricsheet.org/downloads/smat_male_yaml.zip',
        'label': 'Syed Mushtaq Ali Trophy (men)',
        'db_value': 'SMAT',
        'weight_as': 'domestic',
    },
    'T20I': {
        'url': 'https://cricsheet.org/downloads/t20s_male_yaml.zip',
        'label': 'T20 Internationals (men)',
        'db_value': 'T20I',
        'weight_as': 'domestic',
    },
    'T20I_W': {
        'url': 'https://cricsheet.org/downloads/t20s_female_yaml.zip',
        'label': 'T20 Internationals (women)',
        'db_value': 'T20I',
        'weight_as': 'domestic',
    },
    'BBL': {
        'url': 'https://cricsheet.org/downloads/bbl_male_yaml.zip',
        'label': 'Big Bash League (men)',
        'db_value': 'OTHER',
        'weight_as': 'domestic',
    },
    'PSL': {
        'url': 'https://cricsheet.org/downloads/psl_male_yaml.zip',
        'label': 'Pakistan Super League (men)',
        'db_value': 'OTHER',
        'weight_as': 'domestic',
    },
    'CPL': {
        'url': 'https://cricsheet.org/downloads/cpl_male_yaml.zip',
        'label': 'Caribbean Premier League (men)',
        'db_value': 'OTHER',
        'weight_as': 'domestic',
    },
    'SA20': {
        'url': 'https://cricsheet.org/downloads/sa20_male_yaml.zip',
        'label': 'SA20 (men)',
        'db_value': 'OTHER',
        'weight_as': 'domestic',
    },
}

# ── Venue name normalisation ────────────────────────────────────────────────────
VENUE_ALIASES: dict[str, str] = {
    'Wankhede Stadium, Mumbai': 'Wankhede Stadium',
    'M Chinnaswamy Stadium, Bengaluru': 'M Chinnaswamy Stadium',
    'M.Chinnaswamy Stadium': 'M Chinnaswamy Stadium',
    'M.A. Chidambaram Stadium, Chepauk, Chennai': 'MA Chidambaram Stadium',
    'MA Chidambaram Stadium, Chepauk': 'MA Chidambaram Stadium',
    'Eden Gardens, Kolkata': 'Eden Gardens',
    'Arun Jaitley Stadium, Delhi': 'Arun Jaitley Stadium',
    'Feroz Shah Kotla, Delhi': 'Arun Jaitley Stadium',
    'Rajiv Gandhi International Stadium, Uppal, Hyderabad': 'Rajiv Gandhi International Stadium',
    'Rajiv Gandhi International Cricket Stadium, Hyderabad': 'Rajiv Gandhi International Stadium',
    'Sawai Mansingh Stadium, Jaipur': 'Sawai Mansingh Stadium',
    'Punjab Cricket Association IS Bindra Stadium, Mohali, Chandigarh': 'PCA Stadium Mohali',
    'Punjab Cricket Association Stadium, Mohali': 'PCA Stadium Mohali',
    'Narendra Modi Stadium, Ahmedabad': 'Narendra Modi Stadium',
    'Sardar Patel Stadium, Motera': 'Narendra Modi Stadium',
    'BRSABV Ekana Cricket Stadium, Lucknow': 'Ekana Cricket Stadium',
    'Holkar Cricket Stadium, Indore': 'Holkar Stadium',
    'MCA International Stadium, Pune': 'MCA Stadium Pune',
    'Subrata Roy Sahara Stadium, Pune': 'MCA Stadium Pune',
    'Barsapara Cricket Stadium, Guwahati': 'Barsapara Stadium',
    'JSCA International Stadium Complex, Ranchi': 'JSCA International Stadium',
    'Himachal Pradesh Cricket Association Stadium, Dharamsala': 'HPCA Stadium Dharamsala',
    'Dr DY Patil Sports Academy, Mumbai': 'DY Patil Stadium',
    'Brabourne Stadium, Mumbai': 'Brabourne Stadium',
}


def phase_for_over(over: int) -> str:
    if over < 6:
        return 'POWERPLAY'
    elif over < 15:
        return 'MIDDLE'
    return 'DEATH'


def normalise_venue(raw: str) -> str:
    return VENUE_ALIASES.get(raw, raw)


# ── Download ────────────────────────────────────────────────────────────────────

def download_and_extract(url: str, dest_dir: str) -> int:
    print(f'  Downloading {url} ...')
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        yaml_files = [f for f in zf.namelist() if f.endswith('.yaml') or f.endswith('.yml')]
        zf.extractall(dest_dir)
    print(f'  Extracted {len(yaml_files)} YAML files')
    return len(yaml_files)


# ── Already-ingested check ──────────────────────────────────────────────────────

def get_ingested_ids() -> set[str]:
    result = sb.table('matches').select('cricsheet_match_id').execute()
    return {row['cricsheet_match_id'] for row in (result.data or [])}


# ── Venue upsert ────────────────────────────────────────────────────────────────

_venue_cache: dict[str, str] = {}

def upsert_venue(raw_name: str) -> str:
    canonical = normalise_venue(raw_name)
    if canonical in _venue_cache:
        return _venue_cache[canonical]

    existing = sb.table('venues').select('venue_id').eq('cricsheet_name', canonical).execute()
    if existing.data:
        vid = existing.data[0]['venue_id']
    else:
        city = raw_name.split(',')[-1].strip() if ',' in raw_name else raw_name
        res = sb.table('venues').insert({'name': canonical, 'city': city, 'cricsheet_name': canonical}).execute()
        vid = res.data[0]['venue_id']

    _venue_cache[canonical] = vid
    return vid


def bump_venue_count(venue_id: str, weight_as: str):
    col = 'ipl_game_count' if weight_as == 'primary' else 'domestic_game_count'
    sb.rpc('increment_venue_count', {'v_id': venue_id, 'col_name': col}).execute()


# ── Player upsert ───────────────────────────────────────────────────────────────

_player_cache: dict[str, str] = {}

def upsert_player(name: str) -> str:
    key = name.lower().replace(' ', '_')
    if key in _player_cache:
        return _player_cache[key]

    existing = sb.table('players').select('player_id').eq('cricsheet_key', key).execute()
    if existing.data:
        pid = existing.data[0]['player_id']
    else:
        res = sb.table('players').insert({'name': name, 'cricsheet_key': key}).execute()
        pid = res.data[0]['player_id']

    _player_cache[key] = pid
    return pid


def build_player_registry(info: dict) -> dict[str, str]:
    registry: dict[str, str] = {}
    for team_players in info.get('players', {}).values():
        for name in team_players:
            registry[name] = upsert_player(name)
    return registry


# ── Match ingestion ─────────────────────────────────────────────────────────────

def ingest_file(path: str, match_file_id: str, competition: str, weight_as: str, db_value: str) -> bool:
    with open(path, 'r') as f:
        data = yaml.safe_load(f)

    info = data.get('info', {})
    innings_list = data.get('innings', [])

    raw_venue = info.get('venue', 'Unknown')
    venue_id = upsert_venue(raw_venue)

    match_date_raw = info.get('dates', [None])[0]
    match_date = str(match_date_raw) if match_date_raw else str(date.today())

    toss = info.get('toss', {})
    outcome = info.get('outcome', {})
    teams = info.get('teams', ['', ''])

    player_registry = build_player_registry(info)

    toss_dec = toss.get('decision', '').upper()
    match_row = {
        'cricsheet_match_id': match_file_id,
        'venue_id': venue_id,
        'competition': db_value,
        'season': int(str(match_date)[:4]),
        'match_date': match_date,
        'team1': teams[0] if len(teams) > 0 else '',
        'team2': teams[1] if len(teams) > 1 else '',
        'toss_winner': toss.get('winner'),
        'toss_decision': toss_dec if toss_dec in ('BAT', 'FIELD') else None,
        'winner': outcome.get('winner'),
        'win_by_runs': outcome.get('by', {}).get('runs'),
        'win_by_wickets': outcome.get('by', {}).get('wickets'),
        'day_night': info.get('match_type_number') is not None,
    }

    match_result = sb.table('matches').insert(match_row).execute()
    match_id = match_result.data[0]['match_id']
    bump_venue_count(venue_id, weight_as)

    deliveries_batch = []
    for innings_idx, innings_data in enumerate(innings_list):
        innings_num = innings_idx + 1
        key = list(innings_data.keys())[0]
        team_data = innings_data.get(key, {})
        overs = team_data.get('overs', [])

        total_runs = 0
        total_wickets = 0

        for over_data in overs:
            over_num = over_data.get('over', 0)
            for ball_idx, delivery in enumerate(over_data.get('deliveries', [])):
                batter_name = delivery.get('batter', '')
                bowler_name = delivery.get('bowler', '')
                non_striker = delivery.get('non_striker', '')

                batter_id = player_registry.get(batter_name)
                bowler_id = player_registry.get(bowler_name)
                if not batter_id or not bowler_id:
                    continue

                runs = delivery.get('runs', {})
                wicket_info = delivery.get('wickets', [])
                is_wicket = len(wicket_info) > 0
                dismissed = wicket_info[0].get('player_out') if is_wicket else None

                total_runs += runs.get('total', 0)
                if is_wicket:
                    total_wickets += 1

                deliveries_batch.append({
                    'match_id': match_id,
                    'innings': innings_num,
                    'over_num': over_num,
                    'ball_num': ball_idx + 1,
                    'batter_id': batter_id,
                    'non_striker_id': player_registry.get(non_striker),
                    'bowler_id': bowler_id,
                    'runs_batter': runs.get('batter', 0),
                    'runs_extras': runs.get('extras', 0),
                    'runs_total': runs.get('total', 0),
                    'is_wicket': is_wicket,
                    'wicket_type': wicket_info[0].get('kind') if is_wicket else None,
                    'dismissed_player_id': player_registry.get(dismissed) if dismissed else None,
                    'phase': phase_for_over(over_num),
                })

        score_col = 'team1_score' if innings_num == 1 else 'team2_score'
        wkt_col = 'team1_wickets' if innings_num == 1 else 'team2_wickets'
        sb.table('matches').update({score_col: total_runs, wkt_col: total_wickets}).eq('match_id', match_id).execute()

    for i in range(0, len(deliveries_batch), 500):
        sb.table('deliveries').insert(deliveries_batch[i:i + 500]).execute()

    return True


# ── Main ────────────────────────────────────────────────────────────────────────

def run_competition(key: str):
    config = COMPETITION_CONFIG[key]
    print(f'\n▶ {key} — {config["label"]}')

    tmp = tempfile.mkdtemp(prefix=f'cricsheet_{key}_')
    try:
        download_and_extract(config['url'], tmp)
        ingested_ids = get_ingested_ids()

        files = sorted([f for f in os.listdir(tmp) if f.endswith('.yaml') or f.endswith('.yml')])
        new_files = [f for f in files if f not in ingested_ids]

        print(f'  {len(files)} total | {len(ingested_ids)} already ingested | {len(new_files)} new')

        ok = skip = err = 0
        for fname in new_files:
            try:
                ingest_file(
                    path=os.path.join(tmp, fname),
                    match_file_id=fname,
                    competition=key,
                    weight_as=config['weight_as'],
                    db_value=config['db_value'],
                )
                ok += 1
                if ok % 50 == 0:
                    print(f'  ... {ok}/{len(new_files)} ingested')
            except Exception as e:
                err += 1
                print(f'  ERROR {fname}: {e}')

        print(f'  ✓ Done — {ok} ingested, {err} errors')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description='Cricsheet auto-ingestion')
    parser.add_argument('--competition', choices=list(COMPETITION_CONFIG.keys()), help='Single competition to ingest')
    parser.add_argument('--list', action='store_true', help='List available competitions')
    args = parser.parse_args()

    if args.list:
        print('Available competitions:')
        for k, v in COMPETITION_CONFIG.items():
            print(f'  {k:10} {v["label"]}')
        return

    targets = [args.competition] if args.competition else list(COMPETITION_CONFIG.keys())

    # Default: only IPL + SMAT until scope is expanded
    if not args.competition:
        targets = ['IPL', 'SMAT']
        print('Running default scope: IPL + SMAT (pass --competition to override)')

    for key in targets:
        run_competition(key)

    print('\nRefreshing materialized view...')
    sb.rpc('refresh_venue_phase_stats', {}).execute()
    print('All done.')


if __name__ == '__main__':
    main()
