const { doc, T, GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

async function listRoleDefinitions() {
  const r = await doc.send(new ScanCommand({ TableName: T.roleDefinitions }));
  return r.Items || [];
}

async function createRoleDefinition(identity, input) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  const label = String(input.label || '').trim().slice(0, 28);
  if (!label) throw new GraphqlError('label is required', 'BadRequest');
  const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40);
  if (!id) throw new GraphqlError('label needs letters or numbers', 'BadRequest');
  const color = /^#[0-9a-fA-F]{3,8}$/.test(input.color || '') ? input.color : '#4d90ff';
  const item = { id, label, color };
  await doc.send(new PutCommand({
    TableName: T.roleDefinitions, Item: item,
    ConditionExpression: 'attribute_not_exists(id)',
  })).catch((e) => {
    if (e.name === 'ConditionalCheckFailedException') throw new GraphqlError('Role already exists', 'Conflict');
    throw e;
  });
  return item;
}

async function deleteRoleDefinition(identity, id) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  await doc.send(new DeleteCommand({ TableName: T.roleDefinitions, Key: { id } }));
  // Strip the role from every profile that had it (scan is fine at admin-tool scale).
  const r = await doc.send(new ScanCommand({
    TableName: T.profiles, FilterExpression: '#r = :id', ExpressionAttributeNames: { '#r': 'role' }, ExpressionAttributeValues: { ':id': id },
  }));
  for (const profile of r.Items || []) {
    await doc.send(new UpdateCommand({
      TableName: T.profiles, Key: { uid: profile.uid },
      UpdateExpression: 'SET #r = :def', ExpressionAttributeNames: { '#r': 'role' }, ExpressionAttributeValues: { ':def': 'user' },
    })).catch(() => {});
  }
  return true;
}

module.exports = { listRoleDefinitions, createRoleDefinition, deleteRoleDefinition };
