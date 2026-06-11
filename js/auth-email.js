// === Papiano — Email Auth Extension ===
// Requires app.min.js (firebaseAuth, ensureUserProfile, closeAuthEntryPopup,
// openAuthEntryPopup, showToast, friendlyError).

// ── Config ────────────────────────────────────────────────────────────────────
const PAPIANO_RECAPTCHA_KEY = '6LejzhgtAAAAALFINJQN0QhispRIrMy2VPDIzYoy';

// ── Allowed email domains (public / verified providers only) ──────────────────
const _ALLOWED_DOMAINS = new Set([
    // Google
    'gmail.com','googlemail.com',
    // Microsoft
    'outlook.com','outlook.co.id','hotmail.com','hotmail.co.uk','hotmail.fr',
    'hotmail.it','hotmail.es','hotmail.de','hotmail.co.id',
    'live.com','live.co.uk','live.fr','live.it','live.nl','live.com.au',
    'live.co.id','msn.com',
    // Yahoo
    'yahoo.com','yahoo.co.uk','yahoo.co.id','yahoo.fr','yahoo.es','yahoo.de',
    'yahoo.it','yahoo.com.au','yahoo.com.br','yahoo.co.jp','yahoo.com.ar',
    'ymail.com','rocketmail.com',
    // Apple
    'icloud.com','me.com','mac.com',
    // Proton
    'protonmail.com','proton.me','protonmail.ch','pm.me',
    // Others
    'aol.com','aim.com',
    'mail.com','email.com','gmx.com','gmx.net','gmx.de','gmx.at','gmx.us',
    'zoho.com',
    'yandex.com','yandex.ru',
    'tutanota.com','tuta.com',
    'fastmail.com','fastmail.fm',
    // Korean
    'naver.com','daum.net','kakao.com',
    // German/European
    'web.de','freenet.de','t-online.de',
    'libero.it','tiscali.it',
    'orange.fr','laposte.net','wanadoo.fr',
    // Russian
    'mail.ru','bk.ru','inbox.ru','list.ru',
]);

function _isDomainAllowed(email) {
    const at = email.lastIndexOf('@');
    if (at < 1) return false;
    const domain = email.slice(at + 1).toLowerCase().trim();
    return _ALLOWED_DOMAINS.has(domain);
}

// ── State ─────────────────────────────────────────────────────────────────────
let _authCurrentScreen = 'signin';
let _authBusy = false;
let _captchaSigninId = null;
let _captchaSignupId = null;
let _captchaRendered = false;
let _verifyPendingEmail = '';

// ── reCAPTCHA ─────────────────────────────────────────────────────────────────
window._authCaptchaReady = function () {
    _captchaRendered = false;
    const overlay = document.getElementById('authEntryOverlay');
    if (overlay && overlay.classList.contains('active')) _renderCaptchas();
};

function _renderCaptchas() {
    if (typeof grecaptcha === 'undefined') return;
    if (_captchaRendered) return;
    const si = document.getElementById('authSigninCaptcha');
    const su = document.getElementById('authSignupCaptcha');
    if (si && !si.dataset.rendered) {
        si.dataset.rendered = '1';
        try { _captchaSigninId = grecaptcha.render(si, { sitekey: PAPIANO_RECAPTCHA_KEY, theme: 'light' }); } catch (_) {}
    }
    if (su && !su.dataset.rendered) {
        su.dataset.rendered = '1';
        try { _captchaSignupId = grecaptcha.render(su, { sitekey: PAPIANO_RECAPTCHA_KEY, theme: 'light' }); } catch (_) {}
    }
    _captchaRendered = true;
}

function _captchaOk(id) {
    if (typeof grecaptcha === 'undefined' || id === null) return true;
    return !!grecaptcha.getResponse(id);
}
function _captchaReset() {
    if (typeof grecaptcha === 'undefined') return;
    try { if (_captchaSigninId !== null) grecaptcha.reset(_captchaSigninId); } catch (_) {}
    try { if (_captchaSignupId !== null) grecaptcha.reset(_captchaSignupId); } catch (_) {}
}

