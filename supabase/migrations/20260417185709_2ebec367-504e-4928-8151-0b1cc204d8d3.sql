CREATE TYPE nutrition_relevance_type AS ENUM ('required','optional','ignore');
ALTER TABLE public.products ADD COLUMN nutrition_relevance nutrition_relevance_type;