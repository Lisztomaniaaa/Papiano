const { doc, T, PutCommand, GetCommand, DeleteCommand, ScanCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getProfile } = require('./profiles');

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

async function setDeletedAccount(identity, uid, reason, days) {
  const me = requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const now = Date.now();
  const profile = await getProfile(uid);
  const item = {
    uid, deletedAt: now, reason: reason || null,
    name: profile?.name || null, userId: profile?.userId || null, photoURL: profile?.photoURL || null,
    bannedBy: me, active: true, expiresAt: days > 0 ? now + days * 86400000 : null,
  };
  await doc.send(new PutCommand({ TableName: T.deletedAccounts, Item: item }));
  return item;
}

async function listBannedAccounts(identity) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const r = await doc.send(new ScanCommand({ TableName: T.deletedAccounts }));
  return (r.Items || []).filter((i) => i.active !== false);
}

async function unbanAccount(identity, uid) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  await doc.send(new DeleteCommand({ TableName: T.deletedAccounts, Key: { uid } }));
  return true;
}

module.exports = { listRoles, setRole, getDeletedAccount, setDeletedAccount, listBannedAccounts, unbanAccount };
