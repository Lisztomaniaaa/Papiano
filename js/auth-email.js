// === Papiano — Email Auth Extension ===
// Requires app.min.js (provides: firebaseAuth, ensureUserProfile,
// closeAuthEntryPopup, showToast, friendlyError).

// ── Allowed email domains ─────────────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────────────────
let _authCurrentScreen = 'signin';
let _authBusy = false;
let _verifyPendingEmail = '';

// ── Overlay observer ──────────────────────────────────────────────────────────
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

// ── Screen management ─────────────────────────────────────────────────────────
function authShowScreen(screen) {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function _showErr(id, msg) { const e = document.getElementById(id); if (e) e.textContent = msg; }
function _authClearErr() {
    ['authSigninErr','authSignupErr','authForgotErr','authVerifyErr'].forEach(id => _showErr(id, ''));
}
function _setLoading(busy) {
    _authBusy = !!busy;
    ['authSigninBtn','authSignupBtn','authForgotBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
}
function _friendly(err) {
    if (typeof friendlyError === 'function') return friendlyError(err, 'Something went wrong. Please try again.');
    const c = String(err?.code || err?.message || '').toLowerCase();
    if (c.includes('invalid-email'))        return 'Invalid email address.';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
                                            return 'Incorrect email or password.';
    if (c.includes('email-already-in-use')) return 'Email already registered. Sign in instead.';
    if (c.includes('weak-password'))        return 'Password too weak.';
    if (c.includes('too-many-requests'))    return 'Too many attempts. Try again later.';
    if (c.includes('network'))              return 'Network error. Check your connection.';
    return err?.message || 'Something went wrong.';
}

// ── Password strength ─────────────────────────────────────────────────────────
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

// ── Sign In ───────────────────────────────────────────────────────────────────
async function authEntryWithEmail(mode) {
    if (_authBusy) return;
    if (!firebaseAuth) {
        window.addEventListener('papiano-sdks-ready', () => authEntryWithEmail(mode), { once: true });
        if (typeof showToast === 'function') showToast('Loading auth service, please wait…');
        return;
    }

    // ── SIGN IN ──────────────────────────────────────────────────────────────
    if (mode === 'signin') {
        const email = (document.getElementById('authSigninEmail')?.value || '').trim();
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
            await cred.user.reload();

            if (!cred.user.emailVerified) {
                _verifyPendingEmail = email;
                await firebaseAuth.signOut();
                const addr = document.getElementById('authVerifyEmailAddr');
                if (addr) addr.textContent = email;
                authShowScreen('verify');
                return;
            }

            await ensureUserProfile(cred.user);
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

        if (!name || name.length < 2) { _showErr('authSignupErr', 'Display name must be at least 2 characters.'); return; }
        if (name.length > 32)         { _showErr('authSignupErr', 'Display name must be 32 characters or less.'); return; }
        if (!email)                   { _showErr('authSignupErr', 'Please enter your email.'); return; }
        if (!_isDomainAllowed(email)) {
            _showErr('authSignupErr', 'Use a verified email provider (Gmail, Outlook, Yahoo, iCloud, etc.).');
            return;
        }
        const req = _validPass(pass);
        if (!req.length || !req.upper || !req.symbol) {
            _showErr('authSignupErr', 'Password needs 8+ characters, one uppercase letter, and one symbol.');
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

            const cred = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
            await cred.user.updateProfile({ displayName: name });

            try {
                await cred.user.sendEmailVerification({ url: location.origin });
            } catch (_) {}

            _verifyPendingEmail = email;
            await firebaseAuth.signOut();

            const addr = document.getElementById('authVerifyEmailAddr');
            if (addr) addr.textContent = email;
            authShowScreen('verify');

            if (typeof showToast === 'function')
                showToast('Account created! Check your inbox (and spam) for the verification link.', 'Almost there');
        } catch (err) {
            _showErr('authSignupErr', _friendly(err));
        } finally {
            _setLoading(false);
        }
        return;
    }
}

// ── Email verification ────────────────────────────────────────────────────────
async function authCheckVerified() {
    if (_authBusy || !firebaseAuth) return;
    if (!_verifyPendingEmail) { authShowScreen('signin'); return; }

    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) { _showErr('authVerifyErr', 'Enter your password to complete sign in.'); return; }

    _setLoading(true);
    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.reload();
        if (!cred.user.emailVerified) {
            await firebaseAuth.signOut();
            _showErr('authVerifyErr', 'Email not verified yet. Click the link in your inbox then try again. Check spam too.');
            return;
        }
        await ensureUserProfile(cred.user);
        if (typeof closeAuthEntryPopup === 'function') closeAuthEntryPopup();
    } catch (err) {
        _showErr('authVerifyErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}

async function authResendVerify() {
    if (!firebaseAuth || !_verifyPendingEmail) {
        if (typeof showToast === 'function') showToast('No pending verification. Please sign up first.', 'Info');
        return;
    }
    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) { _showErr('authVerifyErr', 'Enter your password first, then tap Resend.'); return; }

    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.sendEmailVerification({ url: location.origin });
        await firebaseAuth.signOut();
        if (typeof showToast === 'function')
            showToast('Verification email resent! Check inbox and spam.', 'Sent');
    } catch (err) {
        if (typeof showToast === 'function') showToast(_friendly(err), 'Error');
    }
}

// ── Password reset ────────────────────────────────────────────────────────────
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
        if (typeof showToast === 'function') showToast('Reset link sent! Check inbox and spam.', 'Email Sent');
        authShowScreen('signin');
    } catch (err) {
        _showErr('authForgotErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}
