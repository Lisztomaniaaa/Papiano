// === Papiano — Email Auth Extension ===
// Requires app.min.js (provides: firebaseAuth, ensureUserProfile,
// closeAuthEntryPopup, openAuthEntryPopup, showToast, friendlyError).

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
let _captchaSigninId = null;
let _captchaSignupId = null;
let _captchaRendered = false;
let _verifyPendingEmail = '';
const RECAPTCHA_SITE_KEY = '6LejzhgtAAAAALFINJQN0QhispRIrMy2VPDIzYoy';

// ── reCAPTCHA render ──────────────────────────────────────────────────────────
window._authCaptchaReady = function () {
    _captchaRendered = false;
    const ov = document.getElementById('authEntryOverlay');
    if (ov && ov.classList.contains('active')) _renderCaptchas();
};

function _renderCaptchas() {
    if (typeof grecaptcha === 'undefined' || _captchaRendered) return;
    const si = document.getElementById('authSigninCaptcha');
    const su = document.getElementById('authSignupCaptcha');
    if (si && !si.dataset.rendered) {
        si.dataset.rendered = '1';
        try { _captchaSigninId = grecaptcha.render(si, { sitekey: RECAPTCHA_SITE_KEY, theme: 'light' }); } catch (_) {}
    }
    if (su && !su.dataset.rendered) {
        su.dataset.rendered = '1';
        try { _captchaSignupId = grecaptcha.render(su, { sitekey: RECAPTCHA_SITE_KEY, theme: 'light' }); } catch (_) {}
    }
    _captchaRendered = true;
}

function _getCaptchaToken(id) {
    if (typeof grecaptcha === 'undefined' || id === null) return null;
    const t = grecaptcha.getResponse(id);
    return t || null;
}

function _captchaReset() {
    if (typeof grecaptcha === 'undefined') return;
    try { if (_captchaSigninId !== null) grecaptcha.reset(_captchaSigninId); } catch (_) {}
    try { if (_captchaSignupId !== null) grecaptcha.reset(_captchaSignupId); } catch (_) {}
}

