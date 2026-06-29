const { doc, T, PutCommand, GetCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

async function listRoles(identity) {
  requireSignedIn(identity);
  const r = await doc.send(new ScanCommand({ TableName: T.roles }));
  return r.Items || [];
}

async function setRole(identity, uid, role) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const item = { uid, role };
  await doc.send(new PutCommand({ TableName: T.roles, Item: item }));
  return item;
}

async function getDeletedAccount(identity, uid) {
  const me = requireSignedIn(identity);
  if (me !== uid && !isAdmin(identity)) throw new GraphqlError('Forbidden', 'Forbidden');
  const r = await doc.send(new GetCommand({ TableName: T.deletedAccounts, Key: { uid } }));
  return r.Item || null;
}

async function setDeletedAccount(identity, uid, reason) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const item = { uid, deletedAt: Date.now(), reason: reason || null };
  await doc.send(new PutCommand({ TableName: T.deletedAccounts, Item: item }));
  return item;
}

module.exports = { listRoles, setRole, getDeletedAccount, setDeletedAccount };
