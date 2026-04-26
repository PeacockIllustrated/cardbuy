import { DevBanner } from "@/components/wireframe/DevBanner";
import { AdminSidebar, type AdminNavCounts } from "@/components/admin/AdminSidebar";
import { getAdminSubmissionStats } from "@/app/_actions/admin";
import { listAdminOrders } from "@/app/_actions/admin-shop";

async function getNavCounts(): Promise<AdminNavCounts> {
  try {
    const [stats, orders] = await Promise.all([
      getAdminSubmissionStats(),
      listAdminOrders("all"),
    ]);
    const toPack = orders.filter(
      (o) => o.status === "paid" || o.status === "packing",
    ).length;
    const pendingPayment = orders.filter(
      (o) => o.status === "pending_payment",
    ).length;
    return {
      awaitingCards: stats.awaitingCards,
      toPack,
      pendingPayment,
    };
  } catch {
    return { awaitingCards: 0, toPack: 0, pendingPayment: 0 };
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const counts = await getNavCounts();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminSidebar counts={counts} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 md:px-5 pt-3">
          <DevBanner />
        </div>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
