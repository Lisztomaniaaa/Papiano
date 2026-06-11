// === Papiano — Email Auth Extension ===
// Requires: app.min.js (firebaseAuth, firestoreDb, ensureUserProfile,
//           closeAuthEntryPopup, showToast, friendlyError)
// Requires: EmailJS CDN loaded before this file

// ── EmailJS config — set these after creating your emailjs.com account ─────────
// 1. Sign up at https://www.emailjs.com
// 2. Add an Email Service (Gmail / Outlook / etc.) → copy Service ID
// 3. Create an Email Template with variables: {{to_email}} {{to_name}} {{otp_code}} {{expiry_min}}
//    Copy Template ID
// 4. Go to Account → API Keys → copy Public Key
const _EJS_SERVICE_ID  = 'service_r2zj9dn';
const _EJS_TEMPLATE_ID = 'template_yxhiqyo';
const _EJS_PUBLIC_KEY  = '8sOe4jrGJCBwHhx06';

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
let _otpTimerHandle = null;
let _otpExpiry = 0;

// ── SessionStorage helpers ─────────────────────────────────────────────────────
const _SS = 'papiano_auth_';
function _ssSet(k, v) { try { sessionStorage.setItem(_SS + k, JSON.stringify(v)); } catch (_) {} }
function _ssGet(k)    { try { return JSON.parse(sessionStorage.getItem(_SS + k)); } catch (_) { return null; } }
function _ssDel(...keys) { keys.forEach(k => { try { sessionStorage.removeItem(_SS + k); } catch (_) {} }); }

// ── OTP core ───────────────────────────────────────────────────────────────────
function _genOTP() {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b % 10).join('');
}

