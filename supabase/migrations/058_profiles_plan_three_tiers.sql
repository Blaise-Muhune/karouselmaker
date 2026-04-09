-- Allow Starter / Pro / Studio paid plans (no teams tier in product).
alter table public.profiles drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (
    plan in ('free', 'starter', 'pro', 'studio')
  );

comment on column public.profiles.plan is 'free | starter ($25) | pro ($39) | studio ($59)';
