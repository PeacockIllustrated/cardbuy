import "server-only";
import { createClient } from "@/lib/supabase/server";
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
