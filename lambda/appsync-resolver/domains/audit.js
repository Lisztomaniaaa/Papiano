const { doc, T, PutCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

async function logAdminAction(identity, action, target, detail, byName) {
  const uid = requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const now = Date.now();
  const item = {
    shard: 'ALL', createdAt: `${String(now).padStart(13, '0')}#${uid}`,
    action: String(action || '').slice(0, 60), target: String(target || '').slice(0, 200),
    detail: String(detail || '').slice(0, 500), by: uid, byName: String(byName || '').slice(0, 60) || null, at: now,
  };
  await doc.send(new PutCommand({ TableName: T.auditLog, Item: item }));
  return item;
}

async function listAuditLog(identity, limit) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const r = await doc.send(new QueryCommand({
    TableName: T.auditLog, KeyConditionExpression: 'shard = :s', ExpressionAttributeValues: { ':s': 'ALL' },
    ScanIndexForward: false, Limit: limit || 80,
  }));
  return r.Items || [];
}

module.exports = { logAdminAction, listAuditLog };
