const { doc, T, GetCommand, PutCommand, UpdateCommand, QueryCommand, TransactWriteCommand } = require('../dynamo');
const { requireSignedIn, isAdmin, GraphqlError } = require('../auth');

function searchNameOf(name) {
  return String(name).trim().toLowerCase();
}

async function getProfile(uid) {
  const r = await doc.send(new GetCommand({ TableName: T.profiles, Key: { uid } }));
  return r.Item || null;
}

async function getProfileByPublicId(publicId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.profiles, IndexName: 'PublicIdIndex',
    KeyConditionExpression: 'publicId = :p',
    ExpressionAttributeValues: { ':p': publicId },
    Limit: 1,
  }));
  return (r.Items && r.Items[0]) || null;
}

async function getProfileByUserId(userId) {
  const r = await doc.send(new QueryCommand({
    TableName: T.profiles, IndexName: 'UserIdIndex',
    KeyConditionExpression: 'userId = :u',
    ExpressionAttributeValues: { ':u': userId },
    Limit: 1,
  }));
  return (r.Items && r.Items[0]) || null;
}

async function searchProfilesByName(prefix) {
  const searchName = searchNameOf(prefix);
  if (!searchName) return [];
  const shard = searchName[0];
  const r = await doc.send(new QueryCommand({
    TableName: T.profiles, IndexName: 'SearchNameIndex',
    KeyConditionExpression: 'searchNameShard = :s AND begins_with(searchName, :p)',
    ExpressionAttributeValues: { ':s': shard, ':p': searchName },
    Limit: 25,
  }));
  return r.Items || [];
}

async function getLeaderboard(windowSeconds) {
  const r = await doc.send(new QueryCommand({
    TableName: T.profiles, IndexName: 'LeaderboardIndex',
    KeyConditionExpression: 'leaderboardShard = :a',
    ExpressionAttributeValues: { ':a': 'ALL' },
    ScanIndexForward: false,
    Limit: 50,
  }));
  let items = r.Items || [];
  if (windowSeconds) {
    const cutoff = Date.now() - windowSeconds * 1000;
    items = items.filter((p) => (p.playTimeLeaderboardUpdatedAt || 0) >= cutoff);
  }
  return items.slice(0, 10).map((p) => ({
    uid: p.uid, name: p.name, photoURL: p.photoURL, playTimeSeconds: p.playTimeSeconds || 0,
  }));
}

async function nextCounter(id) {
  const r = await doc.send(new UpdateCommand({
    TableName: T.counters, Key: { id },
    UpdateExpression: 'ADD #n :incr',
    ExpressionAttributeNames: { '#n': 'next' },
    ExpressionAttributeValues: { ':incr': 1 },
    ReturnValues: 'UPDATED_NEW',
  }));
  return r.Attributes.next;
}

async function createProfile(identity, input) {
  const uid = requireSignedIn(identity);
  const existing = await getProfile(uid);
  if (existing) throw new GraphqlError('Profile already exists', 'Conflict');

  const name = String(input.name || '').slice(0, 60);
  if (!name) throw new GraphqlError('name is required', 'BadRequest');
  const searchName = searchNameOf(name);
  const nameKey = searchName;

  await doc.send(new PutCommand({
    TableName: T.displayNames,
    Item: { nameKey, uid, updatedAt: Date.now() },
    ConditionExpression: 'attribute_not_exists(nameKey) OR uid = :uid',
    ExpressionAttributeValues: { ':uid': uid },
  })).catch((e) => {
    if (e.name === 'ConditionalCheckFailedException') throw new GraphqlError('Name already taken', 'Conflict');
    throw e;
  });

  const publicId = await nextCounter('publicUserId');
  const now = Date.now();
  const item = {
    uid, name, searchName,
    searchNameShard: searchName[0] || '#',
    desc: input.desc || '', photoURL: input.photoURL || '', countryCode: input.countryCode || '',
    role: 'user', publicId, userId: `#${publicId}`,
    playTimeSeconds: 0, playTime: '0', playTimeLeaderboardUpdatedAt: now,
    leaderboardShard: 'ALL',
    likes: 0, dislikes: 0, deleted: false,
    createdAt: now, updatedAt: now,
  };
  await doc.send(new PutCommand({ TableName: T.profiles, Item: item }));
  return item;
}

