/**
 * Resolves a budget head + sub-head pair (by name, the form payload's identity)
 * into stable catalog row IDs. Used by every module that inserts a
 * head/sub-head reference (budget proposals, finance breakup, expenditure
 * rows) so we store IDs alongside the snapshot text.
 *
 * NEW: prefer to write IDs on insert. SNAPSHOT TEXT stays for audit/history.
 * LEGACY: if the catalog has no row matching the submitted name (e.g. older
 * data that pre-dates the catalog), IDs come back as NULL and downstream code
 * falls back to text matching — that is the documented legacy behavior.
 */

const memoCache = new Map();
const MEMO_TTL_MS = 60_000;
const HOAC_GROUPS = new Set(['Events & Competitions', 'Meetings & Audits']);

function memoKey(headName, subHeadName, scope) {
    return `${String(headName || '').trim().toLowerCase()}::${String(subHeadName || '').trim().toLowerCase()}::${scope}`;
}

function readCache(key) {
    const hit = memoCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > MEMO_TTL_MS) {
        memoCache.delete(key);
        return null;
    }
    return hit.value;
}

function writeCache(key, value) {
    memoCache.set(key, { value, at: Date.now() });
}

function normalizeText(value) {
    return String(value || '').trim();
}

async function resolveHoacEventType(connection, primaryHead) {
    const trimmedHead = normalizeText(primaryHead);
    if (!trimmedHead) return '';
    if (HOAC_GROUPS.has(trimmedHead)) return trimmedHead;

    const cacheKey = `hoac-event-type::${trimmedHead.toLowerCase()}`;
    const cached = readCache(cacheKey);
    if (cached !== null) return cached;

    const [rows] = await connection.query(
        'SELECT group_label FROM budget_heads WHERE name = ? LIMIT 1',
        [trimmedHead],
    );
    const groupLabel = normalizeText(rows[0]?.group_label);
    const eventType = HOAC_GROUPS.has(groupLabel) ? groupLabel : '';
    writeCache(cacheKey, eventType);
    return eventType;
}

/**
 * Resolve a `(headName, subHeadName)` pair against the budget catalog.
 *
 * @param {object} connection - mysql2 connection or pool (must have .query)
 * @param {string|null} headName - the display name as submitted by the form
 * @param {string|null} subHeadName - the display name as submitted by the form
 * @param {object} [opts]
 * @param {'head-specific'|'hoac-shared'|'event-specific'} [opts.scope]
 *        Defaults to 'head-specific'. For HOAC / event scopes, headName
 *        carries the event_type ("Events & Competitions" / "Meetings & Audits").
 * @returns {Promise<{budget_head_id: number|null, budget_sub_head_id: number|null}>}
 */
export async function resolveCatalogIds(connection, headName, subHeadName, opts = {}) {
    const scope = opts.scope || 'head-specific';
    const trimmedHead = String(headName || '').trim();
    const trimmedSub = String(subHeadName || '').trim();
    if (!trimmedHead && !trimmedSub) {
        return { budget_head_id: null, budget_sub_head_id: null };
    }

    const cacheKey = memoKey(trimmedHead, trimmedSub, scope);
    const cached = readCache(cacheKey);
    if (cached) return { ...cached };

    let budget_head_id = null;
    let budget_sub_head_id = null;

    if (scope === 'head-specific') {
        if (trimmedHead) {
            const [rows] = await connection.query(
                'SELECT id FROM budget_heads WHERE name = ? LIMIT 1',
                [trimmedHead],
            );
            budget_head_id = rows[0]?.id || null;
        }
        if (budget_head_id && trimmedSub) {
            const [rows] = await connection.query(
                `SELECT id FROM budget_sub_heads
                 WHERE name = ? AND scope = 'head-specific' AND head_id = ?
                 LIMIT 1`,
                [trimmedSub, budget_head_id],
            );
            budget_sub_head_id = rows[0]?.id || null;
        }
    } else if (scope === 'hoac-shared' && trimmedSub) {
        // headName is the event_type here.
        const [rows] = await connection.query(
            `SELECT id FROM budget_sub_heads
             WHERE name = ? AND scope = 'hoac-shared' AND event_type = ?
             LIMIT 1`,
            [trimmedSub, trimmedHead],
        );
        budget_sub_head_id = rows[0]?.id || null;
    } else if (scope === 'event-specific' && trimmedSub) {
        const [rows] = await connection.query(
            `SELECT id FROM budget_sub_heads
             WHERE name = ? AND scope = 'event-specific' AND event_type = ?
             LIMIT 1`,
            [trimmedSub, trimmedHead],
        );
        budget_sub_head_id = rows[0]?.id || null;
    }

    const result = { budget_head_id, budget_sub_head_id };
    writeCache(cacheKey, result);
    return result;
}

/**
 * Convenience for the finance/expenditure header row, which carries
 * `primary_head` (a normal budget head) and `event_sub_head` (an HOAC-shared
 * sub-head keyed by the primary head's event group).
 */
export async function resolvePrimaryHeadIds(connection, primaryHead, eventSubHead) {
    const head = await resolveCatalogIds(connection, primaryHead, null, { scope: 'head-specific' });
    let event_sub_head_id = null;
    if (eventSubHead) {
        // HOAC sub-heads are scoped by event_type. If primaryHead is a child
        // head (for example Academic Events), resolve its parent HOAC group.
        const eventType = await resolveHoacEventType(connection, primaryHead);
        if (eventType) {
            const hoac = await resolveCatalogIds(connection, eventType, eventSubHead, { scope: 'hoac-shared' });
            event_sub_head_id = hoac.budget_sub_head_id;
        }
    }
    return {
        primary_head_id: head.budget_head_id,
        event_sub_head_id,
    };
}

/**
 * Drop the in-memory resolver cache. Call after the admin updates the catalog
 * so the next resolver call sees the latest names. (Admin writes are rare;
 * the 60s TTL is normally sufficient.)
 */
export function clearResolverCache() {
    memoCache.clear();
}
