const SCOPES = new Set(['pack', 'roster', 'round', 'map', 'series', 'tournament', 'stage', 'career']);
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function settleEvent(state, event, apply = () => {}) {
  if (!event || typeof event.runId !== 'string' || !event.runId || typeof event.eventId !== 'string'
    || !event.eventId || !SCOPES.has(event.scope)) throw new Error('无效的结算事件身份');
  if (!Array.isArray(event.participants) || event.participants.some(id => typeof id !== 'string')
    || new Set(event.participants).size !== event.participants.length) throw new Error('无效的实际参赛快照');
  const key = JSON.stringify([event.runId, event.scope, event.eventId]);
  const facts = stable({ participants: event.participants, payload: event.payload ?? null });
  const old = state.ledger[key];
  if (old) {
    if (old.facts !== facts) throw new Error('同一结算事件的事实冲突');
    return { state, applied: false };
  }
  const next = structuredClone(state);
  const careerBefore = state.simulation?.mode === 'preview' ? stable(state.career) : null;
  apply(next);
  if (careerBefore !== null && stable(next.career) !== careerBefore) throw new Error('预演不能修改永久生涯收益');
  next.ledger[key] = { runId: event.runId, scope: event.scope, eventId: event.eventId,
    participants: [...event.participants], payload: structuredClone(event.payload ?? null), facts };
  return { state: next, applied: true };
}
function createPreview(state) {
  const next = structuredClone(state);
  next.simulation = { mode: 'preview' };
  return next;
}
module.exports = { settleEvent, createPreview };