async function updateProfile(identity, uid, input) {
  const me = requireSignedIn(identity);
  const admin = isAdmin(identity);
  if (me !== uid && !admin) throw new GraphqlError('Forbidden', 'Forbidden');
  const existing = await getProfile(uid);
  if (!existing) throw new GraphqlError('Profile not found', 'NotFound');

  const now = Date.now();
  const sets = ['updatedAt = :u'];
  const vals = { ':u': now };
  const names = {};

  if (input.name !== undefined && input.name !== existing.name) {
    const name = String(input.name).slice(0, 60);
    const searchName = searchNameOf(name);
    await doc.send(new PutCommand({
      TableName: T.displayNames, Item: { nameKey: searchName, uid, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(nameKey) OR uid = :uid',
      ExpressionAttributeValues: { ':uid': uid },
    })).catch((e) => {
      if (e.name === 'ConditionalCheckFailedException') throw new GraphqlError('Name already taken', 'Conflict');
      throw e;
    });
    sets.push('#n = :name', 'searchName = :sn', 'searchNameShard = :ss');
    names['#n'] = 'name';
    vals[':name'] = name; vals[':sn'] = searchName; vals[':ss'] = searchName[0] || '#';
  }
  if (input.desc !== undefined) { sets.push('#d = :desc'); names['#d'] = 'desc'; vals[':desc'] = input.desc; }
  if (input.photoURL !== undefined) { sets.push('photoURL = :p'); vals[':p'] = input.photoURL; }
  if (input.countryCode !== undefined) { sets.push('countryCode = :cc'); vals[':cc'] = input.countryCode; }
  if (input.playTimeSeconds !== undefined) {
    sets.push('playTimeSeconds = :pts', 'playTimeLeaderboardUpdatedAt = :ptu', 'leaderboardShard = :lbs');
    vals[':pts'] = input.playTimeSeconds; vals[':ptu'] = now; vals[':lbs'] = 'ALL';
  }
  if (input.playTime !== undefined) { sets.push('playTime = :pt'); vals[':pt'] = input.playTime; }
  if (input.deleted !== undefined) { sets.push('deleted = :del'); vals[':del'] = input.deleted; }

  const r = await doc.send(new UpdateCommand({
    TableName: T.profiles, Key: { uid },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: vals,
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

async function incrementPlayTimeSeconds(identity, deltaSeconds) {
  const uid = requireSignedIn(identity);
  const delta = Math.max(0, Math.floor(Number(deltaSeconds) || 0));
  if (!delta) {
    const profile = await getProfile(uid);
    if (!profile) throw new GraphqlError('Profile not found', 'NotFound');
    return profile;
  }
  const now = Date.now();
  const r = await doc.send(new UpdateCommand({
    TableName: T.profiles, Key: { uid },
    UpdateExpression: 'ADD playTimeSeconds :d SET playTimeLeaderboardUpdatedAt = :now, leaderboardShard = :lbs, updatedAt = :now',
    ConditionExpression: 'attribute_exists(uid)',
    ExpressionAttributeValues: { ':d': delta, ':now': now, ':lbs': 'ALL' },
    ReturnValues: 'ALL_NEW',
  }));
  return r.Attributes;
}

async function myProfileReaction(identity, profileUid) {
  const uid = requireSignedIn(identity);
  const r = await doc.send(new GetCommand({ TableName: T.profileReactions, Key: { profileUid, voterUid: uid } }));
  return r.Item ? r.Item.type : null;
}

async function voteProfile(identity, profileUid, type) {
  const voterUid = requireSignedIn(identity);
  if (!['like', 'dislike', 'none'].includes(type)) throw new GraphqlError('type must be like|dislike|none', 'BadRequest');

  const existing = await doc.send(new GetCommand({ TableName: T.profileReactions, Key: { profileUid, voterUid } }));
  const prev = existing.Item ? existing.Item.type : null;
  if (prev === type) {
    const profile = await getProfile(profileUid);
    if (!profile) throw new GraphqlError('Profile not found', 'NotFound');
    return profile;
  }

  const now = Date.now();
  const deltas = { likes: 0, dislikes: 0 };
  if (prev === 'like') deltas.likes -= 1;
  if (prev === 'dislike') deltas.dislikes -= 1;
  if (type === 'like') deltas.likes += 1;
  if (type === 'dislike') deltas.dislikes += 1;

  const transactItems = [];
  if (type === 'none') {
    transactItems.push({
      Delete: { TableName: T.profileReactions, Key: { profileUid, voterUid } },
    });
  } else {
    transactItems.push({
      Put: { TableName: T.profileReactions, Item: { profileUid, voterUid, type, updatedAt: now } },
    });
  }
  const updateExpr = [];
  const vals = {};
  if (deltas.likes !== 0) { updateExpr.push('likes :l'); vals[':l'] = deltas.likes; }
  if (deltas.dislikes !== 0) { updateExpr.push('dislikes :d'); vals[':d'] = deltas.dislikes; }
  if (updateExpr.length) {
    transactItems.push({
      Update: {
        TableName: T.profiles, Key: { uid: profileUid },
        UpdateExpression: 'ADD ' + updateExpr.join(', '),
        ConditionExpression: 'attribute_exists(uid)',
        ExpressionAttributeValues: vals,
      },
    });
  }
  await doc.send(new TransactWriteCommand({ TransactItems: transactItems }));
  return getProfile(profileUid);
}

module.exports = {
  getProfile, getProfileByPublicId, getProfileByUserId, searchProfilesByName, getLeaderboard,
  createProfile, updateProfile, incrementPlayTimeSeconds, myProfileReaction, voteProfile,
};
