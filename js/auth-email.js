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
    _authCurrentScreen = screen;
    ['signin', 'signup', 'verify', 'forgot', 'sent'].forEach(s => {
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
        sent:   { t: 'Check Your Email', s: '',                                             tabs: false },
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
function authTogglePwd(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
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
        // Check verification BEFORE touching the profile, so an early tap doesn't
        // close the popup or boot a still-unverified user.
        if (!fresh || !fresh.emailVerified) {
            _showErr('authVerifyErr', "We haven't received your verification yet. Open the link in your inbox (check spam), then tap this button again.");
            return;
        }
        // Verified — reload so the app boots cleanly as a fully signed-in user
        // (starts profile, listeners, presence via the normal auth-state path).
        if (typeof showToast === 'function') showToast('Email verified — welcome to Papiano!', 'Verified');
        setTimeout(() => location.reload(), 700);
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
        const addr = document.getElementById('authSentEmailAddr');
        if (addr) addr.textContent = email;
        authShowScreen('sent');
    } catch (err) {
        _showErr('authForgotErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}
