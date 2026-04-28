"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Form";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route segment error:", error);
  }, [error]);

  return (
    <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-display text-[clamp(64px,14vw,140px)] leading-none tracking-tight text-ink">
        Oof.
      </p>
      <h1 className="font-display uppercase tracking-wider text-2xl mt-4 text-ink">
        Something broke
      </h1>
      <p className="mt-3 max-w-md text-muted">
        The page hit an error on the way out. Try again, or head home and pick
        up from there.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted font-mono">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        <Button variant="primary" onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </section>
  );
}