// Server-side captcha verification via Vercel function
async function _verifyCaptcha(widgetId) {
    const token = _getCaptchaToken(widgetId);
    if (!token) return { ok: false, reason: 'Please complete the CAPTCHA verification.' };

    try {
        const resp = await fetch('/api/verify-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        if (!resp.ok) return { ok: false, reason: 'CAPTCHA service error. Please try again.' };
        const data = await resp.json();
        if (!data.success) return { ok: false, reason: 'CAPTCHA verification failed. Please try again.' };
        return { ok: true };
    } catch (_) {
        // Network error — fail open so auth still works if API unreachable
        return { ok: true };
    }
}

// ── Overlay observer ──────────────────────────────────────────────────────────
(function () {
    function attach() {
        const ov = document.getElementById('authEntryOverlay');
        if (!ov) return;
        new MutationObserver(() => {
            if (ov.classList.contains('active')) {
                authShowScreen(_authCurrentScreen);
                setTimeout(_renderCaptchas, 120);
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

    const config = {
        signin: { t: 'Sign In',        s: 'Access multiplayer, profiles, chat, and more.', tabs: true  },
        signup: { t: 'Create Account', s: "Join Papiano — it's free.",                     tabs: true  },
        verify: { t: 'Verify Email',   s: '',                                               tabs: false },
        forgot: { t: 'Reset Password', s: 'Enter your email to receive a reset link.',      tabs: false },
    };
    const c = config[screen] || config.signin;
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
    if (c.includes('invalid-email'))          return 'Invalid email address.';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
                                              return 'Incorrect email or password.';
    if (c.includes('email-already-in-use'))   return 'Email already registered. Sign in instead.';
    if (c.includes('weak-password'))          return 'Password too weak.';
    if (c.includes('too-many-requests'))      return 'Too many attempts. Try again later.';
    if (c.includes('network'))                return 'Network error. Check your connection.';
    return err?.message || 'Something went wrong.';
}
function _sdkReady() {
    return !!(typeof firebaseAuth !== 'undefined' && firebaseAuth);
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
    if (!_sdkReady()) {
        window.addEventListener('papiano-sdks-ready', () => authEntryWithEmail(mode), { once: true });
        if (typeof showToast === 'function') showToast('Loading auth service, please wait…');
        return;
    }

    // ── SIGN IN ──
    if (mode === 'signin') {
        const email = (document.getElementById('authSigninEmail')?.value || '').trim();
        const pass  =  document.getElementById('authSigninPassword')?.value || '';

        if (!email) { _showErr('authSigninErr', 'Please enter your email.'); return; }
        if (!pass)  { _showErr('authSigninErr', 'Please enter your password.'); return; }

        // Server-side CAPTCHA verification
        const cap = await _verifyCaptcha(_captchaSigninId);
        if (!cap.ok) { _showErr('authSigninErr', cap.reason); return; }

        _setLoading(true); _authClearErr();
        try {
            // Detect Google-only accounts before attempting password sign-in
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.includes('google.com') && !methods.includes('password')) {
                _showErr('authSigninErr', 'This email is registered with Google. Use "Continue with Google" to sign in.');
                _captchaReset();
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
            _captchaReset();
        } finally {
            _setLoading(false);
        }
        return;
    }

    // ── SIGN UP ──
    if (mode === 'signup') {
        const name    = (document.getElementById('authSignupName')?.value    || '').trim();
        const email   = (document.getElementById('authSignupEmail')?.value   || '').trim();
        const pass    =  document.getElementById('authSignupPassword')?.value || '';
        const confirm =  document.getElementById('authSignupConfirm')?.value  || '';

        if (!name || name.length < 2)  { _showErr('authSignupErr', 'Display name must be at least 2 characters.'); return; }
        if (name.length > 32)          { _showErr('authSignupErr', 'Display name must be 32 characters or less.'); return; }
        if (!email)                    { _showErr('authSignupErr', 'Please enter your email.'); return; }
        if (!_isDomainAllowed(email))  {
            _showErr('authSignupErr', 'Use a verified email provider (Gmail, Outlook, Yahoo, iCloud, etc.). Temporary or unknown domains are not allowed.');
            return;
        }
        const req = _validPass(pass);
        if (!req.length || !req.upper || !req.symbol) {
            _showErr('authSignupErr', 'Password needs 8+ characters, one uppercase letter, and one symbol.');
            return;
        }
        if (pass !== confirm) { _showErr('authSignupErr', 'Passwords do not match.'); return; }

        // Server-side CAPTCHA verification
        const cap = await _verifyCaptcha(_captchaSignupId);
        if (!cap.ok) { _showErr('authSignupErr', cap.reason); return; }

        _setLoading(true); _authClearErr();
        try {
            // Detect existing account (any provider) before creating
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.length > 0) {
                if (methods.includes('google.com')) {
                    _showErr('authSignupErr', 'This email is already linked to a Google account. Use "Continue with Google" to sign in.');
                } else {
                    _showErr('authSignupErr', 'Email already registered. Sign in instead.');
                    setTimeout(() => authShowScreen('signin'), 1600);
                }
                _captchaReset();
                return;
            }

            const cred = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
            await cred.user.updateProfile({ displayName: name });
            await cred.user.sendEmailVerification({ url: location.origin });
            _verifyPendingEmail = email;
            await firebaseAuth.signOut();

            const addr = document.getElementById('authVerifyEmailAddr');
            if (addr) addr.textContent = email;
            authShowScreen('verify');
        } catch (err) {
            _showErr('authSignupErr', _friendly(err));
            _captchaReset();
        } finally {
            _setLoading(false);
        }
        return;
    }
}

// ── Email verification ────────────────────────────────────────────────────────
async function authCheckVerified() {
    if (_authBusy || !_sdkReady()) return;
    if (!_verifyPendingEmail) { authShowScreen('signin'); return; }

    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) { _showErr('authVerifyErr', 'Enter your password to complete sign in.'); return; }

    _setLoading(true);
    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.reload();
        if (!cred.user.emailVerified) {
            await firebaseAuth.signOut();
            _showErr('authVerifyErr', "Email not verified yet. Click the link in your inbox, then try again.");
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
    if (!_sdkReady() || !_verifyPendingEmail) {
        if (typeof showToast === 'function') showToast('No pending verification. Please sign up first.', 'Info');
        return;
    }
    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) { _showErr('authVerifyErr', 'Enter your password first, then tap Resend.'); return; }

    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.sendEmailVerification({ url: location.origin });
        await firebaseAuth.signOut();
        if (typeof showToast === 'function') showToast('Verification email resent! Check your inbox.', 'Sent');
    } catch (err) {
        if (typeof showToast === 'function') showToast(_friendly(err), 'Error');
    }
}

// ── Password reset ────────────────────────────────────────────────────────────
async function authSendReset() {
    if (_authBusy || !_sdkReady()) return;
    const email = (document.getElementById('authForgotEmail')?.value || '').trim();
    if (!email) { _showErr('authForgotErr', 'Please enter your email.'); return; }

    _setLoading(true); _authClearErr();
    try {
        let methods = [];
        try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
        if (methods.includes('google.com') && !methods.includes('password')) {
            _showErr('authForgotErr', 'This account uses Google sign-in. Use "Continue with Google" instead — there is no password to reset.');
            return;
        }

        await firebaseAuth.sendPasswordResetEmail(email, { url: location.origin });
        if (typeof showToast === 'function') showToast('Reset link sent! Check your inbox.', 'Email Sent');
        authShowScreen('signin');
    } catch (err) {
        _showErr('authForgotErr', _friendly(err));
    } finally {
        _setLoading(false);
    }
}
