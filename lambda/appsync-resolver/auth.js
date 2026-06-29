const ADMIN_EMAILS = new Set([
  'papianobase@gmail.com',
  'utamairfan44@gmail.com',
  'akunpolos0444000@gmail.com',
]);

class GraphqlError extends Error {
  constructor(message, type = 'Unauthorized') {
    super(message);
    this.type = type;
  }
}

function uidOf(identity) {
  if (!identity || !identity.sub) throw new GraphqlError('Not signed in', 'Unauthenticated');
  return identity.sub;
}

function isAdmin(identity) {
  if (!identity) return false;
  const claims = identity.claims || {};
  const email = claims.email;
  if (email && ADMIN_EMAILS.has(email)) return true;
  const groups = claims['cognito:groups'] || [];
  return Array.isArray(groups) && groups.includes('admin');
}

function owns(identity, uid) {
  return identity && identity.sub === uid;
}

function requireSignedIn(identity) {
  return uidOf(identity);
}

function requireOwnerOrAdmin(identity, uid) {
  const me = requireSignedIn(identity);
  if (me !== uid && !isAdmin(identity)) {
    throw new GraphqlError('Forbidden', 'Forbidden');
  }
  return me;
}

module.exports = { ADMIN_EMAILS, GraphqlError, uidOf, isAdmin, owns, requireSignedIn, requireOwnerOrAdmin };
