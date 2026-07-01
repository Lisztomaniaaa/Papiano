const crypto = require('crypto');
const { doc, T, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, TransactWriteCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');
const { getProfile } = require('./profiles');

function roomKeyForDm(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

async function getChatRoom(roomId) {
  const r = await doc.send(new GetCommand({ TableName: T.chatRooms, Key: { roomId } }));
  return r.Item || null;
}

async function listMyChatRooms(identity) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new QueryCommand({
    TableName: T.userChatRooms, KeyConditionExpression: 'uid = :u', ExpressionAttributeValues: { ':u': uid },
  }));
  const roomIds = (r.Items || []).map((i) => i.roomId);
  const rooms = await Promise.all(roomIds.map((id) => getChatRoom(id)));
  return rooms.filter(Boolean);
}

async function createChatRoom(identity, input) {
  const uid = requireSignedIn(identity);
  if (!['group', 'dm'].includes(input.type)) throw new GraphqlError('type must be group or dm', 'BadRequest');
  if (!input.participants.includes(uid)) throw new GraphqlError('Creator must be a participant', 'Forbidden');

  let roomId, roomKey;
  if (input.type === 'dm') {
    if (input.participants.length !== 2) throw new GraphqlError('dm rooms must have exactly 2 participants', 'BadRequest');
    roomKey = roomKeyForDm(input.participants[0], input.participants[1]);
    roomId = `dm_${roomKey}`;
  } else {
    roomId = `group_${crypto.randomUUID()}`;
    roomKey = roomId;
  }

  const existing = await getChatRoom(roomId);
  if (existing) return existing;

  const now = Date.now();
  const room = {
    roomId, type: input.type, roomKey, participants: input.participants,
    historyVisible: true, lastMessage: null, lastSenderId: null, unreadCount: {}, lastReadAt: {},
    hiddenFor: [], clearedAt: {}, updatedAt: now,
  };
  const transactItems = [
    { Put: { TableName: T.chatRooms, Item: room, ConditionExpression: 'attribute_not_exists(roomId)' } },
    ...input.participants.map((p) => ({
      Put: { TableName: T.userChatRooms, Item: { uid: p, roomId, lastMessage: null, lastSenderId: null, unreadCount: 0, updatedAt: now } },
    })),
  ];
  await doc.send(new TransactWriteCommand({ TransactItems: transactItems })).catch((e) => {
    if (e.name === 'TransactionCanceledException') return; // room created concurrently
    throw e;
  });
  return (await getChatRoom(roomId)) || room;
}

async function updateChatRoom(identity, roomId, participants) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  const admin = isAdmin(identity);
  if (!admin && !room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  if (room.type === 'dm' && !admin) throw new GraphqlError('Cannot modify dm participants', 'Forbidden');

  const sets = ['updatedAt = :u'];
  const vals = { ':u': Date.now() };
  if (participants !== undefined) { sets.push('participants = :p'); vals[':p'] = participants; }
  const r = await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeValues: vals,
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

async function listChatMessages(roomId, limit) {
  const r = await doc.send(new QueryCommand({
    TableName: T.messages, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
    ScanIndexForward: false, Limit: limit || 50,
  }));
  return { items: r.Items || [], nextToken: null };
}

async function sendChatMessage(identity, roomId, input) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (room.participants.length && !room.participants.includes(uid) && !isAdmin(identity)) throw new GraphqlError('Forbidden', 'Forbidden');

  const now = Date.now();
  const messageId = crypto.randomUUID();
  const profile = await getProfile(uid);
  const item = {
    roomId, createdAt: `${String(now).padStart(13, '0')}#${messageId}`, messageId,
    senderId: uid, senderName: profile?.name || 'Papiano User',
    senderUserId: profile?.userId || null, senderPhotoURL: profile?.photoURL || null,
    senderBadgeId: profile?.role || 'player',
    text: input.text || null,
    imageURL: input.imageURL || null, imagePath: input.imagePath || null,
    replyTo: input.replyTo || null, deletedForAll: false, updatedAt: now,
  };
  await doc.send(new PutCommand({ TableName: T.messages, Item: item }));

  const others = room.participants.filter((p) => p !== uid);
  const unreadNames = {};
  const unreadVals = { ':lm': input.text || '[media]', ':ls': uid, ':u': now };
  const unreadSets = ['lastMessage = :lm', 'lastSenderId = :ls', 'updatedAt = :u'];
  others.forEach((p, idx) => {
    const nameKey = `#u${idx}`;
    const valKey = `:c${idx}`;
    unreadNames[nameKey] = p;
    unreadVals[valKey] = ((room.unreadCount && room.unreadCount[p]) || 0) + 1;
    unreadSets.push(`unreadCount.${nameKey} = ${valKey}`);
  });
  // Re-surface the room for any recipient who had previously hidden it.
  if (Array.isArray(room.hiddenFor) && room.hiddenFor.length && others.some((p) => room.hiddenFor.includes(p))) {
    const keepFor = room.hiddenFor.filter((p) => !others.includes(p));
    unreadSets.push('hiddenFor = :hf');
    unreadVals[':hf'] = keepFor;
  }
  await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET ' + unreadSets.join(', '),
    ExpressionAttributeNames: Object.keys(unreadNames).length ? unreadNames : undefined,
    ExpressionAttributeValues: unreadVals,
  }));
  return item;
}

