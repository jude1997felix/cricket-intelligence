"""
Cricsheet ingestion script.

Usage:
  python ingest.py --dir /path/to/cricsheet/ipl     --competition IPL
  python ingest.py --dir /path/to/cricsheet/smat    --competition SMAT

Cricsheet YAML structure: https://cricsheet.org/format/yaml/
Download: https://cricsheet.org/downloads/
"""

import os
import sys
import argparse
import yaml
from datetime import date
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env.local'))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Normalise Cricsheet venue name variations to a canonical key
VENUE_ALIASES: dict[str, str] = {
    'Wankhede Stadium, Mumbai': 'Wankhede Stadium',
    'M Chinnaswamy Stadium, Bengaluru': 'M Chinnaswamy Stadium',
    'M.A. Chidambaram Stadium, Chepauk, Chennai': 'MA Chidambaram Stadium',
    'Eden Gardens, Kolkata': 'Eden Gardens',
    'Arun Jaitley Stadium, Delhi': 'Arun Jaitley Stadium',
    'Rajiv Gandhi International Stadium, Uppal, Hyderabad': 'Rajiv Gandhi International Stadium',
    'Sawai Mansingh Stadium, Jaipur': 'Sawai Mansingh Stadium',
    'Punjab Cricket Association IS Bindra Stadium, Mohali, Chandigarh': 'PCA Stadium Mohali',
    'Narendra Modi Stadium, Ahmedabad': 'Narendra Modi Stadium',
    'BRSABV Ekana Cricket Stadium, Lucknow': 'Ekana Cricket Stadium',
    'Holkar Cricket Stadium, Indore': 'Holkar Stadium',
    'MCA International Stadium, Pune': 'MCA Stadium Pune',
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


def upsert_venue(raw_name: str, competition: str) -> str:
    canonical = normalise_venue(raw_name)
    existing = sb.table('venues').select('venue_id, ipl_game_count, domestic_game_count') \
        .eq('cricsheet_name', canonical).execute()

    if existing.data:
        return existing.data[0]['venue_id']

    city = raw_name.split(',')[-1].strip() if ',' in raw_name else ''
    result = sb.table('venues').insert({
        'name': canonical,
        'city': city,
        'cricsheet_name': canonical,
    }).execute()
    return result.data[0]['venue_id']


def bump_venue_count(venue_id: str, competition: str):
    col = 'ipl_game_count' if competition == 'IPL' else 'domestic_game_count'
    sb.rpc('increment_venue_count', {'v_id': venue_id, 'col_name': col}).execute()


def upsert_player(key: str, name: str) -> str:
    existing = sb.table('players').select('player_id').eq('cricsheet_key', key).execute()
    if existing.data:
        return existing.data[0]['player_id']
    result = sb.table('players').insert({'name': name, 'cricsheet_key': key}).execute()
    return result.data[0]['player_id']


def get_player_registry(info: dict) -> dict[str, str]:
    """Build cricsheet_key -> player_id map for all players in a match."""
    registry: dict[str, str] = {}
    for team_players in info.get('players', {}).values():
        for name in team_players:
            key = name.lower().replace(' ', '_')
            registry[name] = upsert_player(key, name)
    return registry


def ingest_file(path: str, competition: str):
    with open(path, 'r') as f:
        data = yaml.safe_load(f)

    info = data.get('info', {})
    innings_list = data.get('innings', [])

    raw_venue = info.get('venue', 'Unknown')
    venue_id = upsert_venue(raw_venue, competition)

    match_date_raw = info.get('dates', [None])[0]
    match_date = str(match_date_raw) if match_date_raw else str(date.today())

    toss = info.get('toss', {})
    outcome = info.get('outcome', {})
    teams = info.get('teams', ['', ''])

    # Scores
    scores: dict[int, dict] = {}
    player_registry = get_player_registry(info)

    existing_match = sb.table('matches').select('match_id') \
        .eq('cricsheet_match_id', path).execute()
    if existing_match.data:
        print(f'  skip (already ingested): {os.path.basename(path)}')
        return

    match_row = {
        'cricsheet_match_id': path,
        'venue_id': venue_id,
        'competition': competition,
        'season': int(str(match_date)[:4]),
        'match_date': match_date,
        'team1': teams[0] if len(teams) > 0 else '',
        'team2': teams[1] if len(teams) > 1 else '',
        'toss_winner': toss.get('winner'),
        'toss_decision': toss.get('decision', '').upper() or None,
        'winner': outcome.get('winner'),
        'win_by_runs': outcome.get('by', {}).get('runs'),
        'win_by_wickets': outcome.get('by', {}).get('wickets'),
        'day_night': info.get('match_type_number') is not None,
    }

    match_result = sb.table('matches').insert(match_row).execute()
    match_id = match_result.data[0]['match_id']
    bump_venue_count(venue_id, competition)

    deliveries_batch = []
    for innings_idx, innings_data in enumerate(innings_list):
        innings_num = innings_idx + 1
        team_data = innings_data.get(list(innings_data.keys())[0], {}) if innings_data else {}
        overs = team_data.get('overs', [])

        total_runs = 0
        total_wickets = 0

        for over_data in overs:
            over_num = over_data.get('over', 0)
            deliveries = over_data.get('deliveries', [])
            for ball_idx, delivery in enumerate(deliveries):
                batter_name = delivery.get('batter', '')
                bowler_name = delivery.get('bowler', '')
                non_striker = delivery.get('non_striker', '')

                batter_id = player_registry.get(batter_name)
                bowler_id = player_registry.get(bowler_name)
                non_striker_id = player_registry.get(non_striker)

                if not batter_id or not bowler_id:
                    continue

                runs = delivery.get('runs', {})
                runs_batter = runs.get('batter', 0)
                runs_extras = runs.get('extras', 0)
                runs_total = runs.get('total', 0)

                wicket_info = delivery.get('wickets', [])
                is_wicket = len(wicket_info) > 0
                wicket_type = wicket_info[0].get('kind') if is_wicket else None
                dismissed = wicket_info[0].get('player_out') if is_wicket else None
                dismissed_id = player_registry.get(dismissed) if dismissed else None

                total_runs += runs_total
                if is_wicket:
                    total_wickets += 1

                deliveries_batch.append({
                    'match_id': match_id,
                    'innings': innings_num,
                    'over_num': over_num,
                    'ball_num': ball_idx + 1,
                    'batter_id': batter_id,
                    'non_striker_id': non_striker_id,
                    'bowler_id': bowler_id,
                    'runs_batter': runs_batter,
                    'runs_extras': runs_extras,
                    'runs_total': runs_total,
                    'is_wicket': is_wicket,
                    'wicket_type': wicket_type,
                    'dismissed_player_id': dismissed_id,
                    'phase': phase_for_over(over_num),
                })

        score_col = 'team1_score' if innings_num == 1 else 'team2_score'
        wkt_col = 'team1_wickets' if innings_num == 1 else 'team2_wickets'
        sb.table('matches').update({score_col: total_runs, wkt_col: total_wickets}) \
            .eq('match_id', match_id).execute()

    # Batch insert deliveries in chunks of 500
    chunk_size = 500
    for i in range(0, len(deliveries_batch), chunk_size):
        sb.table('deliveries').insert(deliveries_batch[i:i + chunk_size]).execute()

    print(f'  ✓ {os.path.basename(path)} — {len(deliveries_batch)} deliveries')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', required=True, help='Directory of Cricsheet YAML files')
    parser.add_argument('--competition', required=True, choices=['IPL', 'SMAT', 'OTHER'])
    args = parser.parse_args()

    files = [f for f in os.listdir(args.dir) if f.endswith('.yaml') or f.endswith('.yml')]
    print(f'Ingesting {len(files)} files from {args.dir} as {args.competition}')

    for i, fname in enumerate(sorted(files)):
        print(f'[{i+1}/{len(files)}] {fname}')
        try:
            ingest_file(os.path.join(args.dir, fname), args.competition)
        except Exception as e:
            print(f'  ERROR: {e}')

    # Refresh materialized view
    sb.rpc('refresh_venue_phase_stats', {}).execute()
    print('Done. Materialized view refreshed.')


if __name__ == '__main__':
    main()
