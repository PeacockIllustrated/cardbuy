import { CartView } from "./CartView";

export const dynamic = "force-dynamic";

export default function ShopCartPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="bg-pink text-ink border-2 border-ink w-fit px-2 py-1 font-display text-[10px] tracking-wider">
          Basket
        </span>
        <h1 className="font-display text-[36px] leading-none tracking-tight">
          Your basket
        </h1>
      </header>
      <CartView />
    </div>
  );
}
