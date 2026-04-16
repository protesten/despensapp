
-- Enums
CREATE TYPE public.unit_type AS ENUM ('g','ml','unit','kg','l');
CREATE TYPE public.location_type AS ENUM ('pantry','fridge','freezer','other');
CREATE TYPE public.stock_status AS ENUM ('available','low','expired','consumed');
CREATE TYPE public.movement_type AS ENUM ('purchase','consumption','adjustment','waste','expiry');
CREATE TYPE public.open_status_type AS ENUM ('sealed','opened');
CREATE TYPE public.nutrition_source_type AS ENUM ('label','openfoodfacts','food_database','manual','ai_estimate');
CREATE TYPE public.import_status AS ENUM ('pending','previewed','applied','rejected');

-- Function for updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_units TEXT DEFAULT 'metric',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT,
  default_unit public.unit_type DEFAULT 'g',
  serving_size_value NUMERIC,
  serving_size_unit public.unit_type,
  package_size_value NUMERIC,
  package_size_unit public.unit_type,
  servings_per_package NUMERIC,
  category TEXT,
  subcategory TEXT,
  suitability_tags TEXT[],
  ingredients_text TEXT,
  allergens TEXT[],
  source public.nutrition_source_type DEFAULT 'manual',
  nutrition_source_type public.nutrition_source_type DEFAULT 'manual',
  nutrition_source_name TEXT,
  nutrition_source_reference_id TEXT,
  nutrition_confidence NUMERIC(3,2),
  image_url TEXT,
  image_storage_provider TEXT,
  image_drive_file_id TEXT,
  image_drive_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name, brand)
);

CREATE UNIQUE INDEX idx_products_barcode ON public.products (user_id, barcode) WHERE barcode IS NOT NULL;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- product_nutrition
CREATE TABLE public.product_nutrition (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  kcal_per_100g NUMERIC,
  kcal_per_100ml NUMERIC,
  protein_per_100g NUMERIC,
  protein_per_100ml NUMERIC,
  carbs_per_100g NUMERIC,
  carbs_per_100ml NUMERIC,
  fat_per_100g NUMERIC,
  fat_per_100ml NUMERIC,
  fiber_per_100g NUMERIC,
  fiber_per_100ml NUMERIC,
  sugars_per_100g NUMERIC,
  sugars_per_100ml NUMERIC,
  saturated_fat_per_100g NUMERIC,
  saturated_fat_per_100ml NUMERIC,
  salt_per_100g NUMERIC,
  salt_per_100ml NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_nutrition ENABLE ROW LEVEL SECURITY;

-- RLS via join to products.user_id
CREATE POLICY "Users can view own product nutrition" ON public.product_nutrition FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_nutrition.product_id AND products.user_id = auth.uid())
);
CREATE POLICY "Users can insert own product nutrition" ON public.product_nutrition FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_nutrition.product_id AND products.user_id = auth.uid())
);
CREATE POLICY "Users can update own product nutrition" ON public.product_nutrition FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_nutrition.product_id AND products.user_id = auth.uid())
);
CREATE POLICY "Users can delete own product nutrition" ON public.product_nutrition FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = product_nutrition.product_id AND products.user_id = auth.uid())
);

CREATE TRIGGER update_product_nutrition_updated_at BEFORE UPDATE ON public.product_nutrition FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- stock_items
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit public.unit_type NOT NULL DEFAULT 'g',
  purchase_date DATE,
  expiration_date DATE,
  unit_cost NUMERIC,
  open_status public.open_status_type DEFAULT 'sealed',
  opened_at TIMESTAMPTZ,
  location public.location_type DEFAULT 'pantry',
  status public.stock_status DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stock" ON public.stock_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock" ON public.stock_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock" ON public.stock_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock" ON public.stock_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- inventory_movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  quantity_delta NUMERIC NOT NULL,
  unit public.unit_type NOT NULL,
  notes TEXT,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own movements" ON public.inventory_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movements" ON public.inventory_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movements" ON public.inventory_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own movements" ON public.inventory_movements FOR DELETE USING (auth.uid() = user_id);

-- import_logs
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT,
  raw_payload JSONB,
  validated_payload JSONB,
  validation_errors JSONB,
  status public.import_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imports" ON public.import_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imports" ON public.import_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imports" ON public.import_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own imports" ON public.import_logs FOR DELETE USING (auth.uid() = user_id);
