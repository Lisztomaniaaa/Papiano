// === Papiano — Cognito Auth (replaces firebase-auth-compat.js) ===
// Native fetch() against the Cognito Identity Provider REST API + the
// Hosted UI OAuth2/PKCE redirect flow for Google federation — no AWS SDK,
// no third-party auth library. Mirrors the subset of the firebase.auth()
// API surface that app.js / auth-email.js actually call, so the rest of
// the app can be migrated with small, targeted edits.
//
// Session lifecycle guarantees:
//  - Persisted tokens are ALWAYS restored on load, even when a stale
//    ?code= redirect param fails to exchange (reload/back-button cases).
//  - Tokens are refreshed proactively (timer + tab-visibility + before
//    every API call via getFreshIdToken), so a session never silently
//    dies at the 60-minute ID-token expiry while the app is open.
//  - Refresh is dual-path: the native InitiateAuth REFRESH_TOKEN_AUTH
//    first, falling back to the Hosted UI /oauth2/token endpoint (the
//    canonical path for Google-federated refresh tokens).
//  - signOut() only revokes THIS session's refresh token (RevokeToken),
//    never GlobalSignOut — logging out on one device must not force a
//    re-login on every other device.
//
// Exposed as window.papianoAuth.

(function () {
    var REGION = 'ap-southeast-1';
    var CLIENT_ID = '6np9l79eo6om3dtm3f1kgghajn';
    var COGNITO_DOMAIN = 'papiano-auth.auth.ap-southeast-1.amazoncognito.com';
    var IDP_ENDPOINT = 'https://cognito-idp.' + REGION + '.amazonaws.com/';
    var TOKEN_ENDPOINT = 'https://' + COGNITO_DOMAIN + '/oauth2/token';
    // Only paths registered as Cognito Callback/Logout URLs may be used in
    // OAuth redirects. '/', and '/admin.html' are registered; anything else
    // (piano pages) must bounce through the root.
    var OAUTH_PATH = (location.pathname === '/' || location.pathname === '/admin.html') ? location.pathname : '/';
    var REDIRECT_URI = location.origin + OAUTH_PATH;

    var TOK_ID = 'papiano_id_token';
    var TOK_ACCESS = 'papiano_access_token';
    var TOK_REFRESH = 'papiano_refresh_token';
    var PKCE_KEY = 'papiano_pkce_verifier';

    // Refresh when less than this much ID-token lifetime remains.
    var REFRESH_SKEW_MS = 5 * 60 * 1000;
    var MAINTAIN_INTERVAL_MS = 60 * 1000;

    var currentUser = null;
    var idToken = null, accessToken = null, refreshToken = null;
    var listeners = [];
    var resolved = false;
    var refreshInFlight = null;

    function b64url(buf) {
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async function makePkcePair() {
        var verifierBytes = new Uint8Array(32);
        crypto.getRandomValues(verifierBytes);
        var verifier = b64url(verifierBytes);
        var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        return { verifier: verifier, challenge: b64url(digest) };
    }

    function decodeJwt(token) {
        var payload = token.split('.')[1];
        return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
    }

    function userFromIdToken(token) {
        var c = decodeJwt(token);
        var isFederated = !!c.identities;
        return {
            uid: c.sub,
            email: c.email || '',
            displayName: c.name || c.given_name || (c.email ? c.email.split('@')[0] : 'Papiano User'),
            photoURL: c.picture || '',
            emailVerified: c.email_verified === true || c.email_verified === 'true',
            providerData: [{ providerId: isFederated ? 'google.com' : 'password' }],
        };
    }

    function idTokenExpiryMs() {
        if (!idToken) return 0;
        try { return decodeJwt(idToken).exp * 1000; } catch (_e) { return 0; }
    }

    function persistTokens() {
        try {
            if (idToken) localStorage.setItem(TOK_ID, idToken); else localStorage.removeItem(TOK_ID);
            if (accessToken) localStorage.setItem(TOK_ACCESS, accessToken); else localStorage.removeItem(TOK_ACCESS);
            if (refreshToken) localStorage.setItem(TOK_REFRESH, refreshToken); else localStorage.removeItem(TOK_REFRESH);
        } catch (_e) {}
    }

    function loadPersistedTokens() {
        try {
            idToken = localStorage.getItem(TOK_ID) || null;
            accessToken = localStorage.getItem(TOK_ACCESS) || null;
            refreshToken = localStorage.getItem(TOK_REFRESH) || null;
        } catch (_e) {}
    }

    function clearTokens() {
        idToken = accessToken = refreshToken = null;
        persistTokens();
    }

    function notify() {
        listeners.forEach(function (cb) { try { cb(currentUser); } catch (_e) {} });
    }

    async function cognitoRequest(action, body, opts) {
        var res = await fetch(IDP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + action,
            },
            body: JSON.stringify(body),
            keepalive: !!(opts && opts.keepalive),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var err = new Error(data.message || (action + ' failed'));
            err.code = data.__type || '';
            throw err;
        }
        return data;
    }

    // A structured rejection carries a .code (Cognito API error type or
    // OAuth error string); a plain network failure (fetch() rejected) does
    // not. Only structured rejections mean the session is genuinely over.
    function isAuthRejection(e) {
        return !!(e && e.code !== undefined);
    }

    async function setSession(authResult) {
        idToken = authResult.IdToken;
        accessToken = authResult.AccessToken;
        if (authResult.RefreshToken) refreshToken = authResult.RefreshToken;
        persistTokens();
        var wasSignedOut = !currentUser;
        currentUser = userFromIdToken(idToken);
        // Token rotation for the same user must not re-run the app's
        // sign-in bootstrap — only notify when the signed-in state flips.
        if (wasSignedOut) notify();
        return currentUser;
    }

    async function doRefresh() {
        // Path 1: native API. Confirmed working for USER_PASSWORD_AUTH
        // sessions; usually also accepts Hosted-UI-issued refresh tokens.
        var structuredErr = null;
        try {
            var data = await cognitoRequest('InitiateAuth', {
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                ClientId: CLIENT_ID,
                AuthParameters: { REFRESH_TOKEN: refreshToken },
            });
            await setSession({ IdToken: data.AuthenticationResult.IdToken, AccessToken: data.AuthenticationResult.AccessToken });
            return;
        } catch (e) {
            if (!isAuthRejection(e)) throw e; // network failure — caller decides
            structuredErr = e;
        }
        // Path 2: Hosted UI token endpoint — the canonical refresh route for
        // Google-federated sessions, in case the native API rejected a
        // Hosted-UI refresh token that is actually still valid.
        var body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            refresh_token: refreshToken,
        });
        var res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        var data2 = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var err = new Error(data2.error_description || data2.error || structuredErr.message);
            err.code = data2.error || structuredErr.code || 'RefreshFailed';
            throw err;
        }
        await setSession({ IdToken: data2.id_token, AccessToken: data2.access_token, RefreshToken: data2.refresh_token });
    }

    // Single-flight: concurrent callers share one refresh round-trip.
    function refreshSession() {
        if (!refreshInFlight) {
            refreshInFlight = doRefresh().finally(function () { refreshInFlight = null; });
        }
        return refreshInFlight;
    }

    function endSession() {
        clearTokens();
        var wasSignedIn = !!currentUser;
        currentUser = null;
        if (wasSignedIn) notify();
    }

    // Returns an ID token guaranteed fresh enough for an API call,
    // refreshing first when little lifetime remains. Never throws:
    // returns null when there is no usable session.
    async function getFreshIdToken(forceRefresh) {
        if (!idToken && !refreshToken) return null;
        var msLeft = idTokenExpiryMs() - Date.now();
        if (!forceRefresh && msLeft > REFRESH_SKEW_MS) return idToken;
        if (!refreshToken) return msLeft > 0 ? idToken : null;
        try {
            await refreshSession();
        } catch (e) {
            if (isAuthRejection(e)) { endSession(); return null; }
            // Network blip: hand back the current token if it still has any
            // life in it; the maintenance loop retries the refresh later.
            return idTokenExpiryMs() > Date.now() ? idToken : null;
        }
        return idToken;
    }

    async function handleRedirectCallback() {
        var params = new URLSearchParams(location.search);
        var code = params.get('code');
        var err = params.get('error');
        if (err) {
            history.replaceState({}, '', location.pathname);
            return { error: err, description: params.get('error_description') || '' };
        }
        if (!code) return null;
        var verifier = sessionStorage.getItem(PKCE_KEY) || '';
        history.replaceState({}, '', location.pathname);
        var body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });
        var res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error_description || data.error || 'Google sign-in failed.');
        try { sessionStorage.removeItem(PKCE_KEY); } catch (_e) {}
        await setSession({ IdToken: data.id_token, AccessToken: data.access_token, RefreshToken: data.refresh_token });
        return { ok: true };
    }

    async function restorePersistedSession() {
        if (!idToken) return;
        var claims = null;
        try { claims = decodeJwt(idToken); } catch (_e) {}
        if (claims && claims.exp * 1000 > Date.now() + 30000) {
            currentUser = userFromIdToken(idToken);
            return;
        }
        if (!refreshToken) {
            clearTokens();
            return;
        }
        try {
            await refreshSession();
        } catch (e) {
            if (isAuthRejection(e)) {
                // Cognito itself rejected the refresh token — session over.
                clearTokens(); currentUser = null;
            } else {
                // Network-level failure — common right after a phone wakes
                // from sleep, where the first request fires before the
                // network is ready. One short retry, then keep the tokens:
                // the maintenance loop below heals the session as soon as
                // connectivity returns, without forcing a fresh login.
                await new Promise(function (r) { setTimeout(r, 1200); });
                try {
                    await refreshSession();
                } catch (e2) {
                    if (isAuthRejection(e2)) { clearTokens(); currentUser = null; }
                }
            }
        }
    }

    async function init() {
        // Restore FIRST: a failed ?code= exchange (stale code from a reload
        // or back-button) must never wipe out a valid stored session.
        loadPersistedTokens();

        var redirectError = null;
        try {
            var redirectResult = await handleRedirectCallback();
            if (redirectResult && redirectResult.ok) {
                resolved = true;
                notify();
                return;
            }
            if (redirectResult && redirectResult.error) {
                redirectError = { error: redirectResult.error, description: redirectResult.description };
            }
        } catch (e) {
            redirectError = { description: e.message };
        }

        await restorePersistedSession();
        resolved = true;
        notify();
        // Only surface the redirect error when it actually left the user
        // signed out — e.g. don't flash "sign-in failed" over a session
        // that was safely restored from storage.
        if (redirectError && !currentUser) {
            window.dispatchEvent(new CustomEvent('papiano-auth-error', { detail: redirectError }));
        }
    }

    // ---- Session maintenance -------------------------------------------
    // Keeps the ID token fresh while the app is open, and heals sessions
    // interrupted by connectivity loss (phone sleep, tab suspend).
    async function maintainSession() {
        if (!refreshToken || document.hidden) return;
        var msLeft = idTokenExpiryMs() - Date.now();
        if (msLeft > REFRESH_SKEW_MS && currentUser) return;
        try {
            await refreshSession();
        } catch (e) {
            if (isAuthRejection(e)) endSession();
            // else: transient network issue — next tick retries.
        }
    }
    setInterval(maintainSession, MAINTAIN_INTERVAL_MS);
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) maintainSession();
    });

    // ---- Cross-tab sync -------------------------------------------------
    // Piano pages, the main app, and admin share one localStorage session.
    // When another tab signs in/out or rotates tokens, adopt its state.
    window.addEventListener('storage', function (e) {
        if (e.key !== null && e.key !== TOK_ID && e.key !== TOK_ACCESS && e.key !== TOK_REFRESH) return;
        var prevUid = currentUser ? currentUser.uid : null;
        loadPersistedTokens();
        if (!idToken) {
            if (prevUid) { currentUser = null; notify(); }
            return;
        }
        try {
            var next = userFromIdToken(idToken);
            currentUser = next;
            if (next.uid !== prevUid) notify();
        } catch (_e) {}
    });

    function onAuthStateChanged(cb) {
        listeners.push(cb);
        if (resolved) cb(currentUser);
        return function () {
            var i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    // Fire-and-forget revocation of THIS session's refresh token (and the
    // access/ID tokens minted from it). Deliberately not GlobalSignOut:
    // logging out here must not kill the user's sessions on other devices.
    function revokeSessionToken(token) {
        if (!token) return;
        try {
            cognitoRequest('RevokeToken', { Token: token, ClientId: CLIENT_ID }, { keepalive: true }).catch(function () {});
        } catch (_e) {}
    }

    // Local-only sign-out: clears this page's session without navigating.
    // For programmatic paths (ban watcher, deleted-account gate, delete
    // fallback) that manage their own UI/navigation afterwards.
    function signOutLocal() {
        var rt = refreshToken;
        endSession();
        revokeSessionToken(rt);
    }

    // User-initiated sign-out: also clears the Hosted UI's SSO session
    // cookie on the amazoncognito.com domain via a real top-level
    // navigation to /logout. That cookie is SameSite=Lax — a background
    // fetch() can never carry or clear it — and leaving it behind makes
    // the next Google sign-in silently reuse the old Cognito session.
    // The revocation request uses keepalive so it survives the unload.
    async function signOut() {
        var rt = refreshToken;
        endSession();
        revokeSessionToken(rt);
        // logout_uri must exactly match a registered Logout URL.
        location.href = 'https://' + COGNITO_DOMAIN + '/logout?client_id=' + CLIENT_ID
            + '&logout_uri=' + encodeURIComponent(REDIRECT_URI);
    }

    async function signInWithEmailAndPassword(email, password) {
        var data = await cognitoRequest('InitiateAuth', {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: password },
        });
        if (data.ChallengeName) {
            var e = new Error('Additional verification is required for this account.');
            e.code = data.ChallengeName;
            throw e;
        }
        var user = await setSession(data.AuthenticationResult);
        return { user: user };
    }

    async function signUpWithEmailAndPassword(email, password, displayName) {
        await cognitoRequest('SignUp', {
            ClientId: CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'name', Value: displayName },
            ],
        });
    }

    async function confirmSignUp(email, code) {
        await cognitoRequest('ConfirmSignUp', { ClientId: CLIENT_ID, Username: email, ConfirmationCode: code });
    }

    async function resendConfirmationCode(email) {
        await cognitoRequest('ResendConfirmationCode', { ClientId: CLIENT_ID, Username: email });
    }

    async function forgotPassword(email) {
        await cognitoRequest('ForgotPassword', { ClientId: CLIENT_ID, Username: email });
    }

    async function confirmForgotPassword(email, code, newPassword) {
        await cognitoRequest('ConfirmForgotPassword', {
            ClientId: CLIENT_ID, Username: email, ConfirmationCode: code, Password: newPassword,
        });
    }

    async function deleteCurrentUser() {
        if (!accessToken) throw new Error('Not signed in.');
        await cognitoRequest('DeleteUser', { AccessToken: accessToken });
        clearTokens();
        currentUser = null;
        notify();
    }

    // Re-runs the password sign-in to obtain a fresh access token before a
    // sensitive operation (account deletion) — Cognito's equivalent of
    // Firebase's reauthenticateWithCredential.
    async function reauthenticateWithPassword(email, password) {
        await signInWithEmailAndPassword(email, password);
    }

    async function signInWithGoogleRedirect() {
        var pair = await makePkcePair();
        sessionStorage.setItem(PKCE_KEY, pair.verifier);
        var params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: 'code',
            scope: 'openid email profile',
            redirect_uri: REDIRECT_URI,
            code_challenge: pair.challenge,
            code_challenge_method: 'S256',
            identity_provider: 'Google',
            // NOTE: do not bother with prompt=select_account here — verified
            // empirically that Cognito does NOT forward it to Google (the
            // authorize redirect to accounts.google.com carries no prompt
            // param). Google shows its account chooser on its own whenever
            // the browser holds more than one Google session; with a single
            // session it signs in silently, which is standard SSO behavior.
        });
        location.href = 'https://' + COGNITO_DOMAIN + '/oauth2/authorize?' + params.toString();
    }

    var papianoAuth = {
        get currentUser() { return currentUser; },
        onAuthStateChanged: onAuthStateChanged,
        signOut: signOut,
        signOutLocal: signOutLocal,
        signInWithEmailAndPassword: signInWithEmailAndPassword,
        signUpWithEmailAndPassword: signUpWithEmailAndPassword,
        confirmSignUp: confirmSignUp,
        resendConfirmationCode: resendConfirmationCode,
        forgotPassword: forgotPassword,
        confirmForgotPassword: confirmForgotPassword,
        deleteCurrentUser: deleteCurrentUser,
        reauthenticateWithPassword: reauthenticateWithPassword,
        signInWithGoogleRedirect: signInWithGoogleRedirect,
        getIdToken: function () { return idToken; },
        getAccessToken: function () { return accessToken; },
        getFreshIdToken: getFreshIdToken,
    };
    window.papianoAuth = papianoAuth;

    init().then(function () {
        window.__papianoAuthReady = true;
        window.dispatchEvent(new Event('papiano-auth-ready'));
    });
})();
