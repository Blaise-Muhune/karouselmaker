-- User-controlled preferences for optional, non-transactional product email.
create table if not exists public.email_subscriptions (
  email text primary key,
  weekly_creator_note boolean not null default false,
  last_weekly_creator_note_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_subscriptions_weekly_creator_note_idx
  on public.email_subscriptions (weekly_creator_note, last_weekly_creator_note_at);
