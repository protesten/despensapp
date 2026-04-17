CREATE TYPE public.tracking_mode_type AS ENUM ('bulk', 'package', 'serving');

ALTER TABLE public.stock_items
  ADD COLUMN tracking_mode public.tracking_mode_type NOT NULL DEFAULT 'bulk',
  ADD COLUMN package_count numeric NULL,
  ADD COLUMN serving_count numeric NULL;