async function markChatRoomRead(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (room.participants.length && !room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  if (room.participants.length === 0) {
    await doc.send(new UpdateCommand({
      TableName: T.chatRooms, Key: { roomId },
      UpdateExpression: 'SET lastReadAt.#u = :now',
      ExpressionAttributeNames: { '#u': uid },
      ExpressionAttributeValues: { ':now': Date.now() },
    }));
  } else {
    await doc.send(new UpdateCommand({
      TableName: T.chatRooms, Key: { roomId },
      UpdateExpression: 'SET unreadCount.#u = :z',
      ExpressionAttributeNames: { '#u': uid },
      ExpressionAttributeValues: { ':z': 0 },
    }));
  }
  return true;
}

async function hideChatRoomForMe(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (!room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET hiddenFor = list_append(if_not_exists(hiddenFor, :empty), :u)',
    ConditionExpression: 'not contains(hiddenFor, :uid) OR attribute_not_exists(hiddenFor)',
    ExpressionAttributeValues: { ':empty': [], ':u': [uid], ':uid': uid },
  })).catch((e) => { if (e.name !== 'ConditionalCheckFailedException') throw e; });
  return true;
}

async function unhideChatRoomForMe(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (!room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  const keepFor = (room.hiddenFor || []).filter((p) => p !== uid);
  await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET hiddenFor = :hf',
    ExpressionAttributeValues: { ':hf': keepFor },
  }));
  return true;
}

async function clearChatHistory(identity, roomId, forAll) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (!room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  const now = Date.now();
  if (forAll) {
    if (room.type !== 'dm') throw new GraphqlError('Can only clear for all in direct messages', 'BadRequest');
    const clearedAt = { ...(room.clearedAt || {}) };
    room.participants.forEach((p) => { clearedAt[p] = now; });
    await doc.send(new UpdateCommand({
      TableName: T.chatRooms, Key: { roomId },
      UpdateExpression: 'SET clearedAt = :c, lastMessage = :lm, lastSenderId = :ls, updatedAt = :u',
      ExpressionAttributeValues: { ':c': clearedAt, ':lm': null, ':ls': null, ':u': now },
    }));
  } else {
    await doc.send(new UpdateCommand({
      TableName: T.chatRooms, Key: { roomId },
      UpdateExpression: 'SET clearedAt.#u = :now',
      ExpressionAttributeNames: { '#u': uid },
      ExpressionAttributeValues: { ':now': now },
    }));
  }
  return true;
}

