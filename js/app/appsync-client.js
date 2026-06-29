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

    function authHeader() {
        var token = window.papianoAuth && window.papianoAuth.getIdToken();
        if (!token) throw new Error('Not signed in.');
        return { Authorization: token, host: API_HOST };
    }

    async function gql(query, variables) {
        var res = await fetch(GRAPHQL_HTTP, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader().Authorization },
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
        wsConnectPromise = new Promise(function (resolve, reject) {
            var header = authHeader();
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
        return wsConnectPromise;
    }

    // Returns an unsubscribe function. onData(data) fires per event;
    // onError(payload) fires on subscription-level errors;
    // onClose() fires if the underlying socket drops (caller should
    // re-subscribe — there is no automatic reconnect here by design).
    async function subscribe(query, variables, onData, onError, onClose) {
        var sock = await openSocket();
        var id = genId();
        var header = authHeader();
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
