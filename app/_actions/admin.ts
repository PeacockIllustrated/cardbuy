import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCardById } from "@/lib/fixtures/cards";
import { MOCK_LISTINGS } from "@/lib/mock/mock-listings";
import type {
  LewisSubmission,
  LewisSubmissionItem,
  LewisUser,
  SubmissionStatus,
} from "@/lib/supabase/types";

/**
 * Admin-facing reads. All of these run as the signed-in user — RLS
 * policy `lewis_submissions: admin all` scopes visibility to admins
 * only, so there's no service-role key on the server.
 *
 * Gated upstream by `middleware.ts`; these helpers assume the caller
 * has already passed the role check.
 */

export type AdminSubmissionRow = LewisSubmission & {
  seller_email: string;
  seller_name: string | null;
  item_count: number;
};

export async function listAdminSubmissions(
  status?: SubmissionStatus,
): Promise<AdminSubmissionRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("lewis_submissions")
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: submissions } = await query;
  if (!submissions || submissions.length === 0) return [];

  const rows = submissions as LewisSubmission[];
  const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)));
  const submissionIds = rows.map((r) => r.id);

  const [{ data: users }, { data: items }] = await Promise.all([
    supabase
      .from("lewis_users")
      .select("id, email, full_name")
      .in("id", sellerIds),
    supabase
      .from("lewis_submission_items")
      .select("submission_id, quantity")
      .in("submission_id", submissionIds),
  ]);

  const userById = new Map<string, Pick<LewisUser, "id" | "email" | "full_name">>(
    (users as Pick<LewisUser, "id" | "email" | "full_name">[] | null ?? []).map(
      (u) => [u.id, u],
    ),
  );

  const itemCountById = new Map<string, number>();
  for (const i of (items ?? []) as { submission_id: string; quantity: number }[]) {
    itemCountById.set(
      i.submission_id,
      (itemCountById.get(i.submission_id) ?? 0) + i.quantity,
    );
  }

  return rows.map((r) => ({
    ...r,
    seller_email: userById.get(r.seller_id)?.email ?? "—",
    seller_name: userById.get(r.seller_id)?.full_name ?? null,
    item_count: itemCountById.get(r.id) ?? 0,
  }));
}

export async function getAdminSubmission(reference: string): Promise<
  | {
      submission: LewisSubmission;
      items: LewisSubmissionItem[];
      seller: Pick<LewisUser, "id" | "email" | "full_name" | "postcode" | "country" | "paypal_email">;
    }
  | null
> {
  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("lewis_submissions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (!submission) return null;

  const sub = submission as LewisSubmission;

  const [{ data: items }, { data: seller }] = await Promise.all([
    supabase
      .from("lewis_submission_items")
      .select("*")
      .eq("submission_id", sub.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("lewis_users")
      .select("id, email, full_name, postcode, country, paypal_email")
      .eq("id", sub.seller_id)
      .maybeSingle(),
  ]);

  return {
    submission: sub,
    items: (items ?? []) as LewisSubmissionItem[],
    seller:
      (seller as Pick<
        LewisUser,
        "id" | "email" | "full_name" | "postcode" | "country" | "paypal_email"
      > | null) ??
      {
        id: sub.seller_id,
        email: "—",
        full_name: null,
        postcode: null,
        country: null,
        paypal_email: null,
      },
  };
}

export type AdminSubmissionStats = {
  total: number;
  awaitingCards: number;
  received: number;
  underReview: number;
  offerRevised: number;
  paid: number;
  rejected: number;
  committedGbp: number; // open (not paid / rejected / cancelled)
  cardsInQueue: number; // received / under_review / offer_revised
};

export async function getAdminSubmissionStats(): Promise<AdminSubmissionStats> {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("lewis_submissions")
    .select("id, status, total_offered")
    .neq("status", "draft");

  const rows =
    (submissions as Pick<LewisSubmission, "id" | "status" | "total_offered">[] | null) ??
    [];

  const { data: items } = await supabase
    .from("lewis_submission_items")
    .select("submission_id, quantity");

  const itemsRows = (items as { submission_id: string; quantity: number }[] | null) ?? [];
  const itemsBySub = new Map<string, number>();
  for (const i of itemsRows) {
    itemsBySub.set(i.submission_id, (itemsBySub.get(i.submission_id) ?? 0) + i.quantity);
  }

  const closed: SubmissionStatus[] = ["paid", "rejected", "cancelled", "returned"];
  const queue: SubmissionStatus[] = ["received", "under_review", "offer_revised"];

  let committed = 0;
  let cardsInQueue = 0;
  const count = (s: SubmissionStatus) => rows.filter((r) => r.status === s).length;

  for (const r of rows) {
    if (!closed.includes(r.status as SubmissionStatus)) {
      committed += Number(r.total_offered ?? 0);
    }
    if (queue.includes(r.status as SubmissionStatus)) {
      cardsInQueue += itemsBySub.get(r.id) ?? 0;
    }
  }

  return {
    total: rows.length,
    awaitingCards: count("awaiting_cards") + count("submitted"),
    received: count("received"),
    underReview: count("under_review"),
    offerRevised: count("offer_revised"),
    paid: count("paid"),
    rejected: count("rejected"),
    committedGbp: Math.round(committed * 100) / 100,
    cardsInQueue,
  };
}

export type AdminActivityRow = {
  when: string;
  ref: string;
  who: string;
  status: SubmissionStatus;
  amount: number;
};

export async function getAdminRecentActivity(
  limit = 10,
): Promise<AdminActivityRow[]> {
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("lewis_submissions")
    .select("reference, status, total_offered, submitted_at, created_at, seller_id")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (submissions as
    | {
        reference: string;
        status: SubmissionStatus;
        total_offered: number | null;
        submitted_at: string | null;
        created_at: string;
        seller_id: string;
      }[]
    | null) ?? [];

  if (rows.length === 0) return [];

  const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)));
  const { data: users } = await supabase
    .from("lewis_users")
    .select("id, email, full_name")
    .in("id", sellerIds);
  const userById = new Map<string, { email: string; full_name: string | null }>(
    ((users as { id: string; email: string; full_name: string | null }[] | null) ??
      []).map((u) => [u.id, { email: u.email, full_name: u.full_name }]),
  );

  return rows.map((r) => ({
    when: r.submitted_at ?? r.created_at,
    ref: r.reference,
    who: userById.get(r.seller_id)?.full_name ?? userById.get(r.seller_id)?.email ?? "—",
    status: r.status,
    amount: Number(r.total_offered ?? 0),
  }));
}

