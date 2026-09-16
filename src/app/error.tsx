"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side console only — never render `error.message`/stack to the
    // page, per docs/SECURITY.md's error-leakage rule. Server-side errors are
    // already logged structurally in src/lib/api-helpers.ts.
    console.error("Unhandled client error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <Alert variant="danger" title="Something went wrong">
        We couldn&apos;t load this page. Please try again.
      </Alert>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
