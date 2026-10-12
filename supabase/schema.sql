-- ZEEP coin registry. RLS is on; no public policies, so only the service key (server
-- functions) can read or write. Run once in the Supabase SQL editor.

create table if not exists zeep_coins (
  token text primary key,
  curve text not null,
  deployer text not null,
  tx_hash text not null,
  block_number bigint not null,
  launched_at timestamptz not null,
  name text not null,
  symbol text not null,
  logo text,
  description text,
  collection_name text not null,
  collection_slug text not null,
  chain text not null default 'ethereum',
  category text not null default 'pfp',
  policy text not null check (policy in ('raffle', 'hold', 'burn')),
  vault_eth numeric not null default 0,
  protocol_eth numeric not null default 0,
  nfts_held integer not null default 0,
  fees_awaiting numeric not null default 0,
  last_harvested_escrow numeric not null default 0
);

alter table zeep_coins enable row level security;

create index if not exists zeep_coins_launched_at_idx on zeep_coins (launched_at desc);
create index if not exists zeep_coins_category_idx on zeep_coins (category);

-- Vault event log (harvest / purchase / draw). Everything here is simulated
-- bookkeeping until the real keeper/vault contract ships (see CLAUDE.md "Vault
-- execution") — the `simulated` flag is never false yet.
create table if not exists zeep_vault_events (
  id bigserial primary key,
  token text not null references zeep_coins (token) on delete cascade,
  type text not null check (type in ('harvest', 'purchase', 'draw')),
  amount_eth numeric,
  nft_label text,
  winner text,
  block_hash text,
  simulated boolean not null default true,
  created_at timestamptz not null default now()
);

alter table zeep_vault_events enable row level security;

create index if not exists zeep_vault_events_token_idx on zeep_vault_events (token, created_at desc);