async function _hashOTP(otp, email) {
    const data = new TextEncoder().encode(otp.trim() + ':' + email.toLowerCase().trim());
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _storeOTP(otp, email) {
    const hash   = await _hashOTP(otp, email);
    const expiry = Date.now() + 10 * 60 * 1000;
    _ssSet('otp_hash',     hash);
    _ssSet('otp_expiry',   expiry);
    _ssSet('otp_attempts', 0);
    _otpExpiry = expiry;
}

async function _checkOTP(inputOtp, email) {
    const hash     = _ssGet('otp_hash');
    const expiry   = _ssGet('otp_expiry');
    const attempts = _ssGet('otp_attempts') || 0;

    if (!hash)                return { ok: false, reason: 'no_otp' };
    if (Date.now() > expiry)  return { ok: false, reason: 'expired' };
    if (attempts >= 5)        return { ok: false, reason: 'locked' };

    _ssSet('otp_attempts', attempts + 1);

    const inputHash = await _hashOTP(inputOtp.trim(), email);
    if (inputHash !== hash) return { ok: false, reason: 'wrong', attempts: attempts + 1 };

    return { ok: true };
}

function _clearOTPSession() {
    _ssDel('otp_hash', 'otp_expiry', 'otp_attempts', 'pending_name', 'pending_email');
}

// ── EmailJS init ───────────────────────────────────────────────────────────────
(function () {
    function tryInit() {
        if (typeof emailjs === 'undefined') return;
        if (_EJS_PUBLIC_KEY && !_EJS_PUBLIC_KEY.startsWith('YOUR_')) {
            emailjs.init({ publicKey: _EJS_PUBLIC_KEY });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInit);
    else tryInit();
})();

async function _sendOTPEmail(toEmail, toName, otp) {
    if (typeof emailjs === 'undefined') throw new Error('Email service not loaded. Please refresh.');
    if (!_EJS_SERVICE_ID  || _EJS_SERVICE_ID.startsWith('YOUR_') ||
        !_EJS_TEMPLATE_ID || _EJS_TEMPLATE_ID.startsWith('YOUR_') ||
        !_EJS_PUBLIC_KEY  || _EJS_PUBLIC_KEY.startsWith('YOUR_')) {
        throw new Error('Email service not configured. Contact the site owner.');
    }
    await emailjs.send(_EJS_SERVICE_ID, _EJS_TEMPLATE_ID, {
        to_email:   toEmail,
        to_name:    toName || 'Papiano User',
        otp_code:   otp,
        expiry_min: '10',
    });
}

// ── OTP Timer ──────────────────────────────────────────────────────────────────
function _startOtpTimer() {
    _stopOtpTimer();
    const saved = _ssGet('otp_expiry');
    if (saved) _otpExpiry = saved;
    if (!_otpExpiry) return;
    _updateOtpTimer();
    _otpTimerHandle = setInterval(_updateOtpTimer, 1000);
}

function _stopOtpTimer() {
    if (_otpTimerHandle) { clearInterval(_otpTimerHandle); _otpTimerHandle = null; }
}

function _updateOtpTimer() {
    const el = document.getElementById('authOtpTimer');
    if (!el) return;
    const secs = Math.max(0, Math.ceil((_otpExpiry - Date.now()) / 1000));
    if (secs <= 0) {
        el.textContent   = 'Code expired. Click "Resend Code" for a new one.';
        el.style.color   = '#c62828';
        const btn = document.getElementById('authVerifyBtn');
        if (btn) btn.disabled = true;
        _stopOtpTimer();
        return;
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent = `Code expires in ${m}:${String(s).padStart(2, '0')}`;
    el.style.color = '';
}

// ── OTP box helpers ────────────────────────────────────────────────────────────
function _getOtpValue() {
    let code = '';
    for (let i = 0; i < 6; i++) code += document.getElementById('authOtp' + i)?.value || '';
    return code;
}

function _clearOtpBoxes(markError) {
    for (let i = 0; i < 6; i++) {
        const box = document.getElementById('authOtp' + i);
        if (!box) continue;
        if (markError) {
            box.classList.add('otp-error');
        } else {
            box.value = '';
            box.classList.remove('otp-filled', 'otp-error');
        }
    }
    if (!markError) document.getElementById('authOtp0')?.focus();
}

function authOtpInput(el, idx) {
    const raw = el.value.replace(/\D/g, '');
    if (raw.length > 1) {
        // Paste: fill from current position
        const digits = raw.slice(0, 6 - idx);
        for (let i = 0; i < digits.length; i++) {
            const box = document.getElementById('authOtp' + (idx + i));
            if (box) { box.value = digits[i]; box.classList.remove('otp-error'); box.classList.add('otp-filled'); }
        }
        const lastIdx = Math.min(idx + digits.length - 1, 5);
        document.getElementById('authOtp' + lastIdx)?.focus();
        if (idx + digits.length >= 6) { setTimeout(authCheckOtp, 80); }
        return;
    }
    el.value = raw ? raw[0] : '';
    el.classList.remove('otp-error');
    el.classList.toggle('otp-filled', !!el.value);
    if (el.value && idx < 5) document.getElementById('authOtp' + (idx + 1))?.focus();
    if (idx === 5 && el.value && _getOtpValue().length === 6) setTimeout(authCheckOtp, 80);
}

function authOtpPaste(e, el, idx) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const digits = text.replace(/\D/g, '').slice(0, 6 - idx);
    if (!digits) return;
    for (let i = 0; i < digits.length; i++) {
        const box = document.getElementById('authOtp' + (idx + i));
        if (box) { box.value = digits[i]; box.classList.remove('otp-error'); box.classList.add('otp-filled'); }
    }
    const lastIdx = Math.min(idx + digits.length - 1, 5);
    document.getElementById('authOtp' + lastIdx)?.focus();
    if (idx + digits.length >= 6) setTimeout(authCheckOtp, 80);
}

function authOtpKey(e, el, idx) {
    if (e.key === 'Backspace' && !el.value && idx > 0) {
        const prev = document.getElementById('authOtp' + (idx - 1));
        if (prev) { prev.value = ''; prev.classList.remove('otp-filled', 'otp-error'); prev.focus(); }
    }
    if (e.key === 'ArrowLeft' && idx > 0) document.getElementById('authOtp' + (idx - 1))?.focus();
    if (e.key === 'ArrowRight' && idx < 5) document.getElementById('authOtp' + (idx + 1))?.focus();
}

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
                _stopOtpTimer();
            }
        }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();

// ── Screen management ──────────────────────────────────────────────────────────
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

    if (screen === 'verify') {
        _startOtpTimer();
        setTimeout(() => document.getElementById('authOtp0')?.focus(), 100);
    } else {
        _stopOtpTimer();
    }
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

            // Generate OTP and send via EmailJS
            const otp = _genOTP();
            await _storeOTP(otp, email);
            _ssSet('pending_name',  name);
            _ssSet('pending_email', email);

            await _sendOTPEmail(email, name, otp);

            // Show verify screen
            const addr = document.getElementById('authVerifyEmailAddr');
            if (addr) addr.textContent = email;
            authShowScreen('verify');
            _clearOtpBoxes(false);

            if (typeof showToast === 'function')
                showToast('Check your inbox (and spam) for the 6-digit code.', 'Code sent!');
        } catch (err) {
            _showErr('authSignupErr', err.message || _friendly(err));
        } finally {
            _setLoading(false);
        }
        return;
    }
}

