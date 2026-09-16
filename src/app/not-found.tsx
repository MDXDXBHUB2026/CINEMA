import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
      <Link href="/" className="mt-6 inline-block">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
