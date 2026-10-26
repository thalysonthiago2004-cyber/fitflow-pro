// Offline queue for workout logging. Each operation has a key (one set or one
// cardio block); a newer operation for the same key replaces the older one,
// because saving is an upsert and only the latest state matters. Stored per
// workout in localStorage so it survives reloads and closing the tab.

export type QueuedOp = { key: string; kind: "set" | "cardio"; payload: unknown };
export type SendResult = { ok: true } | { ok: false; message: string };
export type FlushOutcome = { sent: number; rejected: { key: string; message: string }[]; remaining: number };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageKey = (logId: string) => `fitflow:pending:${logId}`;

function safeStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readQueue(logId: string, store: Store | null = safeStore()): QueuedOp[] {
  try {
    const raw = store?.getItem(storageKey(logId));
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(logId: string, ops: QueuedOp[], store: Store | null) {
  try {
    if (ops.length) store?.setItem(storageKey(logId), JSON.stringify(ops));
    else store?.removeItem(storageKey(logId));
  } catch {
    // Storage full or unavailable: the op stays in memory for this session only.
  }
}

export function enqueue(logId: string, op: QueuedOp, store: Store | null = safeStore()): QueuedOp[] {
  const ops = [...readQueue(logId, store).filter((o) => o.key !== op.key), op];
  writeQueue(logId, ops, store);
  return ops;
}

/** Removes a queued op once a newer save for the same key reached the server. */
export function dropOp(logId: string, key: string, store: Store | null = safeStore()): QueuedOp[] {
  const ops = readQueue(logId, store).filter((o) => o.key !== key);
  writeQueue(logId, ops, store);
  return ops;
}

/** True when the call failed for lack of connection (not because the server refused it). */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|load failed/i.test(error.message));
}

/**
 * Sends queued ops in order. Stops at the first network failure (still
 * offline); ops the server refuses are dropped and reported, so a bad value
 * never blocks the rest.
 */
export async function flushQueue(logId: string, send: (op: QueuedOp) => Promise<SendResult>, store: Store | null = safeStore()): Promise<FlushOutcome> {
  const ops = readQueue(logId, store);
  const rejected: FlushOutcome["rejected"] = [];
  let sent = 0;
  let index = 0;
  for (; index < ops.length; index++) {
    try {
      const result = await send(ops[index]);
      if (result.ok) sent++;
      else rejected.push({ key: ops[index].key, message: result.message });
    } catch (error) {
      if (isNetworkError(error)) break;
      rejected.push({ key: ops[index].key, message: "Não foi possível salvar." });
    }
  }
  // Ops queued while flushing (same keys or new ones) are kept.
  const done = new Set(ops.slice(0, index).map((o) => JSON.stringify(o)));
  const left = readQueue(logId, store).filter((o) => !done.has(JSON.stringify(o)));
  writeQueue(logId, left, store);
  return { sent, rejected, remaining: left.length };
}
