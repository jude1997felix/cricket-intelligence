-- ── 1. First innings phase benchmarks ─────────────────────────────────────────
-- Per venue: what winning vs losing teams score in each phase (1st innings only)
create materialized view first_innings_phase_benchmarks as
select
  m.venue_id,
  v.name as venue_name,
  d.phase,
  -- win/loss split
  case when m.winner = m.team1 then 'won' else 'lost' end as result,
  count(distinct m.match_id) as match_count,
  round(sum(d.runs_total)::decimal / nullif(count(distinct m.match_id), 0), 1) as avg_phase_runs,
  round(sum(d.runs_total)::decimal / nullif(count(*), 0) * 6, 2) as avg_rpo,
  round(sum(case when d.is_wicket then 1 else 0 end)::decimal / nullif(count(distinct m.match_id), 0), 2) as avg_wickets_lost,
  round(sum(case when d.runs_batter = 0 and not d.is_wicket then 1 else 0 end)::decimal / nullif(count(*), 0) * 100, 1) as dot_pct
from deliveries d
join matches m on d.match_id = m.match_id
join venues v on m.venue_id = v.venue_id
where
  d.innings = 1
  and m.winner is not null          -- completed matches only
  and m.win_by_runs is not null     -- batting first team result is clear
group by m.venue_id, v.name, d.phase,
  case when m.winner = m.team1 then 'won' else 'lost' end;

create index idx_fipb_venue on first_innings_phase_benchmarks(venue_id);
create index idx_fipb_phase on first_innings_phase_benchmarks(phase);


-- ── 2. Chase phase benchmarks ──────────────────────────────────────────────────
-- Per venue + target bracket: what successful vs failed chases look like phase-wise
create materialized view chase_phase_benchmarks as
select
  m.venue_id,
  v.name as venue_name,
  d.phase,
  -- bucket the target into 10-run bands
  (floor(m.team1_score::decimal / 10) * 10)::int as target_bracket_low,
  (floor(m.team1_score::decimal / 10) * 10 + 9)::int as target_bracket_high,
  case when m.winner = m.team2 then 'won' else 'lost' end as result,
  count(distinct m.match_id) as match_count,
  round(sum(d.runs_total)::decimal / nullif(count(distinct m.match_id), 0), 1) as avg_phase_runs,
  round(sum(d.runs_total)::decimal / nullif(count(*), 0) * 6, 2) as avg_rpo,
  round(sum(case when d.is_wicket then 1 else 0 end)::decimal / nullif(count(distinct m.match_id), 0), 2) as avg_wickets_lost,
  round(sum(case when d.runs_batter = 0 and not d.is_wicket then 1 else 0 end)::decimal / nullif(count(*), 0) * 100, 1) as dot_pct
from deliveries d
join matches m on d.match_id = m.match_id
join venues v on m.venue_id = v.venue_id
where
  d.innings = 2
  and m.winner is not null
  and m.team1_score is not null
  and m.win_by_wickets is not null   -- chasing team result is clear
  and d.innings != 3                 -- exclude super overs
group by
  m.venue_id, v.name, d.phase,
  floor(m.team1_score::decimal / 10),
  case when m.winner = m.team2 then 'won' else 'lost' end;

create index idx_cpb_venue on chase_phase_benchmarks(venue_id);
create index idx_cpb_target on chase_phase_benchmarks(target_bracket_low);


-- ── 3. Bowler phase effectiveness ─────────────────────────────────────────────
-- Per bowler + innings + phase: economy, wickets, dot %, strike rate
-- Minimum 30 balls bowled to qualify
create materialized view bowler_phase_stats as
select
  d.bowler_id,
  p.name as bowler_name,
  p.bowling_style,
  m.venue_id,
  v.name as venue_name,
  d.innings,
  d.phase,
  count(distinct m.match_id) as matches,
  count(*) as balls,
  sum(d.runs_total) as runs_conceded,
  sum(case when d.is_wicket and d.wicket_type not in ('run out', 'retired hurt', 'obstructing the field') then 1 else 0 end) as wickets,
  round(sum(d.runs_total)::decimal / nullif(count(*), 0) * 6, 2) as economy,
  round(count(*)::decimal / nullif(sum(case when d.is_wicket and d.wicket_type not in ('run out', 'retired hurt', 'obstructing the field') then 1 else 0 end), 0), 1) as bowling_sr,
  round(sum(case when d.runs_total = 0 then 1 else 0 end)::decimal / nullif(count(*), 0) * 100, 1) as dot_pct
from deliveries d
join matches m on d.match_id = m.match_id
join players p on d.bowler_id = p.player_id
join venues v on m.venue_id = v.venue_id
where d.innings in (1, 2)
group by d.bowler_id, p.name, p.bowling_style, m.venue_id, v.name, d.innings, d.phase
having count(*) >= 30;

create index idx_bps_bowler on bowler_phase_stats(bowler_id);
create index idx_bps_venue on bowler_phase_stats(venue_id);
create index idx_bps_phase on bowler_phase_stats(phase);
create index idx_bps_innings on bowler_phase_stats(innings);


-- ── RPC to refresh all three views ────────────────────────────────────────────
create or replace function refresh_strategy_views()
returns void language plpgsql security definer as $$
begin
  refresh materialized view concurrently venue_phase_stats;
  refresh materialized view first_innings_phase_benchmarks;
  refresh materialized view chase_phase_benchmarks;
  refresh materialized view bowler_phase_stats;
end;
$$;
