const { doc, T, GetCommand, PutCommand, DeleteCommand, QueryCommand, TransactWriteCommand } = require('../dynamo');
const { requireSignedIn, GraphqlError } = require('../auth');

async function listMyFriends(identity) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new QueryCommand({
    TableName: T.friendships, KeyConditionExpression: 'uid = :u AND begins_with(sk, :p)',
    ExpressionAttributeValues: { ':u': uid, ':p': 'accepted#' },
  }));
  return (r.Items || []).map(toFriendship);
}

async function listIncomingFriendRequests(identity) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new QueryCommand({
    TableName: T.friendships, KeyConditionExpression: 'uid = :u AND begins_with(sk, :p)',
    ExpressionAttributeValues: { ':u': uid, ':p': 'pending_received#' },
  }));
  return (r.Items || []).map(toFriendship);
}

function toFriendship(item) {
  const status = item.sk.split('#')[0];
  return { uid: item.uid, otherUid: item.otherUid, status, requesterId: item.requesterId, receiverId: item.receiverId, createdAt: item.createdAt, acceptedAt: item.acceptedAt || null };
}

async function sendFriendRequest(identity, otherUid) {
  const uid = requireSignedIn(identity);
  if (uid === otherUid) throw new GraphqlError('Cannot friend yourself', 'BadRequest');
  const now = Date.now();
  await doc.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: T.friendships, Item: { uid, sk: `pending_sent#${otherUid}`, otherUid, requesterId: uid, receiverId: otherUid, createdAt: now }, ConditionExpression: 'attribute_not_exists(uid)' } },
      { Put: { TableName: T.friendships, Item: { uid: otherUid, sk: `pending_received#${uid}`, otherUid: uid, requesterId: uid, receiverId: otherUid, createdAt: now }, ConditionExpression: 'attribute_not_exists(uid)' } },
    ],
  })).catch((e) => {
    if (e.name === 'TransactionCanceledException') throw new GraphqlError('Friend request already exists', 'Conflict');
    throw e;
  });
  return { uid, otherUid, status: 'pending_sent', requesterId: uid, receiverId: otherUid, createdAt: now, acceptedAt: null };
}

async function acceptFriendRequest(identity, otherUid) {
  const uid = requireSignedIn(identity);
  const mine = await doc.send(new GetCommand({ TableName: T.friendships, Key: { uid, sk: `pending_received#${otherUid}` } }));
  if (!mine.Item) throw new GraphqlError('No pending request from this user', 'NotFound');
  const now = Date.now();
  await doc.send(new TransactWriteCommand({
    TransactItems: [
      { Delete: { TableName: T.friendships, Key: { uid, sk: `pending_received#${otherUid}` } } },
      { Delete: { TableName: T.friendships, Key: { uid: otherUid, sk: `pending_sent#${uid}` } } },
      { Put: { TableName: T.friendships, Item: { uid, sk: `accepted#${otherUid}`, otherUid, requesterId: mine.Item.requesterId, receiverId: mine.Item.receiverId, createdAt: mine.Item.createdAt, acceptedAt: now } } },
      { Put: { TableName: T.friendships, Item: { uid: otherUid, sk: `accepted#${uid}`, otherUid: uid, requesterId: mine.Item.requesterId, receiverId: mine.Item.receiverId, createdAt: mine.Item.createdAt, acceptedAt: now } } },
    ],
  }));
  return toFriendship({ uid, sk: `accepted#${otherUid}`, otherUid, requesterId: mine.Item.requesterId, receiverId: mine.Item.receiverId, createdAt: mine.Item.createdAt, acceptedAt: now });
}

async function removeFriendship(identity, otherUid) {
  const uid = requireSignedIn(identity);
  for (const status of ['accepted', 'pending_sent', 'pending_received']) {
    await doc.send(new DeleteCommand({ TableName: T.friendships, Key: { uid, sk: `${status}#${otherUid}` } }));
  }
  const reverseStatus = { accepted: 'accepted', pending_sent: 'pending_received', pending_received: 'pending_sent' };
  for (const status of Object.keys(reverseStatus)) {
    await doc.send(new DeleteCommand({ TableName: T.friendships, Key: { uid: otherUid, sk: `${reverseStatus[status]}#${uid}` } }));
  }
  return true;
}

module.exports = { listMyFriends, listIncomingFriendRequests, sendFriendRequest, acceptFriendRequest, removeFriendship };
