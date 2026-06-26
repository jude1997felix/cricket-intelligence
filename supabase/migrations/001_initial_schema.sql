-- Enums
create type competition_type as enum ('IPL', 'T20I', 'OTHER');
create type phase_type as enum ('POWERPLAY', 'MIDDLE', 'DEATH');
create type pitch_type as enum ('FLAT', 'SPORTING', 'SPIN_FRIENDLY', 'SEAM_FRIENDLY', 'SLOW_LOW');
create type batting_style as enum ('RIGHT_HAND', 'LEFT_HAND');
create type bowling_style as enum ('RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'LEFT_ARM_FAST', 'LEFT_ARM_MEDIUM', 'RIGHT_ARM_OFFSPIN', 'RIGHT_ARM_LEGSPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN');
create type player_role as enum ('BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER');
create type toss_decision as enum ('BAT', 'FIELD');

-- Venues
create table venues (
  venue_id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text,
  cricsheet_name text unique not null,  -- exact name as in Cricsheet YAML
  ipl_game_count int not null default 0,
  domestic_game_count int not null default 0,
  ipl_weight decimal generated always as (
    least(1.0, ipl_game_count::decimal / 30.0)
  ) stored,
  pitch_type pitch_type,
  avg_1st_innings_ipl decimal,
  avg_1st_innings_domestic decimal,
  dew_factor boolean default false,
  created_at timestamptz default now()
);

-- Players
create table players (
  player_id uuid primary key default gen_random_uuid(),
  name text not null,
  cricsheet_key text unique not null,
  batting_style batting_style,
  bowling_style bowling_style,
  role player_role,
  created_at timestamptz default now()
);

-- Matches
create table matches (
  match_id uuid primary key default gen_random_uuid(),
  cricsheet_match_id text unique not null,
  venue_id uuid not null references venues(venue_id),
  competition competition_type not null,
  season int not null,
  match_date date not null,
  team1 text not null,
  team2 text not null,
  toss_winner text,
  toss_decision toss_decision,
  winner text,
  win_by_runs int,
  win_by_wickets int,
  team1_score int,
  team1_wickets int,
  team2_score int,
  team2_wickets int,
  day_night boolean default false,
  created_at timestamptz default now()
);

-- Ball-by-ball deliveries
create table deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(match_id),
  innings int not null check (innings in (1, 2)),
  over_num int not null,
  ball_num int not null,
  batter_id uuid not null references players(player_id),
  non_striker_id uuid references players(player_id),
  bowler_id uuid not null references players(player_id),
  runs_batter int not null default 0,
  runs_extras int not null default 0,
  runs_total int not null default 0,
  is_wicket boolean default false,
  wicket_type text,
  dismissed_player_id uuid references players(player_id),
  phase phase_type not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_deliveries_match on deliveries(match_id);
create index idx_deliveries_batter on deliveries(batter_id);
create index idx_deliveries_bowler on deliveries(bowler_id);
create index idx_deliveries_phase on deliveries(phase);
create index idx_matches_venue on matches(venue_id);
create index idx_matches_competition on matches(competition);
create index idx_matches_season on matches(season);

-- Computed: venue phase stats (materialized view refreshed after each ingest)
create materialized view venue_phase_stats as
select
  m.venue_id,
  m.competition,
  d.innings,
  d.phase,
  count(distinct m.match_id) as match_count,
  round(avg(d.runs_total), 2) as avg_runs_per_ball,
  round(sum(d.runs_total)::decimal / nullif(count(*), 0) * 6, 2) as avg_rpo,
  round(sum(case when d.is_wicket then 1 else 0 end)::decimal / nullif(count(distinct m.match_id), 0), 2) as avg_wickets
from deliveries d
join matches m on d.match_id = m.match_id
group by m.venue_id, m.competition, d.innings, d.phase;

create index idx_vpc_venue on venue_phase_stats(venue_id);
