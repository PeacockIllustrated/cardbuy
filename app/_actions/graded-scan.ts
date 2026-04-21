"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GradingCompany, Grade } from "@/lib/supabase/types";

/* ─────────────────────────────────────────────────────────────────
 * Phase 6 · Slice D · Graded-card scan server action.
 *
 * Accepts a cropped JPEG blob (from the `GradedCardScanner` canvas
 * export), uploads it to the `graded-scans` bucket under the user's
 * folder, and creates — or increments — a graded binder entry
 * pointing at the stored path.
 *
 * RLS on `storage.objects` enforces the `{user_id}/...` path prefix
 * rule; the path we construct here has to match or the insert fails.
 * ───────────────────────────────────────────────────────────────── */

export async function uploadGradedScan(formData: FormData): Promise<{
  entryId: string;
  imagePath: string;
}> {
  const file = formData.get("file");
  const cardId = String(formData.get("cardId") ?? "");
  const gradingCompany = String(
    formData.get("gradingCompany") ?? "",
  ) as GradingCompany;
  const grade = String(formData.get("grade") ?? "") as Grade;
  const note = formData.get("note") ? String(formData.get("note")) : null;

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Missing image file.");
  }
  if (!cardId) throw new Error("Missing card id.");
  if (!isGradingCompany(gradingCompany)) {
    throw new Error("Invalid grading company.");
  }
  if (!isGrade(grade)) {
    throw new Error("Invalid grade.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Scan must be 5 MB or smaller.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/card/${cardId}`);

  // Path shape must start with the user's uid — that's what the RLS
  // policies in 0009 check via `storage.foldername(name)[1]`.
  const ext = extForMime(file.type);
  const objectName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("graded-scans")
    .upload(objectName, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  // Find-or-increment on (user, card, graded, company, grade). Matches
  // the dedup contract in addBinderEntry — the separate entry point
  // here is because we need to attach the scan URL + the image was
  // already uploaded before we got to the row.
  const tupleFilter = {
    user_id: user.id,
    card_id: cardId,
    variant: "graded" as const,
    condition: null,
    grading_company: gradingCompany,
    grade,
  };

  const { data: existing } = await supabase
    .from("lewis_binder_entries")
    .select("id, quantity, graded_image_url")
    .match(tupleFilter)
    .maybeSingle();

  if (existing) {
    // Increment quantity; preserve existing scan URL unless there isn't
    // one yet (first-scan of a row that was added manually earlier).
    const { error } = await supabase
      .from("lewis_binder_entries")
      .update({
        quantity: existing.quantity + 1,
        ...(existing.graded_image_url ? {} : { graded_image_url: objectName }),
        ...(note ? { note } : {}),
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update entry: ${error.message}`);

    revalidatePath("/binder");
    revalidatePath(`/card/${cardId}`);
    return { entryId: existing.id, imagePath: objectName };
  }

  const { data: created, error: insErr } = await supabase
    .from("lewis_binder_entries")
    .insert({
      ...tupleFilter,
      quantity: 1,
      is_grail: false,
      note,
      graded_image_url: objectName,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    throw new Error(`Failed to create entry: ${insErr?.message ?? "unknown"}`);
  }

  revalidatePath("/binder");
  revalidatePath(`/card/${cardId}`);
  return { entryId: created.id, imagePath: objectName };
}

/* ─── helpers ───────────────────────────────────────────────────── */

function isGradingCompany(v: unknown): v is GradingCompany {
  return (
    v === "PSA" || v === "CGC" || v === "BGS" || v === "SGC" || v === "ACE"
  );
}

function isGrade(v: unknown): v is Grade {
  return (
    v === "10" || v === "9.5" || v === "9" || v === "8.5" || v === "8" || v === "7"
  );
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
