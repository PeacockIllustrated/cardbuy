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
  // Phase 6 · Slice C1 · granular consent (UK GDPR/PECR).
  consent_service_emails: boolean;
  consent_marketing_buylist: boolean;
  consent_marketing_shop: boolean;
  consent_aggregate_data: boolean;
  consent_updated_at: string | null;
  privacy_policy_accepted_at: string | null;
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

/* ─────────────────────────────────────────────────────────────────
 * Phase 6 · Binder (Slice A). Mirrors
 * `supabase/migrations/0006_phase6_binder.sql`.
 * ───────────────────────────────────────────────────────────────── */

export type BinderEntrySource = "manual" | "shop_order" | "import";

export interface LewisBinderEntry {
  id: string;
  user_id: string;
  card_id: string;
  variant: ItemVariant;
  /** Required when variant='raw', null when variant='graded'. */
  condition: ItemCondition | null;
  /** Required when variant='graded', null when variant='raw'. */
  grading_company: GradingCompany | null;
  /** Required when variant='graded', null when variant='raw'. */
  grade: Grade | null;
  quantity: number;
  is_grail: boolean;
  note: string | null;
  acquired_at: string;
  /** How this row got into the binder. Slice B1 added the column;
   *  Slice B2 populates 'shop_order' when checkout auto-add fires. */
  source: BinderEntrySource;
  /** Loose pointer to `lewis_orders.id`. Becomes an FK in the Phase 7
   *  shop-persistence migration. Null for manual entries. */
  source_order_id: string | null;
  /** Slice D · storage path (not a full URL) to the framed slab scan,
   *  if the entry was created via the camera capture. Null for manual
   *  adds. Resolve to a signed URL via the admin/storage helpers. */
  graded_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LewisWishlistEntry {
  id: string;
  user_id: string;
  card_id: string;
  target_price_gbp: number | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ─────────────────────────────────────────────────────────────────
 * Phase 7 · Shop persistence. Mirrors
 * `supabase/migrations/0010_phase7_shop.sql`.
 * ───────────────────────────────────────────────────────────────── */

export type ListingStatus = "active" | "hidden" | "sold_out";
export type ShopOrderStatus =
  | "pending_payment"
  | "paid"
  | "packing"
  | "shipped"
  | "delivered"
  | "refunded"
  | "cancelled";
export type PaymentMethod = "stripe_card" | "paypal_in" | "stub";
export type ShippingMethodOption =
  | "royal_mail_tracked"
  | "royal_mail_special";

export interface ShippingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string;
}

export interface LewisListing {
  id: string;
  card_id: string;
  sku: string;
  variant: ItemVariant;
  condition: ItemCondition | null;
  grading_company: GradingCompany | null;
  grade: Grade | null;
  price_gbp: number;
  cost_basis_gbp: number;
  qty_in_stock: number;
  qty_reserved: number;
  status: ListingStatus;
  is_featured: boolean;
  featured_priority: number | null;
  condition_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LewisOrder {
  id: string;
  reference: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_name: string;
  status: ShopOrderStatus;
  subtotal_gbp: number;
  shipping_gbp: number;
  total_gbp: number;
  payment_method: PaymentMethod;
  shipping_method: ShippingMethodOption;
  shipping_address: ShippingAddress;
  tracking_number: string | null;
  add_to_binder_opt_in: boolean;
  binder_entries_created_at: string | null;
  placed_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  notes_internal: string | null;
  notes_buyer: string | null;
  created_at: string;
  updated_at: string;
}

export interface LewisOrderItem {
  id: string;
  order_id: string;
  listing_id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  variant: ItemVariant;
  condition: ItemCondition | null;
  grading_company: GradingCompany | null;
  grade: Grade | null;
  qty: number;
  unit_price_gbp: number;
  line_total_gbp: number;
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
      lewis_binder_entries: {
        Row: LewisBinderEntry;
        Insert: Omit<
          LewisBinderEntry,
          "id" | "created_at" | "updated_at" | "acquired_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          acquired_at?: string;
        };
        Update: Partial<LewisBinderEntry>;
        Relationships: [];
      };
      lewis_wishlist_entries: {
        Row: LewisWishlistEntry;
        Insert: Omit<
          LewisWishlistEntry,
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LewisWishlistEntry>;
        Relationships: [];
      };
      lewis_listings: {
        Row: LewisListing;
        Insert: Omit<LewisListing, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LewisListing>;
        Relationships: [];
      };
      lewis_orders: {
        Row: LewisOrder;
        Insert: Omit<
          LewisOrder,
          "id" | "reference" | "placed_at" | "created_at" | "updated_at"
        > & {
          id?: string;
          reference?: string;
          placed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LewisOrder>;
        Relationships: [];
      };
      lewis_order_items: {
        Row: LewisOrderItem;
        Insert: Omit<LewisOrderItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<LewisOrderItem>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
