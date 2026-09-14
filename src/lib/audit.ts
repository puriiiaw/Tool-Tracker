import { db } from "@/db";

const insert = db.prepare(
  `INSERT INTO audit_log (actor_id, entity, entity_id, action, before_json, after_json)
   VALUES (?, ?, ?, ?, ?, ?)`
);

// Call inside the same transaction as the write it records.
export function audit(
  actorId: number,
  entity: string,
  entityId: number | null,
  action: string,
  before: unknown,
  after: unknown
) {
  insert.run(
    actorId,
    entity,
    entityId,
    action,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after)
  );
}
