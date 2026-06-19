// === Papiano — Email Auth Extension ===
// Requires: app.min.js (firebaseAuth, firestoreDb, ensureUserProfile,
//           closeAuthEntryPopup, showToast, friendlyError)
// Uses Firebase native email verification (no third-party OTP service).

// ── Allowed email domains ──────────────────────────────────────────────────────
const _ALLOWED_DOMAINS = new Set([
    'gmail.com','googlemail.com',
    'outlook.com','outlook.co.id','hotmail.com','hotmail.co.uk','hotmail.fr',
    'hotmail.it','hotmail.es','hotmail.de','hotmail.co.id',
    'live.com','live.co.uk','live.fr','live.it','live.nl','live.com.au','live.co.id','msn.com',
    'yahoo.com','yahoo.co.uk','yahoo.co.id','yahoo.fr','yahoo.es','yahoo.de',
    'yahoo.it','yahoo.com.au','yahoo.com.br','yahoo.co.jp','yahoo.com.ar','ymail.com','rocketmail.com',
    'icloud.com','me.com','mac.com',
    'protonmail.com','proton.me','protonmail.ch','pm.me',
    'aol.com','aim.com',
    'mail.com','email.com','gmx.com','gmx.net','gmx.de','gmx.at','gmx.us',
    'zoho.com','yandex.com','yandex.ru',
    'tutanota.com','tuta.com','fastmail.com','fastmail.fm',
    'naver.com','daum.net','kakao.com',
    'web.de','freenet.de','t-online.de',
    'libero.it','tiscali.it','orange.fr','laposte.net','wanadoo.fr',
    'mail.ru','bk.ru','inbox.ru','list.ru',
]);

function _isDomainAllowed(email) {
    const at = email.lastIndexOf('@');
    if (at < 1) return false;
    return _ALLOWED_DOMAINS.has(email.slice(at + 1).toLowerCase().trim());
}

// ── State ──────────────────────────────────────────────────────────────────────
let _authCurrentScreen = 'signin';
let _authBusy = false;