async function leaveChatRoom(identity, roomId) {
  const uid = requireSignedIn(identity);
  const room = await getChatRoom(roomId);
  if (!room) throw new GraphqlError('Chat room not found', 'NotFound');
  if (!room.participants.includes(uid)) throw new GraphqlError('Forbidden', 'Forbidden');
  if (room.type === 'dm') throw new GraphqlError('Use hideChatRoomForMe for direct messages', 'BadRequest');
  const remaining = room.participants.filter((p) => p !== uid);
  await doc.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: T.chatRooms, Key: { roomId },
          UpdateExpression: 'SET participants = :p, updatedAt = :u',
          ExpressionAttributeValues: { ':p': remaining, ':u': Date.now() },
        },
      },
      { Delete: { TableName: T.userChatRooms, Key: { uid, roomId } } },
    ],
  }));
  return true;
}

async function editChatMessage(identity, roomId, createdAt, text) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.messages, Key: { roomId, createdAt } }));
  if (!existing.Item) throw new GraphqlError('Message not found', 'NotFound');
  if (existing.Item.senderId !== uid && !isAdmin(identity)) throw new GraphqlError('Forbidden', 'Forbidden');
  const now = Date.now();
  const r = await doc.send(new UpdateCommand({
    TableName: T.messages, Key: { roomId, createdAt },
    UpdateExpression: 'SET #t = :t, editedAt = :e, updatedAt = :u',
    ExpressionAttributeNames: { '#t': 'text' },
    ExpressionAttributeValues: { ':t': text, ':e': now, ':u': now },
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

async function hideChatMessageForMe(identity, roomId, createdAt) {
  const uid = requireSignedIn(identity);
  await doc.send(new UpdateCommand({
    TableName: T.messages, Key: { roomId, createdAt },
    UpdateExpression: 'SET hiddenFor = list_append(if_not_exists(hiddenFor, :empty), :u), updatedAt = :now',
    ExpressionAttributeValues: { ':empty': [], ':u': [uid], ':now': Date.now() },
  }));
  return true;
}

async function deleteChatMessage(identity, roomId, createdAt) {
  const uid = requireSignedIn(identity);
  const existing = await doc.send(new GetCommand({ TableName: T.messages, Key: { roomId, createdAt } }));
  if (!existing.Item) return true;
  if (existing.Item.senderId !== uid && !isAdmin(identity)) throw new GraphqlError('Forbidden', 'Forbidden');
  await doc.send(new DeleteCommand({ TableName: T.messages, Key: { roomId, createdAt } }));

  const r = await doc.send(new QueryCommand({
    TableName: T.messages, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
    ScanIndexForward: false, Limit: 1,
  }));
  const survivor = (r.Items || [])[0] || null;
  await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET lastMessage = :lm, lastSenderId = :ls, updatedAt = :u',
    ExpressionAttributeValues: {
      ':lm': survivor ? (survivor.text || (survivor.imageURL ? 'Photo' : '')) : null,
      ':ls': survivor ? (survivor.senderId || null) : null,
      ':u': Date.now(),
    },
  })).catch(() => {});
  return true;
}

async function wipeChatMessages(identity, roomId) {
  requireSignedIn(identity);
  if (!isAdmin(identity)) throw new GraphqlError('Admin only', 'Forbidden');
  let total = 0;
  const r = await doc.send(new QueryCommand({
    TableName: T.messages, KeyConditionExpression: 'roomId = :r', ExpressionAttributeValues: { ':r': roomId },
  }));
  for (const item of r.Items || []) {
    await doc.send(new DeleteCommand({ TableName: T.messages, Key: { roomId, createdAt: item.createdAt } }));
    total += 1;
  }
  await doc.send(new UpdateCommand({
    TableName: T.chatRooms, Key: { roomId },
    UpdateExpression: 'SET lastMessage = :lm, lastSenderId = :ls, updatedAt = :u',
    ExpressionAttributeValues: { ':lm': null, ':ls': null, ':u': Date.now() },
  })).catch(() => {});
  return total;
}

module.exports = {
  getChatRoom, listMyChatRooms, createChatRoom, updateChatRoom,
  listChatMessages, sendChatMessage, editChatMessage, hideChatMessageForMe, deleteChatMessage,
  markChatRoomRead, hideChatRoomForMe, unhideChatRoomForMe, clearChatHistory, leaveChatRoom,
  wipeChatMessages,
};
