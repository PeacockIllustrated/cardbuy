import Link from "next/link";
import { Button } from "@/components/ui/Form";

export default function NotFound() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-[clamp(80px,18vw,180px)] leading-none tracking-tight text-ink">
        404
      </p>
      <h1 className="font-display uppercase tracking-wider text-2xl mt-4 text-ink">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-muted">
        That page has wandered off. Try the shopfront, start a buylist
        submission, or head home.
      </p>
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Link href="/">
          <Button variant="primary">Home</Button>
        </Link>
        <Link href="/shop">
          <Button variant="secondary">Browse shop</Button>
        </Link>
        <Link href="/submission">
          <Button variant="secondary">Sell cards</Button>
        </Link>
      </div>
    </section>
  );
}