// ── Overlay observer ───────────────────────────────────────────────────────────
(function () {
    function attach() {
        const ov = document.getElementById('authEntryOverlay');
        if (!ov) return;
        new MutationObserver(() => {
            if (ov.classList.contains('active')) {
                authShowScreen(_authCurrentScreen);
            } else {
                _authCurrentScreen = 'signin';
            }
        }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();

// ── Screen management ──────────────────────────────────────────────────────────
function authShowScreen(screen) {
    authHydratePasswordFields(document.getElementById('authEntryOverlay') || document);
    _authCurrentScreen = screen;
    ['signin', 'signup', 'verify', 'forgot'].forEach(s => {
        const el = document.getElementById('authScreen_' + s);
        if (el) el.style.display = s === screen ? '' : 'none';
    });
    _authClearErr();

    const title = document.getElementById('authEntryTitle');
    const sub   = document.getElementById('authEntrySubtitle');
    const tabs  = document.getElementById('authTabBar');
    const cfg = {
        signin: { t: 'Sign In',        s: 'Access multiplayer, profiles, chat, and more.', tabs: true  },
        signup: { t: 'Create Account', s: "Join Papiano — it's free.",                     tabs: true  },
        verify: { t: 'Verify Email',   s: '',                                               tabs: false },
        forgot: { t: 'Reset Password', s: 'Enter your email to receive a reset link.',      tabs: false },
    };
    const c = cfg[screen] || cfg.signin;
    if (title) title.textContent = c.t;
    if (sub)   sub.textContent   = c.s;
    if (tabs)  tabs.style.display = c.tabs ? '' : 'none';
    document.querySelectorAll('.auth-tab-btn').forEach(b =>
        b.classList.toggle('auth-tab-active', b.dataset.tab === screen));
}

// ── Generic helpers ────────────────────────────────────────────────────────────
function _showErr(id, msg) { const e = document.getElementById(id); if (e) e.textContent = msg; }
function _authClearErr() {
    ['authSigninErr','authSignupErr','authForgotErr','authVerifyErr'].forEach(id => _showErr(id, ''));
}
function _setLoading(busy) {
    _authBusy = !!busy;
    ['authSigninBtn','authSignupBtn','authForgotBtn','authVerifyBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
}
function _friendly(err) {
    if (typeof friendlyError === 'function') return friendlyError(err, 'Something went wrong. Please try again.');
    const c = String(err?.code || err?.message || '').toLowerCase();
    if (c.includes('invalid-email'))         return 'Invalid email address.';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
                                             return 'Incorrect email or password.';
    if (c.includes('email-already-in-use')) return 'Email already registered. Sign in instead.';
    if (c.includes('weak-password'))        return 'Password too weak.';
    if (c.includes('too-many-requests'))    return 'Too many attempts. Try again later.';
    if (c.includes('network'))              return 'Network error. Check your connection.';
    return err?.message || 'Something went wrong.';
}

// ── Password strength ──────────────────────────────────────────────────────────
function _validPass(p) {
    return { length: p.length >= 8, upper: /[A-Z]/.test(p), symbol: /[^A-Za-z0-9\s]/.test(p) };
}
function authPwdStrength() {
    const v = _validPass(document.getElementById('authSignupPassword')?.value || '');
    ['length','upper','symbol'].forEach(k => {
        const el = document.getElementById('authPwdReq_' + k);
        if (el) el.classList.toggle('met', v[k]);
    });
}
function authHydratePasswordFields(scope = document) {
    scope.querySelectorAll?.('[data-secure-type="password"]').forEach(input => {
        if (input.type !== 'password') input.type = 'password';
    });
}
window.authHydratePasswordFields = authHydratePasswordFields;

function authTogglePwd(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (inp.dataset.secureType === 'password' && inp.type !== 'password') inp.type = 'password';
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    const icon = btn?.querySelector?.('.material-symbols-rounded');
    if (icon) icon.textContent = show ? 'visibility_off' : 'visibility';
}

// ── Email verification helpers ──────────────────────────────────────────────────
async function _sendVerification(user) {
    if (!user) return;
    try {
        await user.sendEmailVerification({ url: location.origin, handleCodeInApp: false });
    } catch (err) {
        // Non-fatal; surface a friendly message where the caller renders it.
        throw err;
    }
}

// ── Sign In / Sign Up entry point ──────────────────────────────────────────────
async function authEntryWithEmail(mode) {
    if (_authBusy) return;
    if (!firebaseAuth) {
        window.addEventListener('papiano-sdks-ready', () => authEntryWithEmail(mode), { once: true });
        if (typeof showToast === 'function') showToast('Loading auth service, please wait…');
        return;
    }

    // ── SIGN IN ──────────────────────────────────────────────────────────────
    if (mode === 'signin') {
        const email = (document.getElementById('authSigninEmail')?.value  || '').trim();
        const pass  =  document.getElementById('authSigninPassword')?.value || '';
        if (!email) { _showErr('authSigninErr', 'Please enter your email.'); return; }
        if (!pass)  { _showErr('authSigninErr', 'Please enter your password.'); return; }

        _setLoading(true); _authClearErr();
        try {
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.includes('google.com') && !methods.includes('password')) {
                _showErr('authSigninErr', 'This email is linked to Google. Use "Continue with Google" to sign in.');
                return;
            }

            const cred = await firebaseAuth.signInWithEmailAndPassword(email, pass);
            // If we arrived here to resolve a Google-link conflict, attach the
            // pending Google credential now that the password owner is verified.
            if (window._pendingGoogleLinkCredential) {
                try {
                    await cred.user.linkWithCredential(window._pendingGoogleLinkCredential);
                    if (typeof showToast === 'function') showToast('Google account connected to your profile.', 'Connected');
                } catch (_) {}
                window._pendingGoogleLinkCredential = null;
            }
            if (typeof ensureUserProfile === 'function') await ensureUserProfile(cred.user);
            if (typeof closeAuthEntryPopup === 'function') closeAuthEntryPopup();
        } catch (err) {
            _showErr('authSigninErr', _friendly(err));
        } finally {
            _setLoading(false);
        }
        return;
    }

    // ── SIGN UP ──────────────────────────────────────────────────────────────
    if (mode === 'signup') {
        const name    = (document.getElementById('authSignupName')?.value    || '').trim();
        const email   = (document.getElementById('authSignupEmail')?.value   || '').trim();
        const pass    =  document.getElementById('authSignupPassword')?.value || '';
        const confirm =  document.getElementById('authSignupConfirm')?.value  || '';

        if (!name || name.length < 2)  { _showErr('authSignupErr', 'Display name must be at least 2 characters.'); return; }
        if (name.length > 32)          { _showErr('authSignupErr', 'Display name must be 32 characters or less.'); return; }
        if (!email)                    { _showErr('authSignupErr', 'Please enter your email.'); return; }
        if (!_isDomainAllowed(email))  {
            _showErr('authSignupErr', 'Use a verified email provider (Gmail, Outlook, Yahoo, iCloud, etc.).');
            return;
        }
        const req = _validPass(pass);
        if (!req.length || !req.upper || !req.symbol) {
            _showErr('authSignupErr', 'Password needs 8+ chars, one uppercase letter, and one symbol.');
            return;
        }
        if (pass !== confirm) { _showErr('authSignupErr', 'Passwords do not match.'); return; }

        _setLoading(true); _authClearErr();
        try {
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.length > 0) {
                _showErr('authSignupErr', methods.includes('google.com')
                    ? 'This email is already linked to a Google account. Use "Continue with Google".'
                    : 'Email already registered. Sign in instead.');
                if (!methods.includes('google.com')) setTimeout(() => authShowScreen('signin'), 1600);
                return;
            }

            // Create the Firebase account, set the display name, then send the
            // verification link via Firebase.
            const cred = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
            await cred.user.updateProfile({ displayName: name });

            if (typeof firestoreDb !== 'undefined' && firestoreDb && name) {
                try {
                    await firestoreDb.collection('profiles').doc(cred.user.uid).set(
                        { name: name, searchName: name.toLowerCase() },
                        { merge: true }
                    );
                } catch (_) {}
            }

            try {
                await _sendVerification(cred.user);
            } catch (verifyErr) {
                // Account exists but the email failed to send — let them resend.
                if (typeof showToast === 'function')
                    showToast('Account created, but the verification email failed. Tap "Resend Link".', 'Heads up');
            }

            const addr = document.getElementById('authVerifyEmailAddr');
            if (addr) addr.textContent = email;
            authShowScreen('verify');

            if (typeof showToast === 'function')
                showToast('We just emailed you a verification link — check your inbox, and your spam folder just in case.', 'Verify your email');
        } catch (err) {
            _showErr('authSignupErr', _friendly(err));
        } finally {
            _setLoading(false);
        }
        return;
    }
}

// ── Email verification — continue / resend ──────────────────────────────────────
async function authCheckVerification() {
    if (_authBusy) return;
    const user = firebaseAuth?.currentUser;
    if (!user) {
        _showErr('authVerifyErr', 'Session expired. Please sign in again.');
        authShowScreen('signin');
        return;
    }

    _setLoading(true); _authClearErr();
    try {
        await user.reload();
        const fresh = firebaseAuth.currentUser;
        if (fresh && typeof ensureUserProfile === 'function') await ensureUserProfile(fresh);
        if (fresh && !fresh.emailVerified) {
            _showErr('authVerifyErr', "We haven't received your verification yet. Open the link in your inbox (check spam), then tap this button again.");
            return;
        }
        if (typeof closeAuthEntryPopup === 'function') closeAuthEntryPopup();
        if (typeof showToast === 'function') showToast('Email verified — welcome to Papiano!', 'Verified');
    } catch (err) {
        _showErr('authVerifyErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}

async function authResendVerification() {
    const user = firebaseAuth?.currentUser;
    if (!user) {
        _showErr('authVerifyErr', 'Session expired. Please sign up again.');
        authShowScreen('signup');
        return;
    }
    try {
        await _sendVerification(user);
        _showErr('authVerifyErr', '');
        if (typeof showToast === 'function') showToast('Fresh verification link on its way — check your inbox.', 'Resent');
    } catch (err) {
        _showErr('authVerifyErr', _friendly(err));
    }
}

// ── Account settings — reset password ───────────────────────────────────────────
// Sends a Firebase password-reset link to the signed-in account's email.
async function requestAccountPasswordReset() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    if (!user?.email) {
        if (typeof showToast === 'function') showToast('Sign in with an email account to reset your password.');
        return;
    }
    try {
        // The signed-in user's own providers are authoritative. Don't rely on
        // fetchSignInMethodsForEmail — it returns [] under Email Enumeration
        // Protection, which would let this guard fall open for a Google-only account.
        if (!getUserProviderIds().includes('password')) {
            if (typeof showToast === 'function')
                showToast('This account uses Google sign-in — there is no password to reset.', 'Google account');
            return;
        }
        await firebaseAuth.sendPasswordResetEmail(user.email, { url: location.origin });
        if (typeof showToast === 'function')
            showToast('Reset link sent to ' + user.email + ' — check your inbox, and your spam folder just in case.', 'Email Sent');
    } catch (err) {
        if (typeof showToast === 'function') showToast(_friendly(err), 'Error');
    }
}
window.requestAccountPasswordReset = requestAccountPasswordReset;

// ── Account linking (Google + Email/Password integrity) ─────────────────────────
// A Firebase user can have several sign-in providers attached to ONE account.
// Google sign-in has no password, so we let those users SET one (link a password
// provider), and let password users CONNECT Google. This keeps a single account
// reachable by either method, and makes password reset universally available.
function getUserProviderIds() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    if (!user) return [];
    return (user.providerData || []).map(p => p?.providerId).filter(Boolean);
}

// The account-settings password button is context-aware: reset when a password
// already exists, otherwise set one (which links the password provider).
function handleAccountPasswordAction() {
    if (getUserProviderIds().includes('password')) {
        requestAccountPasswordReset();
    } else {
        openLinkPasswordModal();
    }
}
window.handleAccountPasswordAction = handleAccountPasswordAction;

function _securityRow(label, connected, connectAction) {
    const status = connected
        ? '<span class="account-conn-chip is-on"><span class="material-symbols-rounded">check_circle</span>Connected</span>'
        : `<button class="account-conn-btn" type="button" onclick="${connectAction}">Connect</button>`;
    return `<div class="account-conn-row"><span class="account-conn-name">${escapeHtmlSafe(label)}</span>${status}</div>`;
}

function escapeHtmlSafe(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function refreshAccountSecurityUI() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    const section = document.getElementById('accountSecurity');
    const rows = document.getElementById('accountSecurityRows');
    const pwdBtn = document.getElementById('accountResetPwdBtn');
    if (!user) { if (section) section.style.display = 'none'; return; }
    const providers = getUserProviderIds();
    const hasPassword = providers.includes('password');
    const hasGoogle = providers.includes('google.com');
    if (pwdBtn) pwdBtn.textContent = hasPassword ? 'Reset Password' : 'Set Password';
    if (section) section.style.display = '';
    if (rows) {
        rows.innerHTML =
            _securityRow('Google', hasGoogle, 'linkGoogleAccount()') +
            _securityRow('Email & Password', hasPassword, 'openLinkPasswordModal()');
    }
}
window.refreshAccountSecurityUI = refreshAccountSecurityUI;

async function linkGoogleAccount() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    if (!user) { if (typeof showToast === 'function') showToast('Sign in first.'); return; }
    if (getUserProviderIds().includes('google.com')) { refreshAccountSecurityUI(); return; }
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await user.linkWithPopup(provider);
        if (typeof showToast === 'function') showToast('Google account connected.', 'Connected');
        refreshAccountSecurityUI();
    } catch (err) {
        const code = err?.code || '';
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
            if (typeof showToast === 'function') showToast('That Google account is already linked elsewhere.', 'Error');
        } else if (code === 'auth/requires-recent-login') {
            if (typeof showToast === 'function') showToast('Please sign in again, then connect Google.', 'Error');
        } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
            if (typeof showToast === 'function') showToast(_friendly(err), 'Error');
        }
    }
}
window.linkGoogleAccount = linkGoogleAccount;

