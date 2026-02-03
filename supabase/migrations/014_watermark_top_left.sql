-- Put handle (watermark) at top left, counter stays top right
UPDATE templates
SET config = jsonb_set(config, '{chrome,watermark,position}', '"top_left"')
WHERE config->'chrome'->'watermark'->>'position' IN ('top_right', 'bottom_left');