export type AdminUserRow = Pick<
  LewisUser,
  | "id"
  | "email"
  | "full_name"
  | "phone"
  | "postcode"
  | "country"
  | "role"
  | "paypal_email"
  | "created_at"
  | "updated_at"
> & {
  submission_count: number;
  total_offered: number;
  latest_submission_at: string | null;
};

/**
 * List every `lewis_users` row with cheap aggregated submission stats.
 * Reads ONLY our prefixed tables — never touches `auth.users` directly.
 * RLS allows this for admins via `lewis_users: admin read all`.
 */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("lewis_users")
    .select("*")
    .order("created_at", { ascending: false });

  const userRows =
    (users as Array<
      Pick<
        LewisUser,
        | "id"
        | "email"
        | "full_name"
        | "phone"
        | "postcode"
        | "country"
        | "role"
        | "paypal_email"
        | "created_at"
        | "updated_at"
      >
    > | null) ?? [];

  if (userRows.length === 0) return [];

  const { data: submissions } = await supabase
    .from("lewis_submissions")
    .select("seller_id, total_offered, submitted_at, created_at")
    .neq("status", "draft");

  const subRows =
    (submissions as Array<{
      seller_id: string;
      total_offered: number | null;
      submitted_at: string | null;
      created_at: string;
    }> | null) ?? [];

  const stats = new Map<
    string,
    { count: number; total: number; latest: string | null }
  >();
  for (const s of subRows) {
    const prev = stats.get(s.seller_id) ?? { count: 0, total: 0, latest: null };
    const when = s.submitted_at ?? s.created_at;
    stats.set(s.seller_id, {
      count: prev.count + 1,
      total: prev.total + Number(s.total_offered ?? 0),
      latest:
        !prev.latest || when > prev.latest ? when : prev.latest,
    });
  }

  return userRows.map((u) => {
    const s = stats.get(u.id);
    return {
      ...u,
      submission_count: s?.count ?? 0,
      total_offered: s?.total ?? 0,
      latest_submission_at: s?.latest ?? null,
    };
  });
}

/**
 * Phase 6 · Slice B1 · Aggregate wishlist demand.
 *
 * "How much do people want each card?" Reads every wishlist row
 * (admin RLS policy allows cross-user reads on `lewis_wishlist_entries`),
 * groups by card_id, joins the card fixture for labels, and joins the
 * in-memory mock listings for current in-stock context. Shop listings
 * are still mock in Slice B1 — swap this join out when shop orders /
 * listings persist (Phase 7).
 */
export type AdminDemandRow = {
  card_id: string;
  card_name: string;
  set_name: string;
  dex_number: number | null;
  wishlist_count: number;
  targets_set: number; // how many of those wishlists carry a target price
  avg_target_gbp: number | null;
  min_target_gbp: number | null;
  max_target_gbp: number | null;
  current_in_stock: number; // sum of available qty across active listings
  lowest_listed_gbp: number | null;
};