function openLinkPasswordModal() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    if (!user) { if (typeof showToast === 'function') showToast('Sign in first.'); return; }
    if (!user.email) {
        if (typeof showToast === 'function') showToast('Your account has no email to attach a password to.', 'Unavailable');
        return;
    }
    authHydratePasswordFields(document.getElementById('linkPasswordOverlay') || document);
    const emailEl = document.getElementById('linkPasswordEmail');
    if (emailEl) emailEl.value = user.email;
    ['linkPasswordNew', 'linkPasswordConfirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    _showErr('linkPasswordErr', '');
    const ov = document.getElementById('linkPasswordOverlay');
    if (ov) { ov.classList.add('active'); ov.setAttribute('aria-hidden', 'false'); }
}
window.openLinkPasswordModal = openLinkPasswordModal;

function closeLinkPasswordModal() {
    const ov = document.getElementById('linkPasswordOverlay');
    if (ov) { ov.classList.remove('active'); ov.setAttribute('aria-hidden', 'true'); }
}
window.closeLinkPasswordModal = closeLinkPasswordModal;

async function submitLinkPassword() {
    const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
    if (!user || !user.email) { closeLinkPasswordModal(); return; }
    const pass    = document.getElementById('linkPasswordNew')?.value || '';
    const confirm = document.getElementById('linkPasswordConfirm')?.value || '';
    const req = _validPass(pass);
    if (!req.length || !req.upper || !req.symbol) {
        _showErr('linkPasswordErr', 'Password needs 8+ chars, one uppercase letter, and one symbol.');
        return;
    }
    if (pass !== confirm) { _showErr('linkPasswordErr', 'Passwords do not match.'); return; }

    const btn = document.getElementById('linkPasswordConfirmBtn');
    if (btn) btn.disabled = true;
    _showErr('linkPasswordErr', '');
    try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
        try {
            await user.linkWithCredential(cred);
        } catch (err) {
            // Attaching a password is security-sensitive, so a Google session
            // restored from an earlier visit is rejected with
            // auth/requires-recent-login. Re-verify Google in place and retry once
            // — the user never has to manually sign out and back in.
            if (err?.code === 'auth/requires-recent-login' && getUserProviderIds().includes('google.com')) {
                // Re-verifying Google is required. Popups are unreliable on mobile — the
                // popup frequently can't hand control back to the opener, so the original
                // reauthenticateWithPopup() just hangs ("nothing happens"). Use a full-page
                // redirect instead and finish linking on return, see finishPendingPasswordLink().
                try { sessionStorage.setItem('_pendingPwLink', JSON.stringify({ email: user.email, pass })); } catch (_) {}
                if (typeof showToast === 'function') showToast('Verifying with Google…', 'One moment');
                await user.reauthenticateWithRedirect(new firebase.auth.GoogleAuthProvider());
                return;
            } else {
                throw err;
            }
        }
        closeLinkPasswordModal();
        if (typeof showToast === 'function') showToast('Password set — you can now sign in with email and reset it anytime.', 'Password Added');
        refreshAccountSecurityUI();
    } catch (err) {
        const code = err?.code || '';
        if (code === 'auth/requires-recent-login') {
            _showErr('linkPasswordErr', 'For security, sign out and sign in with Google again, then retry.');
        } else if (code === 'auth/provider-already-linked') {
            _showErr('linkPasswordErr', 'A password is already set for this account.');
            refreshAccountSecurityUI();
        } else if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
            _showErr('linkPasswordErr', 'That email is already linked to a different account.');
        } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            _showErr('linkPasswordErr', 'Google verification was cancelled — try again to set your password.');
        } else {
            _showErr('linkPasswordErr', _friendly(err));
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}
window.submitLinkPassword = submitLinkPassword;

