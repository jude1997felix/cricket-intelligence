-- Store Cricsheet identifier hash (e.g. "db584dad") for cross-referencing with register
alter table players add column if not exists cricsheet_identifier text unique;

-- Store external IDs for fetching enrichment data
alter table players add column if not exists cricbuzz_id text;
alter table players add column if not exists cricinfo_id text;

-- Index for fast lookups during enrichment
create index if not exists idx_players_cricsheet_identifier on players(cricsheet_identifier);
create index if not exists idx_players_unenriched on players(batting_style) where batting_style is null;