export async function listAdminDemand(): Promise<AdminDemandRow[]> {
  const supabase = await createClient();

  const { data: wishlists } = await supabase
    .from("lewis_wishlist_entries")
    .select("card_id, target_price_gbp");

  const rows =
    (wishlists as Array<{
      card_id: string;
      target_price_gbp: number | null;
    }> | null) ?? [];

  if (rows.length === 0) return [];

  // Aggregate by card_id.
  type Agg = {
    count: number;
    targets: number[];
  };
  const byCard = new Map<string, Agg>();
  for (const w of rows) {
    const agg = byCard.get(w.card_id) ?? { count: 0, targets: [] };
    agg.count += 1;
    if (w.target_price_gbp !== null) {
      agg.targets.push(Number(w.target_price_gbp));
    }
    byCard.set(w.card_id, agg);
  }

  // Pre-index listings by card for the in-stock join.
  const listingsByCard = new Map<
    string,
    { stock: number; lowest: number | null }
  >();
  for (const l of MOCK_LISTINGS) {
    if (l.status !== "active") continue;
    const available = l.qty_in_stock - l.qty_reserved;
    if (available <= 0) continue;
    const prev = listingsByCard.get(l.card_id) ?? { stock: 0, lowest: null };
    listingsByCard.set(l.card_id, {
      stock: prev.stock + available,
      lowest:
        prev.lowest === null ? l.price_gbp : Math.min(prev.lowest, l.price_gbp),
    });
  }

  const out: AdminDemandRow[] = [];
  for (const [cardId, agg] of byCard) {
    const card = getCardById(cardId);
    const listingCtx = listingsByCard.get(cardId) ?? { stock: 0, lowest: null };
    const avg =
      agg.targets.length > 0
        ? Math.round(
            (agg.targets.reduce((a, b) => a + b, 0) / agg.targets.length) * 100,
          ) / 100
        : null;
    out.push({
      card_id: cardId,
      card_name: card?.name ?? cardId,
      set_name: setPrettyName(cardId),
      dex_number: card?.nationalPokedexNumbers?.[0] ?? null,
      wishlist_count: agg.count,
      targets_set: agg.targets.length,
      avg_target_gbp: avg,
      min_target_gbp: agg.targets.length > 0 ? Math.min(...agg.targets) : null,
      max_target_gbp: agg.targets.length > 0 ? Math.max(...agg.targets) : null,
      current_in_stock: listingCtx.stock,
      lowest_listed_gbp: listingCtx.lowest,
    });
  }

  // Highest demand first; ties broken by name so the ordering is stable.
  out.sort((a, b) => {
    if (b.wishlist_count !== a.wishlist_count)
      return b.wishlist_count - a.wishlist_count;
    return a.card_name.localeCompare(b.card_name);
  });

  return out;
}

const DEMAND_SET_NAMES: Record<string, string> = {
  base1: "Base Set",
  base2: "Jungle",
  base3: "Fossil",
  base4: "Base Set 2",
  base5: "Team Rocket",
  basep: "Wizards Black Star Promos",
};

function setPrettyName(cardId: string): string {
  const setId = cardId.split("-")[0];
  return DEMAND_SET_NAMES[setId] ?? setId;
}

/* ─────────────────────────────────────────────────────────────────
 * Phase 6 · Slice C2 · Demand drilldown + sourcing views.
 *
 * Both unblock after Phase 7 made listings + orders real. The
 * matchmaking layer (email dispatch) waits for Phase 8 — these two
 * views are the manual-fulfilment bridge in the meantime.
 * ───────────────────────────────────────────────────────────────── */

export type DemandWisher = {
  user_id: string;
  user_email: string;
  user_name: string | null;
  target_price_gbp: number | null;
  created_at: string;
};

export type DemandDrilldown = {
  card_id: string;
  card_name: string;
  set_name: string;
  dex_number: number | null;
  wishers: DemandWisher[];
  active_listings: Array<{
    id: string;
    sku: string;
    variant: "raw" | "graded";
    label: string;
    price_gbp: number;
    qty_available: number;
  }>;
};

