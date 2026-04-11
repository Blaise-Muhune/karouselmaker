-- Remove user sound effects (feature retired; video no longer mixes SFX).
drop policy if exists "user_sound_effects_delete_own" on public.user_sound_effects;
drop policy if exists "user_sound_effects_update_own" on public.user_sound_effects;
drop policy if exists "user_sound_effects_insert_own" on public.user_sound_effects;
drop policy if exists "user_sound_effects_select_own" on public.user_sound_effects;
drop table if exists public.user_sound_effects;
