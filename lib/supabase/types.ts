/**
 * Phase 2a Supabase row types.
 *
 * Hand-written to match `supabase/migrations/0001_phase2a_auth_submissions.sql`.
 * Supersede with `supabase gen types` once the CLI is wired up in Phase 2b.
 */

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "awaiting_cards"
  | "received"
  | "under_review"
  | "offer_revised"
  | "approved"
  | "paid"
  | "rejected"
  | "returned"
  | "cancelled";

export type PayoutMethod = "paypal" | "store_credit";

export type ItemVariant = "raw" | "graded";
export type ItemCondition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type GradingCompany = "PSA" | "CGC" | "BGS" | "SGC" | "ACE";

export interface LewisUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  postcode: string | null;
  country: string | null;
  role: "seller" | "admin";
  paypal_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LewisSubmission {
  id: string;
  reference: string;
  seller_id: string;
  status: SubmissionStatus;
  payout_method: PayoutMethod | null;
  payout_target: string | null;
  shipping_method: string;
  total_offered: number | null;
  total_paid: number | null;
  margin_config_id: string | null;
  terms_accepted_at: string | null;
  submitted_at: string | null;
  received_at: string | null;
  paid_at: string | null;
  notes_internal: string | null;
  notes_seller: string | null;
  created_at: string;
  updated_at: string;
}

export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type Grade = "10" | "9.5" | "9" | "8.5" | "8" | "7";

export type ConditionMultipliers = Record<Condition, number>;
export type GradeMultipliers = Record<
  GradingCompany,
  Partial<Record<Grade, number>>
>;

export type SetOverride = {
  set_id: string;
  set_name: string;
  margin: number;
  active: boolean;
};
export type RarityOverride = { rarity: string; margin: number; active: boolean };

export interface LewisAdminMargins {
  id: string;
  global_margin: number;
  min_buy_price: number;
  confidence_threshold: number;
  condition_multipliers: ConditionMultipliers;
  grade_multipliers: GradeMultipliers;
  set_overrides: SetOverride[];
  rarity_overrides: RarityOverride[];
  fx_rate_usd_gbp: number;
  fx_rate_eur_gbp: number;
  fx_rate_updated_at: string | null;
  fx_manual_override: boolean;
  created_at: string;
  created_by: string | null;
  change_note: string | null;
}

export interface LewisSubmissionItem {
  id: string;
  submission_id: string;
  card_id: string;
  variant: ItemVariant;
  condition: ItemCondition | null;
  grading_company: GradingCompany | null;
  grade: string | null;
  quantity: number;
  offered_amount_per: number;
  offered_amount_total: number;
  offer_breakdown: Record<string, unknown>;
  verified_condition: string | null;
  verified_grade: string | null;
  revised_amount_per: number | null;
  revised_amount_total: number | null;
  verification_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

/**
 * Minimal Database shape consumed by `createClient<Database>()`. We only
 * enumerate the tables this phase touches. Phase 2b extends it when
 * `lewis_cards`, `lewis_admin_margins`, etc. land.
 *
 * Shape mirrors what `supabase gen types typescript` emits — Views /
 * Functions / Enums / CompositeTypes must be present (even if empty)
 * for `@supabase/supabase-js` v2 to infer table types correctly.
 */
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      lewis_users: {
        Row: LewisUser;
        Insert: Partial<LewisUser> & { id: string; email: string };
        Update: Partial<LewisUser>;
        Relationships: [];
      };
      lewis_submissions: {
        Row: LewisSubmission;
        Insert: Partial<LewisSubmission> & { seller_id: string };
        Update: Partial<LewisSubmission>;
        Relationships: [];
      };
      lewis_submission_items: {
        Row: LewisSubmissionItem;
        Insert: Omit<
          LewisSubmissionItem,
          "id" | "created_at" | "offer_breakdown"
        > & {
          id?: string;
          created_at?: string;
          offer_breakdown?: Record<string, unknown>;
        };
        Update: Partial<LewisSubmissionItem>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