export async function getDemandDrilldown(
  cardId: string,
): Promise<DemandDrilldown | null> {
  const supabase = await createClient();
  const card = getCardById(cardId);

  const { data: wishlistRows } = await supabase
    .from("lewis_wishlist_entries")
    .select("user_id, target_price_gbp, created_at")
    .eq("card_id", cardId)
    .order("target_price_gbp", {
      ascending: false,
      nullsFirst: false,
    });
  const wishes =
    (wishlistRows as Array<{
      user_id: string;
      target_price_gbp: number | null;
      created_at: string;
    }> | null) ?? [];

  if (wishes.length === 0 && !card) return null;

  const userIds = Array.from(new Set(wishes.map((w) => w.user_id)));
  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("lewis_users")
          .select("id, email, full_name")
          .in("id", userIds)
      : { data: [] };
  const byUser = new Map<
    string,
    { email: string; full_name: string | null }
  >(
    ((users as {
      id: string;
      email: string;
      full_name: string | null;
    }[] | null) ?? []).map((u) => [u.id, { email: u.email, full_name: u.full_name }]),
  );

  const wishers: DemandWisher[] = wishes.map((w) => ({
    user_id: w.user_id,
    user_email: byUser.get(w.user_id)?.email ?? "—",
    user_name: byUser.get(w.user_id)?.full_name ?? null,
    target_price_gbp:
      w.target_price_gbp !== null ? Number(w.target_price_gbp) : null,
    created_at: w.created_at,
  }));

  const { data: listings } = await supabase
    .from("lewis_listings")
    .select(
      "id, sku, variant, condition, grading_company, grade, price_gbp, qty_in_stock, qty_reserved, status",
    )
    .eq("card_id", cardId)
    .eq("status", "active")
    .order("price_gbp", { ascending: true });
  const active_listings =
    ((listings as Array<{
      id: string;
      sku: string;
      variant: "raw" | "graded";
      condition: string | null;
      grading_company: string | null;
      grade: string | null;
      price_gbp: number;
      qty_in_stock: number;
      qty_reserved: number;
      status: string;
    }> | null) ?? [])
      .map((l) => ({
        id: l.id,
        sku: l.sku,
        variant: l.variant,
        label:
          l.variant === "raw"
            ? `Raw · ${l.condition}`
            : `${l.grading_company} ${l.grade}`,
        price_gbp: Number(l.price_gbp),
        qty_available: l.qty_in_stock - l.qty_reserved,
      }))
      .filter((l) => l.qty_available > 0);

  return {
    card_id: cardId,
    card_name: card?.name ?? cardId,
    set_name: setPrettyName(cardId),
    dex_number: card?.nationalPokedexNumbers?.[0] ?? null,
    wishers,
    active_listings,
  };
}

export type Holder = {
  user_id: string;
  user_email: string;
  user_name: string | null;
  variant: "raw" | "graded";
  condition: string | null;
  grading_company: string | null;
  grade: string | null;
  quantity: number;
  is_grail: boolean;
  acquired_at: string;
  source: string;
};

export async function listHoldersOfCard(cardId: string): Promise<{
  card_id: string;
  card_name: string;
  set_name: string;
  holders: Holder[];
}> {
  const supabase = await createClient();
  const card = getCardById(cardId);

  const { data: binderRows } = await supabase
    .from("lewis_binder_entries")
    .select(
      "user_id, variant, condition, grading_company, grade, quantity, is_grail, acquired_at, source",
    )
    .eq("card_id", cardId)
    .order("is_grail", { ascending: false })
    .order("acquired_at", { ascending: false });
  const rows =
    (binderRows as Array<{
      user_id: string;
      variant: "raw" | "graded";
      condition: string | null;
      grading_company: string | null;
      grade: string | null;
      quantity: number;
      is_grail: boolean;
      acquired_at: string;
      source: string;
    }> | null) ?? [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: users } =
    userIds.length > 0
      ? await supabase
          .from("lewis_users")
          .select("id, email, full_name")
          .in("id", userIds)
      : { data: [] };
  const byUser = new Map<
    string,
    { email: string; full_name: string | null }
  >(
    ((users as {
      id: string;
      email: string;
      full_name: string | null;
    }[] | null) ?? []).map((u) => [u.id, { email: u.email, full_name: u.full_name }]),
  );

  const holders: Holder[] = rows.map((r) => ({
    user_id: r.user_id,
    user_email: byUser.get(r.user_id)?.email ?? "—",
    user_name: byUser.get(r.user_id)?.full_name ?? null,
    variant: r.variant,
    condition: r.condition,
    grading_company: r.grading_company,
    grade: r.grade,
    quantity: r.quantity,
    is_grail: r.is_grail,
    acquired_at: r.acquired_at,
    source: r.source,
  }));

  return {
    card_id: cardId,
    card_name: card?.name ?? cardId,
    set_name: setPrettyName(cardId),
    holders,
  };
}

/**
 * Admin identity for the layout header. Returns null if the caller
 * isn't actually signed in (should never happen — middleware gates it).
 */
export async function getAdminIdentity(): Promise<
  Pick<LewisUser, "email" | "full_name" | "role"> | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("lewis_users")
    .select("email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  return (
    (data as Pick<LewisUser, "email" | "full_name" | "role"> | null) ?? {
      email: user.email ?? "",
      full_name: null,
      role: "seller",
    }
  );
}
