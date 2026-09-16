import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/cookies";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";

export const metadata: Metadata = { title: "Admin · Audit Log" };

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/audit");
  if (user.role !== "ADMIN") redirect("/admin");

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
      <p className="mt-1 text-sm text-muted">Administrative actions (ADMIN only).</p>

      {events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit events yet" className="mt-8" />
      ) : (
        <ul className="mt-6 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{e.action}</span>
                <span className="text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {e.actor ? `${e.actor.name} (${e.actor.email})` : "System"} · {e.entityType}
                {e.entityId ? ` #${e.entityId.slice(-8)}` : ""}
              </p>
              {e.metadata && <pre className="mt-1 overflow-x-auto text-xs text-muted">{e.metadata}</pre>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