// Finish a password link that required a fresh Google sign-in. On mobile,
// submitLinkPassword() stashes the new password and triggers a redirect-based
// reauth; when Google redirects back to the app, complete the linkWithCredential
// here. No-op unless a pending link is waiting in sessionStorage.
async function finishPendingPasswordLink() {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('_pendingPwLink') || 'null'); } catch (_) {}
    if (!pending || !pending.pass) return;
    if (typeof firebaseAuth === 'undefined' || !firebaseAuth) return;
    try {
        let res = null;
        try { res = await firebaseAuth.getRedirectResult(); } catch (_) {}
        const user = (res && res.user) || firebaseAuth.currentUser;
        if (!user || !user.email) return;
        await user.linkWithCredential(firebase.auth.EmailAuthProvider.credential(pending.email || user.email, pending.pass));
        if (typeof showToast === 'function') showToast('Password set — you can now sign in with email and reset it anytime.', 'Password Added');
        if (typeof refreshAccountSecurityUI === 'function') refreshAccountSecurityUI();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Couldn’t finish setting your password — please try again.', 'Try again');
    } finally {
        try { sessionStorage.removeItem('_pendingPwLink'); } catch (_) {}
    }
}
window.finishPendingPasswordLink = finishPendingPasswordLink;
(function () {
    function run() { finishPendingPasswordLink(); }
    if (typeof firebaseAuth !== 'undefined' && firebaseAuth) run();
    else window.addEventListener('papiano-sdks-ready', run, { once: true });
})();

