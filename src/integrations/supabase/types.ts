export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      import_logs: {
        Row: {
          applied_at: string | null
          created_at: string
          id: string
          raw_payload: Json | null
          source: string | null
          status: Database["public"]["Enums"]["import_status"] | null
          user_id: string
          validated_payload: Json | null
          validation_errors: Json | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          id?: string
          raw_payload?: Json | null
          source?: string | null
          status?: Database["public"]["Enums"]["import_status"] | null
          user_id: string
          validated_payload?: Json | null
          validation_errors?: Json | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          id?: string
          raw_payload?: Json | null
          source?: string | null
          status?: Database["public"]["Enums"]["import_status"] | null
          user_id?: string
          validated_payload?: Json | null
          validation_errors?: Json | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          moved_at: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          product_id: string
          quantity_delta: number
          stock_item_id: string | null
          unit: Database["public"]["Enums"]["unit_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moved_at?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id: string
          quantity_delta: number
          stock_item_id?: string | null
          unit: Database["public"]["Enums"]["unit_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moved_at?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          product_id?: string
          quantity_delta?: number
          stock_item_id?: string | null
          unit?: Database["public"]["Enums"]["unit_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          consumed: boolean
          consumed_at: string | null
          created_at: string
          fat_total: number
          food_name: string | null
          grams: number
          hc_total: number
          id: string
          meal_name: string
          plan_date: string
          product_id: string | null
          prot_total: number
          servings: number
          user_id: string
        }
        Insert: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          fat_total?: number
          food_name?: string | null
          grams?: number
          hc_total?: number
          id?: string
          meal_name: string
          plan_date: string
          product_id?: string | null
          prot_total?: number
          servings?: number
          user_id: string
        }
        Update: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          fat_total?: number
          food_name?: string | null
          grams?: number
          hc_total?: number
          id?: string
          meal_name?: string
          plan_date?: string
          product_id?: string | null
          prot_total?: number
          servings?: number
          user_id?: string
        }
        Relationships: []
      }
      meal_targets: {
        Row: {
          created_at: string
          id: string
          meal_name: string
          meal_order: number
          target_fat: number
          target_hc: number
          target_prot: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_name: string
          meal_order?: number
          target_fat?: number
          target_hc?: number
          target_prot?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_name?: string
          meal_order?: number
          target_fat?: number
          target_hc?: number
          target_prot?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_nutrition: {
        Row: {
          carbs_per_100g: number | null
          carbs_per_100ml: number | null
          fat_per_100g: number | null
          fat_per_100ml: number | null
          fiber_per_100g: number | null
          fiber_per_100ml: number | null
          kcal_per_100g: number | null
          kcal_per_100ml: number | null
          product_id: string
          protein_per_100g: number | null
          protein_per_100ml: number | null
          salt_per_100g: number | null
          salt_per_100ml: number | null
          saturated_fat_per_100g: number | null
          saturated_fat_per_100ml: number | null
          sugars_per_100g: number | null
          sugars_per_100ml: number | null
          updated_at: string
        }
        Insert: {
          carbs_per_100g?: number | null
          carbs_per_100ml?: number | null
          fat_per_100g?: number | null
          fat_per_100ml?: number | null
          fiber_per_100g?: number | null
          fiber_per_100ml?: number | null
          kcal_per_100g?: number | null
          kcal_per_100ml?: number | null
          product_id: string
          protein_per_100g?: number | null
          protein_per_100ml?: number | null
          salt_per_100g?: number | null
          salt_per_100ml?: number | null
          saturated_fat_per_100g?: number | null
          saturated_fat_per_100ml?: number | null
          sugars_per_100g?: number | null
          sugars_per_100ml?: number | null
          updated_at?: string
        }
        Update: {
          carbs_per_100g?: number | null
          carbs_per_100ml?: number | null
          fat_per_100g?: number | null
          fat_per_100ml?: number | null
          fiber_per_100g?: number | null
          fiber_per_100ml?: number | null
          kcal_per_100g?: number | null
          kcal_per_100ml?: number | null
          product_id?: string
          protein_per_100g?: number | null
          protein_per_100ml?: number | null
          salt_per_100g?: number | null
          salt_per_100ml?: number | null
          saturated_fat_per_100g?: number | null
          saturated_fat_per_100ml?: number | null
          sugars_per_100g?: number | null
          sugars_per_100ml?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_nutrition_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[] | null
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          default_unit: Database["public"]["Enums"]["unit_type"] | null
          id: string
          image_drive_file_id: string | null
          image_drive_folder_id: string | null
          image_storage_provider: string | null
          image_url: string | null
          ingredients_text: string | null
          name: string
          nutrition_confidence: number | null
          nutrition_relevance:
            | Database["public"]["Enums"]["nutrition_relevance_type"]
            | null
          nutrition_source_name: string | null
          nutrition_source_reference_id: string | null
          nutrition_source_type:
            | Database["public"]["Enums"]["nutrition_source_type"]
            | null
          package_size_unit: Database["public"]["Enums"]["unit_type"] | null
          package_size_value: number | null
          serving_size_unit: Database["public"]["Enums"]["unit_type"] | null
          serving_size_value: number | null
          servings_per_package: number | null
          source: Database["public"]["Enums"]["nutrition_source_type"] | null
          subcategory: string | null
          suitability_tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergens?: string[] | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          default_unit?: Database["public"]["Enums"]["unit_type"] | null
          id?: string
          image_drive_file_id?: string | null
          image_drive_folder_id?: string | null
          image_storage_provider?: string | null
          image_url?: string | null
          ingredients_text?: string | null
          name: string
          nutrition_confidence?: number | null
          nutrition_relevance?:
            | Database["public"]["Enums"]["nutrition_relevance_type"]
            | null
          nutrition_source_name?: string | null
          nutrition_source_reference_id?: string | null
          nutrition_source_type?:
            | Database["public"]["Enums"]["nutrition_source_type"]
            | null
          package_size_unit?: Database["public"]["Enums"]["unit_type"] | null
          package_size_value?: number | null
          serving_size_unit?: Database["public"]["Enums"]["unit_type"] | null
          serving_size_value?: number | null
          servings_per_package?: number | null
          source?: Database["public"]["Enums"]["nutrition_source_type"] | null
          subcategory?: string | null
          suitability_tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergens?: string[] | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          default_unit?: Database["public"]["Enums"]["unit_type"] | null
          id?: string
          image_drive_file_id?: string | null
          image_drive_folder_id?: string | null
          image_storage_provider?: string | null
          image_url?: string | null
          ingredients_text?: string | null
          name?: string
          nutrition_confidence?: number | null
          nutrition_relevance?:
            | Database["public"]["Enums"]["nutrition_relevance_type"]
            | null
          nutrition_source_name?: string | null
          nutrition_source_reference_id?: string | null
          nutrition_source_type?:
            | Database["public"]["Enums"]["nutrition_source_type"]
            | null
          package_size_unit?: Database["public"]["Enums"]["unit_type"] | null
          package_size_value?: number | null
          serving_size_unit?: Database["public"]["Enums"]["unit_type"] | null
          serving_size_value?: number | null
          servings_per_package?: number | null
          source?: Database["public"]["Enums"]["nutrition_source_type"] | null
          subcategory?: string | null
          suitability_tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_units: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_units?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_units?: string | null
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          created_at: string
          expiration_date: string | null
          id: string
          location: Database["public"]["Enums"]["location_type"] | null
          open_status: Database["public"]["Enums"]["open_status_type"] | null
          opened_at: string | null
          package_count: number | null
          product_id: string
          purchase_date: string | null
          quantity: number
          serving_count: number | null
          status: Database["public"]["Enums"]["stock_status"] | null
          tracking_mode: Database["public"]["Enums"]["tracking_mode_type"]
          unit: Database["public"]["Enums"]["unit_type"]
          unit_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          location?: Database["public"]["Enums"]["location_type"] | null
          open_status?: Database["public"]["Enums"]["open_status_type"] | null
          opened_at?: string | null
          package_count?: number | null
          product_id: string
          purchase_date?: string | null
          quantity: number
          serving_count?: number | null
          status?: Database["public"]["Enums"]["stock_status"] | null
          tracking_mode?: Database["public"]["Enums"]["tracking_mode_type"]
          unit?: Database["public"]["Enums"]["unit_type"]
          unit_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiration_date?: string | null
          id?: string
          location?: Database["public"]["Enums"]["location_type"] | null
          open_status?: Database["public"]["Enums"]["open_status_type"] | null
          opened_at?: string | null
          package_count?: number | null
          product_id?: string
          purchase_date?: string | null
          quantity?: number
          serving_count?: number | null
          status?: Database["public"]["Enums"]["stock_status"] | null
          tracking_mode?: Database["public"]["Enums"]["tracking_mode_type"]
          unit?: Database["public"]["Enums"]["unit_type"]
          unit_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      import_status: "pending" | "previewed" | "applied" | "rejected"
      location_type: "pantry" | "fridge" | "freezer" | "other"
      movement_type:
        | "purchase"
        | "consumption"
        | "adjustment"
        | "waste"
        | "expiry"
      nutrition_relevance_type: "required" | "optional" | "ignore"
      nutrition_source_type:
        | "label"
        | "openfoodfacts"
        | "food_database"
        | "manual"
        | "ai_estimate"
      open_status_type: "sealed" | "opened"
      stock_status: "available" | "low" | "expired" | "consumed"
      tracking_mode_type: "bulk" | "package" | "serving"
      unit_type: "g" | "ml" | "unit" | "kg" | "l"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      import_status: ["pending", "previewed", "applied", "rejected"],
      location_type: ["pantry", "fridge", "freezer", "other"],
      movement_type: [
        "purchase",
        "consumption",
        "adjustment",
        "waste",
        "expiry",
      ],
      nutrition_relevance_type: ["required", "optional", "ignore"],
      nutrition_source_type: [
        "label",
        "openfoodfacts",
        "food_database",
        "manual",
        "ai_estimate",
      ],
      open_status_type: ["sealed", "opened"],
      stock_status: ["available", "low", "expired", "consumed"],
      tracking_mode_type: ["bulk", "package", "serving"],
      unit_type: ["g", "ml", "unit", "kg", "l"],
    },
  },
} as const
