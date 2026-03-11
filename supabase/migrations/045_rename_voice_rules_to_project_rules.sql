-- Rename voice_rules to project_rules (no voice feature)
alter table public.projects rename column voice_rules to project_rules;
