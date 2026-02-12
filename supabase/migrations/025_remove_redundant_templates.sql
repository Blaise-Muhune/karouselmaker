-- Remove system templates that are very similar to others; keep one per style.
-- Clear slide references first so they fall back to default template.

-- Similar to Story block (solid bar bottom): Emotional hook, Retention block
-- Similar to CTA bold / Impact (big single headline): Punch fact, Viral tease
-- Similar to Minimal dark (no image, minimal): Cool minimal
-- Similar to Generic minimal (headline bottom + gradient): Centered punch, Swipe bait

update public.slides
set template_id = null
where template_id in (
  select id from public.templates
  where user_id is null
    and name in (
      'Emotional hook',
      'Retention block',
      'Punch fact',
      'Viral tease',
      'Cool minimal',
      'Centered punch',
      'Swipe bait'
    )
);

delete from public.templates
where user_id is null
  and name in (
    'Emotional hook',
    'Retention block',
    'Punch fact',
    'Viral tease',
    'Cool minimal',
    'Centered punch',
    'Swipe bait'
  );
