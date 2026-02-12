-- Remove system templates that do not center content (left-aligned text zones).
-- Keeps only centered templates for a consistent look.
-- Clear slide references first so export keeps working (slides fall back to default template).
update public.slides
set template_id = null
where template_id in (
  select id from public.templates
  where user_id is null
    and name in (
      'Science fact',
      'Did you know',
      'Fact blur',
      'List cover',
      'Quote overlay',
      'That''s interesting',
      'Banner top',
      'Headline top (hook)',
      'Point left',
      'Split compact',
      'Headline bottom (hook)',
      'Context block'
    )
);

delete from public.templates
where user_id is null
  and name in (
    'Science fact',
    'Did you know',
    'Fact blur',
    'List cover',
    'Quote overlay',
    'That''s interesting',
    'Banner top',
    'Headline top (hook)',
    'Point left',
    'Split compact',
    'Headline bottom (hook)',
    'Context block'
  );
