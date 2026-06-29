// === Papiano — Cognito Auth (replaces firebase-auth-compat.js) ===
// Native fetch() against the Cognito Identity Provider REST API + the
// Hosted UI OAuth2/PKCE redirect flow for Google federation — no AWS SDK,
// no third-party auth library. Mirrors the subset of the firebase.auth()
// API surface that app.js / auth-email.js actually call, so the rest of
// the app can be migrated with small, targeted edits.
//
// Exposed as window.papianoAuth.

(function () {
    var REGION = 'ap-southeast-1';
    var CLIENT_ID = '6np9l79eo6om3dtm3f1kgghajn';
    var COGNITO_DOMAIN = 'papiano-auth.auth.ap-southeast-1.amazoncognito.com';
    var IDP_ENDPOINT = 'https://cognito-idp.' + REGION + '.amazonaws.com/';
    var REDIRECT_URI = location.origin + location.pathname;

    var TOK_ID = 'papiano_id_token';
    var TOK_ACCESS = 'papiano_access_token';
    var TOK_REFRESH = 'papiano_refresh_token';
    var PKCE_KEY = 'papiano_pkce_verifier';

    var currentUser = null;
    var idToken = null, accessToken = null, refreshToken = null;
    var listeners = [];
    var resolved = false;

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

    async function cognitoRequest(action, body) {
        var res = await fetch(IDP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.1',
                'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + action,
            },
            body: JSON.stringify(body),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var err = new Error(data.message || (action + ' failed'));
            err.code = data.__type || '';
            throw err;
        }
        return data;
    }

    async function setSession(authResult) {
        idToken = authResult.IdToken;
        accessToken = authResult.AccessToken;
        if (authResult.RefreshToken) refreshToken = authResult.RefreshToken;
        persistTokens();
        currentUser = userFromIdToken(idToken);
        notify();
        return currentUser;
    }

    async function refreshSession() {
        var data = await cognitoRequest('InitiateAuth', {
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: { REFRESH_TOKEN: refreshToken },
        });
        await setSession({ IdToken: data.AuthenticationResult.IdToken, AccessToken: data.AuthenticationResult.AccessToken });
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
        var res = await fetch('https://' + COGNITO_DOMAIN + '/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error_description || data.error || 'Google sign-in failed.');
        await setSession({ IdToken: data.id_token, AccessToken: data.access_token, RefreshToken: data.refresh_token });
        return { ok: true };
    }

    async function init() {
        try {
            var redirectResult = await handleRedirectCallback();
            if (redirectResult && redirectResult.ok) { resolved = true; notify(); return; }
            if (redirectResult && redirectResult.error) {
                resolved = true; notify();
                window.dispatchEvent(new CustomEvent('papiano-auth-error', { detail: redirectResult }));
                return;
            }
        } catch (e) {
            resolved = true; notify();
            window.dispatchEvent(new CustomEvent('papiano-auth-error', { detail: { description: e.message } }));
            return;
        }

        loadPersistedTokens();
        if (idToken) {
            var claims;
            try { claims = decodeJwt(idToken); } catch (_e) { claims = null; }
            if (claims && claims.exp * 1000 > Date.now() + 30000) {
                currentUser = userFromIdToken(idToken);
            } else if (refreshToken) {
                try { await refreshSession(); } catch (_e) { clearTokens(); currentUser = null; }
            } else {
                clearTokens(); currentUser = null;
            }
        }
        resolved = true;
        notify();
    }

    function onAuthStateChanged(cb) {
        listeners.push(cb);
        if (resolved) cb(currentUser);
        return function () {
            var i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    async function signOut() {
        if (accessToken) {
            try { await cognitoRequest('GlobalSignOut', { AccessToken: accessToken }); } catch (_e) {}
        }
        clearTokens();
        currentUser = null;
        notify();
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
        });
        location.href = 'https://' + COGNITO_DOMAIN + '/oauth2/authorize?' + params.toString();
    }

    var papianoAuth = {
        get currentUser() { return currentUser; },
        onAuthStateChanged: onAuthStateChanged,
        signOut: signOut,
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
    };
    window.papianoAuth = papianoAuth;

    init().then(function () {
        window.__papianoAuthReady = true;
        window.dispatchEvent(new Event('papiano-auth-ready'));
    });
})();
