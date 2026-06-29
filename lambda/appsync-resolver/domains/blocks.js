const { doc, T, PutCommand, DeleteCommand, QueryCommand } = require('../dynamo');
const { requireSignedIn, GraphqlError } = require('../auth');

async function listMyBlocks(identity) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new QueryCommand({
    TableName: T.blocks, KeyConditionExpression: 'blockerId = :u', ExpressionAttributeValues: { ':u': uid },
  }));
  return r.Items || [];
}

async function blockUser(identity, blockedId) {
  const uid = requireSignedIn(identity);
  if (uid === blockedId) throw new GraphqlError('Cannot block yourself', 'BadRequest');
  const item = { blockerId: uid, blockedId, createdAt: Date.now() };
  await doc.send(new PutCommand({ TableName: T.blocks, Item: item }));
  return item;
}

async function unblockUser(identity, blockedId) {
  const uid = requireSignedIn(identity);
  await doc.send(new DeleteCommand({ TableName: T.blocks, Key: { blockerId: uid, blockedId } }));
  return true;
}

module.exports = { listMyBlocks, blockUser, unblockUser };
