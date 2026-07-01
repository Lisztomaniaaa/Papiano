// === Papiano — AppSync GraphQL client (replaces Firestore/RTDB SDKs) ===
// Native fetch() for queries/mutations + AppSync's raw realtime WebSocket
// protocol for subscriptions — no Amplify, no AWS SDK. Exposed as
// window.papianoData. Auth is the Cognito ID token from window.papianoAuth.

(function () {
    var GRAPHQL_HTTP = 'https://6cljvnfz55cmbodlh5527n2oty.appsync-api.ap-southeast-1.amazonaws.com/graphql';
    var REALTIME_WS = 'wss://6cljvnfz55cmbodlh5527n2oty.appsync-realtime-api.ap-southeast-1.amazonaws.com/graphql';
    var API_HOST = '6cljvnfz55cmbodlh5527n2oty.appsync-api.ap-southeast-1.amazonaws.com';

    function b64(obj) {
        return btoa(JSON.stringify(obj));
    }

    // Always hand AppSync a token with real lifetime left — papianoAuth
    // refreshes it first when it's close to (or past) expiry.
    async function authHeader(forceRefresh) {
        var token = window.papianoAuth && await window.papianoAuth.getFreshIdToken(forceRefresh);
        if (!token) throw new Error('Not signed in.');
        return { Authorization: token, host: API_HOST };
    }

    function isTokenRejection(errorType, message) {
        var t = String(errorType || '') + ' ' + String(message || '');
        return /unauthorized|token has expired|not authorized|invalid.*token/i.test(t);
    }

    async function gqlOnce(query, variables, forceRefresh) {
        var header = await authHeader(forceRefresh);
        var res = await fetch(GRAPHQL_HTTP, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: header.Authorization },
            body: JSON.stringify({ query: query, variables: variables || {} }),
        });
        var body = await res.json().catch(function () { return {}; });
        if (body.errors && body.errors.length) {
            var e = new Error(body.errors[0].message || 'GraphQL error');
            e.errorType = body.errors[0].errorType || (body.errors[0].extensions && body.errors[0].extensions.code) || '';
            throw e;
        }
        return body.data;
    }

    async function gql(query, variables) {
        try {
            return await gqlOnce(query, variables, false);
        } catch (e) {
            // Clock skew / a token that expired mid-flight: force one refresh
            // and retry once, so a momentarily stale token never surfaces as
            // a fake "logged out" failure to the UI.
            if (isTokenRejection(e.errorType, e.message)) {
                return await gqlOnce(query, variables, true);
            }
            throw e;
        }
    }

    // ---- Realtime subscriptions (AppSync raw WebSocket protocol) ----
    var ws = null;
    var wsConnectPromise = null;
    var subs = {};

    function genId() {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
        return 'id_' + Math.random().toString(36).slice(2) + Date.now();
    }

    function openSocket() {
        if (wsConnectPromise) return wsConnectPromise;
        wsConnectPromise = (async function () {
            var header = await authHeader(false);
            return await new Promise(function (resolve, reject) {
            var url = REALTIME_WS
                + '?header=' + encodeURIComponent(b64(header))
                + '&payload=' + encodeURIComponent(b64({}));
            var sock = new WebSocket(url, 'graphql-ws');
            var settled = false;

            sock.onopen = function () {
                sock.send(JSON.stringify({ type: 'connection_init' }));
            };
            sock.onmessage = function (ev) {
                var msg;
                try { msg = JSON.parse(ev.data); } catch (_e) { return; }
                if (msg.type === 'connection_ack') {
                    if (!settled) { settled = true; ws = sock; resolve(sock); }
                } else if (msg.type === 'data') {
                    var sub = subs[msg.id];
                    if (sub && sub.onData) sub.onData(msg.payload && msg.payload.data);
                } else if (msg.type === 'error') {
                    var sub2 = subs[msg.id];
                    if (sub2 && sub2.onError) sub2.onError(msg.payload);
                    if (!settled) { settled = true; reject(new Error('Realtime connection failed')); }
                }
                // 'ka' (keep-alive) and 'start_ack' need no handling.
            };
            sock.onerror = function () {
                if (!settled) { settled = true; reject(new Error('Realtime socket error')); }
            };
            sock.onclose = function () {
                ws = null;
                wsConnectPromise = null;
                Object.keys(subs).forEach(function (id) {
                    var sub = subs[id];
                    if (sub && sub.onClose) sub.onClose();
                    delete subs[id];
                });
            };
            });
        })();
        wsConnectPromise.catch(function () { wsConnectPromise = null; });
        return wsConnectPromise;
    }

    // Returns an unsubscribe function. onData(data) fires per event;
    // onError(payload) fires on subscription-level errors;
    // onClose() fires if the underlying socket drops (caller should
    // re-subscribe — there is no automatic reconnect here by design).
    async function subscribe(query, variables, onData, onError, onClose) {
        var sock = await openSocket();
        var id = genId();
        var header = await authHeader(false);
        subs[id] = { onData: onData, onError: onError, onClose: onClose };
        sock.send(JSON.stringify({
            id: id,
            type: 'start',
            payload: {
                data: JSON.stringify({ query: query, variables: variables || {} }),
                extensions: { authorization: header },
            },
        }));
        return function unsubscribe() {
            delete subs[id];
            if (ws) {
                try { ws.send(JSON.stringify({ id: id, type: 'stop' })); } catch (_e) {}
            }
        };
    }

    window.papianoData = { gql: gql, subscribe: subscribe };
})();
