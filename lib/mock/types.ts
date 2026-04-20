/**
 * Phase-1 mock types. Field names mirror SCHEMA.sql so the Phase 2 swap from
 * `/lib/mock/*` to Supabase queries is a find-and-replace, not a refactor.
 *
 * Anything you add here SHOULD have an obvious counterpart in SCHEMA.sql.
 */

export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type GradingCompany = "PSA" | "CGC" | "BGS" | "SGC" | "ACE";
export type Grade = "10" | "9.5" | "9" | "8.5" | "8" | "7";

export type GradedPriceEntry = {
  market: number; // raw USD
  low: number;
  high: number;
  sale_count: number;
};

export type GradedPrices = Partial<
  Record<GradingCompany, Partial<Record<Grade, GradedPriceEntry>>>
>;

export type RawPrices = Partial<
  Record<Condition, { market: number; low: number; high: number; sale_count: number }>
>;

export type MockCard = {
  id: string;
  name: string;
  set_id: string;
  set_name: string;
  card_number: string;
  rarity: string;
  language: "EN" | "JP";
  release_year: number;
  image_url: string | null;
  image_url_large: string | null;
  raw_prices: RawPrices;
  graded_prices: GradedPrices;
  sale_count_30d: number;
  last_synced: string; // ISO
};

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

export type MockSubmissionItem = {
  id: string;
  card_id: string;
  card_name: string; // denormalised for the wireframe
  set_name: string;
  variant: "raw" | "graded";
  condition?: Condition;
  grading_company?: GradingCompany;
  grade?: Grade;
  quantity: number;
  offered_amount_per: number; // GBP
  offered_amount_total: number; // GBP
};

export type MockSubmission = {
  id: string;
  reference: string; // CB-YYYY-NNNNNN
  seller_name: string;
  seller_email: string;
  status: SubmissionStatus;
  payout_method: PayoutMethod;
  shipping_method: "royal_mail_tracked" | "send_yourself";
  total_offered: number;
  total_paid: number | null;
  submitted_at: string; // ISO
  items: MockSubmissionItem[];
};

export type ConditionMultipliers = Record<Condition, number>;
export type GradeMultipliers = Record<GradingCompany, Partial<Record<Grade, number>>>;

export type SetOverride = { set_id: string; set_name: string; margin: number; active: boolean };
export type RarityOverride = { rarity: string; margin: number; active: boolean };

export type ListingStatus = "active" | "hidden" | "sold_out";

export type MockListing = {
  id: string;
  card_id: string;
  card_name: string;        // denormalised for the wireframe
  set_name: string;
  rarity: string;
  image_url: string | null;
  sku: string;
  variant: "raw" | "graded";
  condition?: Condition;
  grading_company?: GradingCompany;
  grade?: Grade;
  price_gbp: number;
  cost_basis_gbp: number;
  qty_in_stock: number;
  qty_reserved: number;
  status: ListingStatus;
  is_featured: boolean;
  featured_priority: number | null;
  condition_notes: string | null;
  created_at: string; // ISO
};

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "packing"
  | "shipped"
  | "delivered"
  | "refunded"
  | "cancelled";

export type ShippingAddress = {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};

export type MockOrderItem = {
  id: string;
  listing_id: string;
  card_name: string;
  set_name: string;
  variant: "raw" | "graded";
  condition?: Condition;
  grading_company?: GradingCompany;
  grade?: Grade;
  qty: number;
  unit_price_gbp: number;
  line_total_gbp: number;
};

export type MockOrder = {
  id: string;
  reference: string;        // CB-ORD-YYYY-NNNNNN
  buyer_name: string;
  buyer_email: string;
  status: OrderStatus;
  subtotal_gbp: number;
  shipping_gbp: number;
  total_gbp: number;
  payment_method: "stripe_card" | "paypal_in";
  shipping_method: "royal_mail_tracked" | "royal_mail_special";
  shipping_address: ShippingAddress;
  tracking_number: string | null;
  placed_at: string; // ISO
  items: MockOrderItem[];
};

export type MockMarginConfig = {
  id: string;
  global_margin: number; // 0..1, e.g. 0.55
  min_buy_price: number; // GBP
  confidence_threshold: number; // min 30d sale count
  condition_multipliers: ConditionMultipliers;
  grade_multipliers: GradeMultipliers;
  set_overrides: SetOverride[];
  rarity_overrides: RarityOverride[];
  fx_rate_usd_gbp: number;
  fx_rate_updated_at: string; // ISO
  fx_manual_override: boolean;
};
