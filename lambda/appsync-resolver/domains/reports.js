const { doc, T, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

async function listMyReports(identity) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new QueryCommand({
    TableName: T.reports, KeyConditionExpression: 'reporterId = :u', ExpressionAttributeValues: { ':u': uid },
  }));
  return r.Items || [];
}

async function listAllReports(identity) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const r = await doc.send(new ScanCommand({ TableName: T.reports }));
  return r.Items || [];
}

async function submitReport(identity, input) {
  const uid = requireSignedIn(identity);
  const item = {
    reporterId: uid, targetId: input.targetId, targetName: input.targetName || null,
    reason: input.reason, source: input.source || null, roomId: input.roomId || null,
    roomType: input.roomType || null, messageId: input.messageId || null,
    messageTextSnapshot: input.messageTextSnapshot || null, messageImageURL: input.messageImageURL || null,
    messageSenderName: input.messageSenderName || null, createdAt: Date.now(),
  };
  await doc.send(new PutCommand({
    TableName: T.reports, Item: item,
    ConditionExpression: 'attribute_not_exists(reporterId) AND attribute_not_exists(targetId)',
  })).catch((e) => {
    if (e.name === 'ConditionalCheckFailedException') return; // idempotent: already reported
    throw e;
  });
  return item;
}

async function resolveReport(identity, reporterId, targetId) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  await doc.send(new DeleteCommand({ TableName: T.reports, Key: { reporterId, targetId } }));
  return true;
}

module.exports = { listMyReports, listAllReports, submitReport, resolveReport };