// Observe overlay active state → init screen + render captchas
(function () {
    function attach() {
        const overlay = document.getElementById('authEntryOverlay');
        if (!overlay) return;
        new MutationObserver(() => {
            if (overlay.classList.contains('active')) {
                authShowScreen(_authCurrentScreen);
                setTimeout(_renderCaptchas, 120);
            } else {
                _authCurrentScreen = 'signin';
            }
        }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
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
    const sub = document.getElementById('authEntrySubtitle');
    const tabBar = document.getElementById('authTabBar');
    if (screen === 'signin') {
        if (title) title.textContent = 'Sign In';
        if (sub) sub.textContent = 'Access multiplayer, profiles, chat, and more.';
        if (tabBar) tabBar.style.display = '';
        document.querySelectorAll('.auth-tab-btn').forEach(b =>
            b.classList.toggle('auth-tab-active', b.dataset.tab === 'signin'));
    } else if (screen === 'signup') {
        if (title) title.textContent = 'Create Account';
        if (sub) sub.textContent = "Join Papiano — it's free.";
        if (tabBar) tabBar.style.display = '';
        document.querySelectorAll('.auth-tab-btn').forEach(b =>
            b.classList.toggle('auth-tab-active', b.dataset.tab === 'signup'));
    } else if (screen === 'verify') {
        if (title) title.textContent = 'Verify Email';
        if (sub) sub.textContent = '';
        if (tabBar) tabBar.style.display = 'none';
    } else if (screen === 'forgot') {
        if (title) title.textContent = 'Reset Password';
        if (sub) sub.textContent = 'Enter your email to receive a password reset link.';
        if (tabBar) tabBar.style.display = 'none';
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _authShowErr(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}
function _authClearErr() {
    ['authSigninErr', 'authSignupErr', 'authForgotErr', 'authVerifyErr'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
}
function _authSetBusy(busy) {
    _authBusy = !!busy;
    ['authSigninBtn', 'authSignupBtn', 'authForgotBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
}
function _authFriendly(err) {
    if (typeof friendlyError === 'function') return friendlyError(err, 'Something went wrong. Please try again.');
    const code = String(err?.code || err?.message || '').toLowerCase();
    if (code.includes('invalid-email')) return 'Invalid email address.';
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential'))
        return 'Incorrect email or password.';
    if (code.includes('email-already-in-use')) return 'Email already registered. Sign in instead.';
    if (code.includes('weak-password')) return 'Password too weak.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';
    if (code.includes('network')) return 'Network error. Check your connection.';
    return err?.message || 'Something went wrong.';
}

// ── Password validation ───────────────────────────────────────────────────────
function _validPass(pass) {
    return {
        length: pass.length >= 8,
        upper: /[A-Z]/.test(pass),
        symbol: /[^A-Za-z0-9\s]/.test(pass)
    };
}
function authPwdStrength() {
    const pass = document.getElementById('authSignupPassword')?.value || '';
    const v = _validPass(pass);
    ['length', 'upper', 'symbol'].forEach(k => {
        const el = document.getElementById('authPwdReq_' + k);
        if (el) el.classList.toggle('met', v[k]);
    });
}
function authTogglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    const icon = btn?.querySelector && btn.querySelector('.material-symbols-rounded');
    if (icon) icon.textContent = show ? 'visibility_off' : 'visibility';
}

// ── Sign In ───────────────────────────────────────────────────────────────────
async function authEntryWithEmail(mode) {
    if (_authBusy) return;
    if (!firebaseAuth) {
        window.addEventListener('papiano-sdks-ready', () => authEntryWithEmail(mode), { once: true });
        if (typeof showToast === 'function') showToast('Auth service loading, please wait…');
        return;
    }

    if (mode === 'signin') {
        const email = (document.getElementById('authSigninEmail')?.value || '').trim();
        const pass = document.getElementById('authSigninPassword')?.value || '';
        if (!email) { _authShowErr('authSigninErr', 'Please enter your email.'); return; }
        if (!pass) { _authShowErr('authSigninErr', 'Please enter your password.'); return; }
        if (!_captchaOk(_captchaSigninId)) {
            _authShowErr('authSigninErr', 'Please complete the CAPTCHA verification.');
            return;
        }

        _authSetBusy(true);
        _authClearErr();
        try {
            // Check if this email is registered with Google only
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.length > 0 && methods.includes('google.com') && !methods.includes('password')) {
                _authShowErr('authSigninErr', 'This email is registered with Google. Use "Continue with Google" to sign in.');
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
            _authShowErr('authSigninErr', _authFriendly(err));
            _captchaReset();
        } finally {
            _authSetBusy(false);
        }
        return;
    }

    if (mode === 'signup') {
        const name = (document.getElementById('authSignupName')?.value || '').trim();
        const email = (document.getElementById('authSignupEmail')?.value || '').trim();
        const pass = document.getElementById('authSignupPassword')?.value || '';
        const confirm = document.getElementById('authSignupConfirm')?.value || '';

        if (!name || name.length < 2) {
            _authShowErr('authSignupErr', 'Display name must be at least 2 characters.');
            return;
        }
        if (name.length > 32) {
            _authShowErr('authSignupErr', 'Display name must be 32 characters or less.');
            return;
        }
        if (!email) { _authShowErr('authSignupErr', 'Please enter your email.'); return; }
        if (!_isDomainAllowed(email)) {
            _authShowErr('authSignupErr', 'Use a verified email provider (Gmail, Outlook, Yahoo, etc.). Disposable or temporary emails are not allowed.');
            return;
        }
        const req = _validPass(pass);
        if (!req.length || !req.upper || !req.symbol) {
            _authShowErr('authSignupErr', 'Password needs 8+ characters, one uppercase letter, and one symbol.');
            return;
        }
        if (pass !== confirm) { _authShowErr('authSignupErr', 'Passwords do not match.'); return; }
        if (!_captchaOk(_captchaSignupId)) {
            _authShowErr('authSignupErr', 'Please complete the CAPTCHA verification.');
            return;
        }

        _authSetBusy(true);
        _authClearErr();
        try {
            // Check if this email is already registered (any provider)
            let methods = [];
            try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
            if (methods.length > 0) {
                if (methods.includes('google.com')) {
                    _authShowErr('authSignupErr', 'This email is already linked to a Google account. Use "Continue with Google" to sign in.');
                } else {
                    _authShowErr('authSignupErr', 'Email already registered. Sign in instead.');
                    setTimeout(() => authShowScreen('signin'), 1800);
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
            _authShowErr('authSignupErr', _authFriendly(err));
            _captchaReset();
        } finally {
            _authSetBusy(false);
        }
        return;
    }
}

// ── Email verification ────────────────────────────────────────────────────────
async function authCheckVerified() {
    if (_authBusy || !firebaseAuth) return;
    if (!_verifyPendingEmail) { authShowScreen('signin'); return; }

    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) {
        _authShowErr('authVerifyErr', 'Enter your password to complete sign in.');
        return;
    }

    _authSetBusy(true);
    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.reload();
        if (!cred.user.emailVerified) {
            await firebaseAuth.signOut();
            _authShowErr('authVerifyErr', "Email not verified yet. Click the link in your inbox, then try again.");
            return;
        }
        await ensureUserProfile(cred.user);
        if (typeof closeAuthEntryPopup === 'function') closeAuthEntryPopup();
    } catch (err) {
        _authShowErr('authVerifyErr', _authFriendly(err));
    } finally {
        _authSetBusy(false);
    }
}

async function authResendVerify() {
    if (!firebaseAuth || !_verifyPendingEmail) {
        if (typeof showToast === 'function') showToast('No pending verification. Sign up again.', 'Info');
        return;
    }
    const pass = document.getElementById('authVerifyPassword')?.value || '';
    if (!pass) {
        _authShowErr('authVerifyErr', 'Enter your password first, then tap Resend.');
        return;
    }
    try {
        const cred = await firebaseAuth.signInWithEmailAndPassword(_verifyPendingEmail, pass);
        await cred.user.sendEmailVerification({ url: location.origin });
        await firebaseAuth.signOut();
        if (typeof showToast === 'function') showToast('Verification email resent! Check your inbox.', 'Sent');
    } catch (err) {
        if (typeof showToast === 'function') showToast(_authFriendly(err), 'Error');
    }
}

// ── Password reset ────────────────────────────────────────────────────────────
async function authSendReset() {
    if (_authBusy || !firebaseAuth) return;
    const email = (document.getElementById('authForgotEmail')?.value || '').trim();
    if (!email) { _authShowErr('authForgotErr', 'Please enter your email.'); return; }

    _authSetBusy(true);
    _authClearErr();
    try {
        // Check if email is Google-only — password reset won't work for it
        let methods = [];
        try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
        if (methods.length > 0 && methods.includes('google.com') && !methods.includes('password')) {
            _authShowErr('authForgotErr', 'This email uses Google sign-in. No password to reset — use "Continue with Google".');
            return;
        }

        await firebaseAuth.sendPasswordResetEmail(email, { url: location.origin });
        if (typeof showToast === 'function') showToast('Reset link sent! Check your inbox.', 'Email Sent');
        authShowScreen('signin');
    } catch (err) {
        _authShowErr('authForgotErr', _authFriendly(err));
    } finally {
        _authSetBusy(false);
    }
}