// ── Delete account — complete override ────────────────────────────────────────
// Replaces deletePapianoAccount() entirely to fix:
// 1. closeDeleteAccountModal won't close when accountDeleteBusy=true (original bug)
// 2. email/password users need reauthenticateWithCredential before user.delete()
// 3. Google users also re-auth if needed (catches auth/requires-recent-login)
(function () {
    function install() {
        window.deletePapianoAccount = async function () {
            const user = (typeof firebaseAuth !== 'undefined') && firebaseAuth?.currentUser;
            if (!user?.uid) {
                if (typeof showToast === 'function') showToast('Sign in to manage your account.');
                return;
            }

            // Verify account ID
            const expectedId = (typeof getCurrentPublicIdNumber === 'function') ? getCurrentPublicIdNumber() : null;
            const idInput    = document.getElementById('accountDeleteIdInput');
            const enteredId  = (typeof parsePublicIdInput === 'function') ? parsePublicIdInput(idInput?.value || '') : null;
            if (!expectedId || enteredId !== expectedId) {
                if (typeof showToast === 'function') showToast('Account ID does not match.');
                idInput?.focus();
                return;
            }

            // Email/password users: require password re-auth
            if (user.email) {
                let methods = [];
                try { methods = await firebaseAuth.fetchSignInMethodsForEmail(user.email); } catch (_) {}
                if (methods.includes('password')) {
                    const wrap   = document.getElementById('accountDeletePasswordWrap');
                    const passEl = document.getElementById('accountDeletePasswordInput');
                    const pass   = (passEl?.value || '').trim();
                    if (!pass) {
                        authHydratePasswordFields(document.getElementById('accountDeleteOverlay') || document);
                        if (wrap) wrap.style.display = '';
                        passEl?.focus();
                        if (typeof showToast === 'function') showToast('Enter your password to confirm.', 'Required');
                        return;
                    }
                    try {
                        const cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
                        await user.reauthenticateWithCredential(cred);
                    } catch (_) {
                        if (passEl) passEl.value = '';
                        if (typeof showToast === 'function') showToast('Incorrect password.', 'Error');
                        return;
                    }
                }
            }

            // Set busy UI
            const btn = document.getElementById('accountDeleteConfirmBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

            const uid = user.uid;
            try {
                // Stop background workers
                ['stopCommunityListeners','stopLeaderboardListeners','stopDeletedAccountWatcher'].forEach(fn => {
                    if (typeof window[fn] === 'function') try { window[fn](); } catch (_) {}
                });
                if (typeof pausePlayTimeTracker === 'function') try { pausePlayTimeTracker(true); } catch (_) {}

                // Mark deleted in Realtime DB (non-fatal)
                if (typeof realtimeDb !== 'undefined' && realtimeDb) {
                    await realtimeDb.ref('deletedAccounts/' + uid).set({
                        deleted: true,
                        deletedAt: firebase.database.ServerValue.TIMESTAMP
                    }).catch(() => {});
                }

                // Wipe Firestore profile (non-fatal)
                if (typeof firestoreDb !== 'undefined' && firestoreDb) {
                    await firestoreDb.collection('profiles').doc(uid).set({
                        deleted: true,
                        name: 'Deleted Account',
                        searchName: 'deleted account',
                        desc: '', photoURL: '', avatarURL: '',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).catch(() => {});
                }

                // Delete Firebase Auth user (the critical step)
                await user.delete();

                // Clear local caches
                try { localStorage.removeItem('papiano_profile_cache_v2'); } catch (_) {}
                try { localStorage.removeItem('papiano_access_session'); } catch (_) {}
                try { sessionStorage.clear(); } catch (_) {}

                // Force close modal directly (bypass accountDeleteBusy check)
                const overlay = document.getElementById('accountDeleteOverlay');
                if (overlay) { overlay.classList.remove('active', 'is-verify'); overlay.setAttribute('aria-hidden', 'true'); }

                if (typeof showToast === 'function') showToast('Account deleted. You can sign up again with the same email.', 'Done');
                setTimeout(() => location.reload(), 1800);

            } catch (err) {
                if (btn) { btn.disabled = false; btn.textContent = 'Delete Account'; }
                const msg = err?.code === 'auth/requires-recent-login'
                    ? 'Session expired. Sign out, sign back in, then try again.'
                    : (err?.message || 'Failed to delete account. Please try again.');
                if (typeof showToast === 'function') showToast(msg, 'Error');
            }
        };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else setTimeout(install, 300);
})();

// ── Password reset (login overlay "forgot password") ────────────────────────────
async function authSendReset() {
    if (_authBusy || !firebaseAuth) return;
    const email = (document.getElementById('authForgotEmail')?.value || '').trim();
    if (!email) { _showErr('authForgotErr', 'Please enter your email.'); return; }

    _setLoading(true); _authClearErr();
    try {
        let methods = [];
        try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
        if (methods.includes('google.com') && !methods.includes('password')) {
            _showErr('authForgotErr', 'This account uses Google sign-in. Use "Continue with Google" — there is no password to reset.');
            return;
        }

        await firebaseAuth.sendPasswordResetEmail(email, { url: location.origin });
        if (typeof showToast === 'function') showToast('Reset link sent — check your inbox, and your spam folder just in case.', 'Email Sent');
        authShowScreen('signin');
    } catch (err) {
        _showErr('authForgotErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}
