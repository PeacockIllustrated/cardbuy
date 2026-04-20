import { signOut } from "@/app/_actions/auth";
import { getAdminIdentity } from "@/app/_actions/admin";

/**
 * Admin header strip. Replaces the old "no auth wired yet" warning
 * now that Phase 2a has landed — shows the signed-in admin's identity
 * and an inline sign-out button. Kept on every /admin/* page via the
 * admin layout.
 */
export async function DevBanner() {
  const me = await getAdminIdentity();
  const label = me?.full_name ?? me?.email ?? "admin";

  return (
    <div
      className="border-[3px] border-ink bg-yellow px-4 py-2 font-display text-[12px] tracking-wider text-ink flex items-center gap-3 justify-between rounded-md"
      role="status"
    >
      <div className="flex items-center gap-3">
        <span className="bg-ink text-paper-strong px-2 py-0.5 text-[10px]">
          ADMIN
        </span>
        <span className="truncate max-w-[320px]">Signed in · {label}</span>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-[11px] tracking-wider underline underline-offset-4 decoration-2 hover:text-pink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
