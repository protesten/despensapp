-- exchange_foods
CREATE TABLE public.exchange_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  serving_g NUMERIC NOT NULL DEFAULT 0,
  hc NUMERIC NOT NULL DEFAULT 0,
  prot NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exchange_foods"
ON public.exchange_foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exchange_foods"
ON public.exchange_foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exchange_foods"
ON public.exchange_foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exchange_foods"
ON public.exchange_foods FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_exchange_foods_user ON public.exchange_foods(user_id);

-- meal_targets
CREATE TABLE public.meal_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_name TEXT NOT NULL,
  meal_order INTEGER NOT NULL DEFAULT 0,
  target_hc NUMERIC NOT NULL DEFAULT 0,
  target_prot NUMERIC NOT NULL DEFAULT 0,
  target_fat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, meal_name)
);

ALTER TABLE public.meal_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal_targets"
ON public.meal_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal_targets"
ON public.meal_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal_targets"
ON public.meal_targets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal_targets"
ON public.meal_targets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_meal_targets_updated_at
BEFORE UPDATE ON public.meal_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meal_targets_user ON public.meal_targets(user_id);

-- meal_plan_entries
CREATE TABLE public.meal_plan_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  meal_name TEXT NOT NULL,
  food_name TEXT NOT NULL,
  servings NUMERIC NOT NULL DEFAULT 1,
  hc_total NUMERIC NOT NULL DEFAULT 0,
  prot_total NUMERIC NOT NULL DEFAULT 0,
  fat_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal_plan_entries"
ON public.meal_plan_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal_plan_entries"
ON public.meal_plan_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal_plan_entries"
ON public.meal_plan_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal_plan_entries"
ON public.meal_plan_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_meal_plan_entries_user_date ON public.meal_plan_entries(user_id, plan_date);