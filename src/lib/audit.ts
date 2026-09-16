import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Records an administrative/sensitive action for the audit trail (Agent 13/16). */
export async function recordAuditEvent(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
  logger.info("ADMIN_ACTION", { action: params.action, entityType: params.entityType, entityId: params.entityId, actorUserId: params.actorUserId });
}
