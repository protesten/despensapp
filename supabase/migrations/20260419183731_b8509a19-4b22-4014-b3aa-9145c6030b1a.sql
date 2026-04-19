-- Drop obsolete exchange_foods table
DROP TABLE IF EXISTS public.exchange_foods;

-- Add new columns to meal_plan_entries
ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS grams numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- Make food_name nullable (kept as display cache)
ALTER TABLE public.meal_plan_entries
  ALTER COLUMN food_name DROP NOT NULL;

-- Index for joining with products
CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_product_id
  ON public.meal_plan_entries(product_id);

CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_user_date
  ON public.meal_plan_entries(user_id, plan_date);