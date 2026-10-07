export const revisionFields = ['revision', 'revisionCreatedBy', 'revisionComment', 'revisionDate'];
export function drawingRevisionHistory(record = {}) {
  const history = (record.revisions || []).map((r) => ({ ...r }));
  if (!record.revision) return history;
  const current = Object.fromEntries(revisionFields.map((key) => [key, record[key] || '']));
  if (history.at(-1)?.revision === current.revision) history[history.length - 1] = current;
  else history.push(current);
  return history;
}
export function withDrawingRevision(record, fields) {
  const revisions = drawingRevisionHistory(record);
  if (revisions.at(-1)?.revision === fields.revision)
    revisions[revisions.length - 1] = { ...fields };
  else {
    if (revisions.some((r) => r.revision === fields.revision))
      throw Error('Revisionsbeteckningen finns redan i historiken. Ange en ny beteckning.');
    revisions.push({ ...fields });
  }
  return { ...record, ...fields, revisions, needsReview: true };
}