// ── OTP verification ───────────────────────────────────────────────────────────
async function authCheckOtp() {
    if (_authBusy) return;
    const code = _getOtpValue();
    if (code.length !== 6) { _showErr('authVerifyErr', 'Enter all 6 digits of the code.'); return; }

    const email = _ssGet('pending_email');
    if (!email) {
        _showErr('authVerifyErr', 'Session expired. Please sign up again.');
        authShowScreen('signup');
        return;
    }

    _setLoading(true); _authClearErr();
    try {
        const result = await _checkOTP(code, email);

        if (!result.ok) {
            _clearOtpBoxes(true);
            if (result.reason === 'expired') {
                _showErr('authVerifyErr', 'Code expired. Click "Resend Code" for a new one.');
            } else if (result.reason === 'locked') {
                _showErr('authVerifyErr', 'Too many incorrect attempts. Click "Resend Code" to start over.');
            } else if (result.reason === 'no_otp') {
                _showErr('authVerifyErr', 'No active code found. Click "Resend Code".');
            } else {
                const left = 5 - (result.attempts || 0);
                _showErr('authVerifyErr', `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`);
            }
            return;
        }

        // OTP correct — create Firebase account
        const name = _ssGet('pending_name') || '';
        const pass = document.getElementById('authSignupPassword')?.value || '';
        if (!pass) {
            _showErr('authVerifyErr', 'Session expired. Please go back and sign up again.');
            _clearOTPSession();
            authShowScreen('signup');
            return;
        }

        const cred = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
        // updateProfile immediately to set displayName before ensureUserProfile race
        await cred.user.updateProfile({ displayName: name });

        // Write name to Firestore profiles collection — overwrites any 'Papiano User' from race
        if (typeof firestoreDb !== 'undefined' && firestoreDb && name) {
            try {
                await firestoreDb.collection('profiles').doc(cred.user.uid).set(
                    { name: name, searchName: name.toLowerCase() },
                    { merge: true }
                );
            } catch (_) {}
        }

        _clearOTPSession();
        _stopOtpTimer();

        if (typeof ensureUserProfile === 'function') await ensureUserProfile(cred.user);
        if (typeof closeAuthEntryPopup === 'function') closeAuthEntryPopup();
        if (typeof showToast === 'function') showToast('Welcome to Papiano!', 'Account created');
    } catch (err) {
        if (err?.code === 'auth/email-already-in-use') {
            _showErr('authVerifyErr', 'This email is already registered. Please sign in instead.');
            setTimeout(() => authShowScreen('signin'), 1800);
        } else {
            _showErr('authVerifyErr', _friendly(err));
        }
        _clearOtpBoxes(true);
    } finally {
        _setLoading(false);
    }
}

async function authResendOtp() {
    const email = _ssGet('pending_email');
    const name  = _ssGet('pending_name') || '';
    if (!email) {
        _showErr('authVerifyErr', 'Session expired. Please sign up again.');
        authShowScreen('signup');
        return;
    }

    try {
        const otp = _genOTP();
        await _storeOTP(otp, email);
        await _sendOTPEmail(email, name, otp);
        _clearOtpBoxes(false);
        _stopOtpTimer(); _startOtpTimer();
        _showErr('authVerifyErr', '');
        const btn = document.getElementById('authVerifyBtn');
        if (btn) btn.disabled = false;
        if (typeof showToast === 'function') showToast('New code sent! Check your inbox.', 'Resent');
    } catch (err) {
        _showErr('authVerifyErr', err.message || _friendly(err));
    }
}

// ── Delete account — email re-auth wrapper ─────────────────────────────────────
// Patches deletePapianoAccount() to handle email/password re-authentication
// (Firebase requires recent login before user.delete())
(function () {
    function patch() {
        const orig = window.deletePapianoAccount;
        if (typeof orig !== 'function') return;
        window.deletePapianoAccount = async function () {
            const user = typeof firebaseAuth !== 'undefined' ? firebaseAuth?.currentUser : null;
            if (user?.email) {
                let methods = [];
                try { methods = await firebaseAuth.fetchSignInMethodsForEmail(user.email); } catch (_) {}
                if (methods.includes('password')) {
                    const wrap = document.getElementById('accountDeletePasswordWrap');
                    const passEl = document.getElementById('accountDeletePasswordInput');
                    const pass = passEl?.value?.trim() || '';
                    if (!pass) {
                        if (wrap) wrap.style.display = '';
                        passEl?.focus();
                        if (typeof showToast === 'function') showToast('Enter your password to confirm deletion.', 'Required');
                        return;
                    }
                    try {
                        const cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
                        await user.reauthenticateWithCredential(cred);
                    } catch (_) {
                        if (passEl) passEl.value = '';
                        if (typeof showToast === 'function') showToast('Incorrect password. Account not deleted.', 'Error');
                        return;
                    }
                }
            }
            return orig.call(window);
        };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patch);
    else setTimeout(patch, 500); // defer so app.min.js defines deletePapianoAccount first
})();

// ── Password reset ─────────────────────────────────────────────────────────────
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
