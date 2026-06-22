    (function ensureIconsReady() {
        const reveal = () => document.body && document.body.classList.add('icons-ready');
        if (document.fonts && document.fonts.ready) {
            document.fonts.load('24px "Material Symbols Rounded"').catch(() => {});
            document.fonts.ready.then(() => {
                if (document.fonts.check('24px "Material Symbols Rounded"')) reveal();
                else setTimeout(reveal, 1200);
            });
        }
        setTimeout(reveal, 2500);
        if (document.readyState !== 'loading') reveal();
        else document.addEventListener('DOMContentLoaded', () => setTimeout(reveal, 300));
    })();

    const mainAppScreen = document.getElementById('mainAppScreen');
    const appContainer = document.getElementById('appContainer');
    const fsIcon = document.getElementById('fsIcon');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const appTopBar = document.getElementById('appTopBar');

    const displayProfileName = document.getElementById('displayProfileName');
    const displayProfileRole = document.getElementById('displayProfileRole');
    const displayProfileId = document.getElementById('displayProfileId');
    const displayTotalPlayTrack = document.getElementById('displayTotalPlayTrack');
    const displayProfilePlayPill = document.getElementById('displayProfilePlayPill');
    const displayAuthStatus = document.getElementById('displayAuthStatus');
    const formInputName = document.getElementById('formInputName');
    const accountLockedUserId = document.getElementById('accountLockedUserId');
    const accountLockedTotalPlay = document.getElementById('accountLockedTotalPlay');
    const accountDeleteOverlay = document.getElementById('accountDeleteOverlay');
    const accountDeleteIdInput = document.getElementById('accountDeleteIdInput');
    const accountDeleteConfirmBtn = document.getElementById('accountDeleteConfirmBtn');
    const accountRestrictionOverlay = document.getElementById('accountRestrictionOverlay');
    const accountRestrictionTitle = document.getElementById('accountRestrictionTitle');
    const accountRestrictionText = document.getElementById('accountRestrictionText');
    const accountRestrictionAppeal = document.getElementById('accountRestrictionAppeal');
    const formInputDesc = document.getElementById('formInputDesc');
    const formInputPhotoUrl = document.getElementById('formInputPhotoUrl');
    const profilePhotoFilePicker = document.getElementById('profilePhotoFilePicker');
    const chatImageFilePicker = document.getElementById('chatImageFilePicker');
    const chatSelectedImagePreview = document.getElementById('chatSelectedImagePreview');
    const chatSelectedImagePreviewImg = document.getElementById('chatSelectedImagePreviewImg');
    const chatSelectedImagePreviewText = document.getElementById('chatSelectedImagePreviewText');
    const masterPlaceholderIcon = document.getElementById('masterPlaceholderIcon');
    const masterAvatarImg = document.getElementById('masterAvatarImg');
    const authEntryOverlay = document.getElementById('authEntryOverlay');
    const authEntryTitle = document.getElementById('authEntryTitle');
    const authEntrySubtitle = document.getElementById('authEntrySubtitle');
    const soonPopupToast = document.getElementById('soonPopupToast');
    const soonPopupTitle = document.getElementById('soonPopupTitle');
    const soonPopupText = document.getElementById('soonPopupText');
    const chatInputBar = document.querySelector('.chat-input-bar');
    const chatMasterWrapperBox = document.getElementById('chatMasterWrapperBox');
    const friendSearchField = document.getElementById('friendSearchField');
    const chatEmptyRow = document.getElementById('chatEmptyRow');
    const chatOverlayRoom = document.getElementById('chatOverlayRoom');
    const chatRoomActiveTitle = document.getElementById('chatRoomActiveTitle');
    const chatMessagesScrollArea = document.getElementById('chatMessagesScrollArea');
    const chatInputFieldMessage = document.getElementById('chatInputFieldMessage');
    const chatInputCounter = document.getElementById('chatInputCounter');
    const chatRoomMenuBtn = document.getElementById('chatRoomMenuBtn');
    const chatToolsModal = document.getElementById('chatToolsModal');
    const activeReplyContextBar = document.getElementById('activeReplyContextBar');
    const replyContextTextPreview = document.getElementById('replyContextTextPreview');
    const chatNavUnreadBadge = document.getElementById('chatNavUnreadBadge');
    const friendRequestsBadge = document.getElementById('friendRequestsBadge');

    const appTabHeaderTitles = ['Papiano', 'Community', 'Account'];
    const tabPages = ['pageHome', 'pageChat', 'pageAccount'];
    let currentActiveTabIndex = 0;
    let nativeBackGuardReady = false;
    const storageKey = 'papiano_profile_cache_v2';
    const firebaseConfig = {
        apiKey: "AIzaSyAzjXvKk_1UvC0BaArsJk_Ep2WqIXhIcTY",
        authDomain: "papianoverse.firebaseapp.com",
        databaseURL: "https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "papianoverse",
        messagingSenderId: "240332627380",
        appId: "1:240332627380:web:c80d08fa1f89b1acdb26e1",
        measurementId: "G-3FVZ17Q69B"
    };

    const supabaseStorageConfig = {
        url: "https://yddzwxmzxdagiltrjmgc.supabase.co",
        key: "sb_publishable_OzcmvT0haHr9JrFhP9bHiA_EQpY86Ka"
    };

    let firebaseAuth = null;
    let realtimeDb = null;
    let firestoreDb = null;
    let supabaseStorageClient = null;

    let _authBootstrapped = false;

    function ensureFirebaseApp() {
        if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(firebaseConfig);
    }

    // Phase 1: auth only. Resolves the signed-in/out state as soon as possible
    // (no waiting for database/firestore/supabase to download).
    function initAuthEarly() {
        if (firebaseAuth) return;
        ensureFirebaseApp();
        firebaseAuth = firebase.auth();
        if (!_authBootstrapped) {
            _authBootstrapped = true;
            startPapianoAuthBootstrap();
        }
    }

    // Phase 2: the heavier clients. Also picks up a logged-in user that resolved
    // before Firestore was ready and finishes loading their profile.
    function initPapianoSDKs() {
        ensureFirebaseApp();
        if (!firebaseAuth) firebaseAuth = firebase.auth();
        realtimeDb = firebase.database();
        firestoreDb = firebase.firestore();
        try {
            supabaseStorageClient = window.supabase.createClient(
                supabaseStorageConfig.url,
                supabaseStorageConfig.key
            );
        } catch (_e) {
            // Supabase is only used for image uploads — not critical for
            // profile loading. Swallow the error so the boot continues.
            supabaseStorageClient = null;
        }
        if (!_authBootstrapped) {
            _authBootstrapped = true;
            startPapianoAuthBootstrap();
        }
        if (_deferredAuthUser) {
            const user = _deferredAuthUser;
            _deferredAuthUser = null;
            finishLoggedInBoot(user);
        }
    }

    if (window.__papianoAuthReady) {
        initAuthEarly();
    } else {
        window.addEventListener('papiano-auth-ready', initAuthEarly, { once: true });
    }
    if (window.__papianoSDKsReady) {
        initPapianoSDKs();
    } else {
        window.addEventListener('papiano-sdks-ready', initPapianoSDKs, { once: true });
    }

    let currentUser = null;
    let currentProfile = null;
    let authStateResolved = false;
    let _deferredAuthUser = null;
    let _authBootHidden = false;

    // Hide the boot overlay exactly once the auth state is known (or as a safety
    // fallback if the SDKs never load), so users never see a confusing flicker
    // between "logged out" and "logged in".
    function hideAuthBootOverlay() {
        if (_authBootHidden) return;
        _authBootHidden = true;
        const ov = document.getElementById('authBootOverlay');
        if (!ov) return;
        ov.classList.add('hide');
        setTimeout(() => { ov.remove(); }, 400);
    }
    setTimeout(() => { if (!authStateResolved) hideAuthBootOverlay(); }, 6000);
    let accessSessionActive = localStorage.getItem('papiano_access_session') === '1';
    let authEntryMode = 'signin';
    let authEntryBusy = false;
    let accountDeleteBusy = false;
    let profileSaveBusy = false;
    let friendProfiles = new Map();
    let pendingFriendRequests = new Map();
    let directChatProfiles = new Map();
    let searchProfiles = new Map();
    let messageProfiles = new Map();
    let leaderboardProfiles = new Map();
    let activeMessagesCache = new Map();
    let blockedUserIds = new Set();
    let blockedProfiles = new Map();
    let unsubscribeFriends = null;
    let unsubscribeRequests = null;
    let unsubscribeDirectChats = null;
    let unsubscribeBlocks = null;
    let unsubscribeMessages = null;
    let unsubscribeSystemRooms = [];
    let privateUnreadTotal = 0;
    let friendRequestUnreadTotal = 0;
    let systemUnreadTotal = 0;
    const LOCAL_READ_STORE_KEY_PREFIX = 'papiano_locally_read_rooms_';
    function getLocalReadStoreKey() {
        const uid = currentUser?.uid || '';
        return uid ? `${LOCAL_READ_STORE_KEY_PREFIX}${uid}` : 'papiano_locally_read_rooms_v1';
    }
    function loadLocallyReadRooms() {
        try {
            const raw = localStorage.getItem(getLocalReadStoreKey());
            const obj = raw ? JSON.parse(raw) : {};
            return new Map(Object.entries(obj).map(([k, v]) => [k, Number(v) || 0]));
        } catch (e) { return new Map(); }
    }
    let locallyReadRooms = loadLocallyReadRooms();
    function persistLocallyReadRooms() {
        try {
            const obj = {};
            locallyReadRooms.forEach((v, k) => { obj[k] = v; });
            localStorage.setItem(getLocalReadStoreKey(), JSON.stringify(obj));
        } catch (e) {}
    }
    function reloadLocallyReadRooms() {
        locallyReadRooms = loadLocallyReadRooms();
    }
    function markRoomLocallyRead(roomId) {
        if (!roomId) return;
        locallyReadRooms.set(roomId, Date.now());
        persistLocallyReadRooms();
    }

    let activeChatRoomId = '';
    let activeChatRoomType = '';
    let activeChatTargetUid = '';
    let currentChatSubView = 'chats';
    let selectedBadgeId = 'common';
    // Master role registry (loaded from Realtime DB at /roles, admin-managed).
    // Always includes 'common' (PLAYER) as the universal baseline.
    const BASE_ROLE_REGISTRY = {
        common: { label: 'PLAYER', rarity: 'common', permissions: [] }
    };
    let roleRegistry = { ...BASE_ROLE_REGISTRY };
    let rolesRef = null;
    let rolesHandler = null;
    let deletedAccountRef = null;
    let deletedAccountHandler = null;
    let pendingChatImageData = '';
    let pendingChatImagePath = '';
    let activeReplyMessage = null;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeMoved = false;
    let profileSearchTimer = null;
    let lastProfileSearchQuery = '';
    let toastTimer = null;
    let carouselIndex = 0;
    let carouselTimer = null;
    let carouselAutoPaused = false;
    let carouselPointerId = null;
    let carouselDragStartX = 0;
    let carouselDragWidth = 0;
    let carouselDragMoved = false;
    let lastMessageSentAt = 0;
    let lastFriendRequestSentAt = 0;
    let activeReportContext = null;
    let profileReactionBusy = false;
    let playTimeStartedAt = 0;
    let playTimeTimer = null;
    let playTimeDisplayTicker = null;
    let activeLeaderboardBoard = 'playtime';
    let unsubscribeLeaderboardPlayTime = null;
    let unsubscribeLeaderboardDonation = null;
    const MAX_CHAT_MESSAGE_CHARS = 500;
    const MESSAGE_COOLDOWN_MS = 800;
    const FRIEND_REQUEST_COOLDOWN_MS = 3000;
    const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
    const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
    const LEADERBOARD_VISIBLE_LIMIT = 10;
    const DONATION_GOAL_USD = 100;
    const PLAYTIME_SYNC_MS = 60000;
    const ANNOUNCEMENT_OWNER_EMAILS = new Set(['akunpolos0444000@gmail.com', 'papianobase@gmail.com']);

    const ROLE_PATH = 'roles';
    const DELETED_ACCOUNTS_PATH = 'deletedAccounts';

    function normalizeRoleId(value) {
        const id = String(value || 'common').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
        return id || 'common';
    }

    function normalizeRoleRegistry(data = {}) {
        // Admin-defined roles in /roles RTDB get merged on top of the base
        // (PLAYER). If RTDB has nothing, the picker still has PLAYER.
        const next = { ...BASE_ROLE_REGISTRY };
        Object.entries(data || {}).forEach(([id, role]) => {
            const roleId = normalizeRoleId(id);
            const label = String(role?.label || role?.name || roleId).trim().slice(0, 28);
            const rarity = String(role?.rarity || 'common').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'common';
            next[roleId] = { ...role, label: label || roleId.toUpperCase(), rarity };
        });
        return next;
    }

    const roomTitles = {
        announcements: 'Announcement',
        global: 'Global Chat',
        feedback: 'Suggestions & Feedback'
    };

    const TOAST_ICON = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
        email: 'mark_email_unread'
    };
    // Known toast titles → visual type, so the existing showToast(msg, 'Title')
    // call sites light up with the right colour + icon without being touched.
    const TOAST_TITLE_TYPE = {
        'connected': 'success', 'verified': 'success', 'password added': 'success',
        'done': 'success', 'saved': 'success', 'success': 'success', 'welcome': 'success',
        'friends': 'success', 'chat': 'success',
        'error': 'error', 'failed': 'error',
        'unavailable': 'warning', 'required': 'warning', 'locked': 'warning',
        'offline': 'warning', 'heads up': 'warning', 'connect google': 'warning',
        'google account': 'warning',
        'email sent': 'email', 'resent': 'email', 'verify your email': 'email'
    };
    // Most untitled toasts are errors (showToast('Couldn't…')) with no title to
    // map, so fall back to sniffing the message for clear failure wording.
    const TOAST_ERROR_HINT = /(couldn|can.?t|cannot|unable|failed|wrong|invalid|denied|not found|no access|went wrong|too many|try again|already (in use|registered|taken)|expired|disabled|restricted)/i;

    // A single themed toast: pass a string title for the simple case, or an
    // { title, type, icon, duration } object to override. Type drives the icon,
    // accent colour and the depleting progress bar.
    function showToast(message, opts) {
        if (typeof opts === 'string') opts = { title: opts };
        opts = opts || {};
        if (!soonPopupToast || !soonPopupText) return;
        let title = opts.title || '';
        let type = opts.type || TOAST_TITLE_TYPE[title.toLowerCase()];
        if (!type) {
            // Untitled / unmapped toast — sniff the message so the many
            // showToast('Couldn't…') error calls render red, not neutral blue.
            type = TOAST_ERROR_HINT.test(message || '') ? 'error' : 'info';
        }
        if (!title) title = type === 'error' ? 'Error' : type === 'success' ? 'Done' : 'Info';
        const duration = opts.duration || (type === 'error' ? 4200 : type === 'email' ? 3800 : 2600);

        if (soonPopupTitle) soonPopupTitle.textContent = title;
        soonPopupText.textContent = message || 'Action completed.';

        const iconEl = soonPopupToast.querySelector('.material-symbols-rounded');
        if (iconEl) {
            iconEl.textContent = opts.icon || TOAST_ICON[type] || 'info';
            iconEl.setAttribute('aria-hidden', 'true');
        }

        soonPopupToast.classList.remove('t-success', 't-error', 't-warning', 't-info', 't-email');
        soonPopupToast.classList.add('t-' + type);

        let bar = soonPopupToast.querySelector('.soon-popup-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'soon-popup-bar';
            soonPopupToast.appendChild(bar);
        }
        bar.style.animation = 'none';
        void bar.offsetWidth; // reflow so the countdown restarts on every toast
        bar.style.animation = 'toastBarDeplete ' + duration + 'ms linear forwards';

        soonPopupToast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => soonPopupToast.classList.remove('show'), duration);
    }

    function showSoonFeature(featureName) {
        const cleanName = String(featureName || 'Feature').trim() || 'Feature';
        showToast(`${cleanName} is locked.`, 'Locked');
    }

    function openAccountRestrictionModal(options = {}) {
        if (soonPopupToast) soonPopupToast.classList.remove('show');
        if (accountRestrictionTitle) accountRestrictionTitle.textContent = options.title || 'Account permanently blocked';
        if (accountRestrictionText) accountRestrictionText.textContent = options.message || 'Your account has been permanently blocked from Papiano online features.';
        if (accountRestrictionAppeal) accountRestrictionAppeal.textContent = options.appeal || 'If you believe this is a mistake, contact us on Discord to submit an appeal.';
        accountRestrictionOverlay?.classList.add('active');
        accountRestrictionOverlay?.setAttribute('aria-hidden', 'false');
    }

    function closeAccountRestrictionModal() {
        accountRestrictionOverlay?.classList.remove('active');
        accountRestrictionOverlay?.setAttribute('aria-hidden', 'true');
        openAuthEntryPopup('signin');
    }

    function isAccountRestrictionError(error) {
        const raw = String(error?.code || error?.message || '').toLowerCase();
        return raw.includes('user-disabled') || raw.includes('account data was removed by moderation') || raw.includes('permanently blocked') || raw.includes('account restricted');
    }

    function showAccountRestrictionNotice() {
        openAccountRestrictionModal({
            title: 'Account permanently blocked',
            message: 'Your account has been permanently blocked from Papiano online features.',
            appeal: 'If you believe this is a mistake, contact us on Discord to submit an appeal.'
        });
    }

    function friendlyError(error, fallback) {
        const raw = String(error?.message || error?.code || '').toLowerCase();
        if (!raw) return fallback;
        if (raw.includes('invalid-email')) return 'Enter a valid email address.';
        if (raw.includes('email-already-in-use')) return 'That email is already registered. Sign in instead.';
        if (raw.includes('user-not-found') || raw.includes('wrong-password') || raw.includes('invalid-credential')) return 'Email or password is incorrect.';
        if (raw.includes('weak-password')) return 'Use at least 6 characters for your password.';
        if (raw.includes('too-many-requests')) return 'Too many attempts. Try again later.';
        if (raw.includes('popup-closed')) return 'Sign in was cancelled.';
        if (raw.includes('user-disabled')) return 'Your account has been restricted from Papiano online features.';
        if (raw.includes('permission') || raw.includes('insufficient')) return 'You don\u2019t have access to do that.';
        if (raw.includes('index')) return 'Still getting things ready \u2014 try again in a moment.';
        if (raw.includes('unavailable') || raw.includes('network') || raw.includes('offline') || raw.includes('failed to get')) return 'Connection problem. Check your internet and try again.';
        if (raw.includes('not-found') || raw.includes('no document')) return 'This content is no longer available.';
        if (raw.includes('quota') || raw.includes('resource-exhausted')) return 'The server is busy right now. Please try again soon.';
        if (raw.includes('unauthenticated') || raw.includes('sign in') || raw.includes('auth')) return 'Please sign in to continue.';
        return fallback;
    }

    function updateChatInputCounter() {
        if (!chatInputCounter) return;
        const length = Math.min(MAX_CHAT_MESSAGE_CHARS, String(chatInputFieldMessage?.value || '').length);
        chatInputCounter.textContent = `${length}/${MAX_CHAT_MESSAGE_CHARS}`;
        chatInputCounter.classList.toggle('is-warn', length >= Math.floor(MAX_CHAT_MESSAGE_CHARS * 0.96));
    }

    function autoGrowChatInput(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    function handleChatInputChange(el) {
        if (!el) return;
        if (el.value.length > MAX_CHAT_MESSAGE_CHARS) {
            el.value = el.value.slice(0, MAX_CHAT_MESSAGE_CHARS);
            showToast(`Message limit is ${MAX_CHAT_MESSAGE_CHARS} characters.`);
        }
        autoGrowChatInput(el);
        updateChatInputCounter();
    }

    function animateCountUp(el, finalText) {
        if (!el) return;
        const str = String(finalText);
        const match = str.match(/^(\d[\d,]*)(.*)$/);
        if (!match) { el.textContent = str; return; }
        const target = parseInt(match[1].replace(/,/g, ''), 10);
        const suffix = match[2] || '';
        if (!isFinite(target) || target <= 0) { el.textContent = str; return; }
        const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced || target < 2) { el.textContent = str; return; }
        const duration = 700;
        const start = performance.now();
        function tick(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            el.textContent = Math.round(target * eased).toLocaleString() + suffix;
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = str;
        }
        requestAnimationFrame(tick);
    }

    function openMainApp() {
        appContainer.classList.remove('auth-pending');
        mainAppScreen.classList.add('active');
        updateProfileView(loadProfile());
        if (currentUser?.uid) {
            startPlayTimeTracker();
            if (firestoreDb) startCommunityListeners();
        } else {
            pausePlayTimeTracker(false);
            stopCommunityListeners();
            stopLeaderboardListeners();
        }
        startCarousel();
        setupTopBarAutoHide();
        updateHomeTopBarVisibility();
    }

    function showLoginScreen() {
        pausePlayTimeTracker(false);
        stopCommunityListeners();
        stopRoleRegistryListener();
        stopDeletedAccountWatcher();
        accessSessionActive = true;
        currentUser = null;
        activeChatRoomId = '';
        activeChatRoomType = '';
        activeChatTargetUid = '';
        document.getElementById('authGateOverlay')?.style.setProperty('display', 'none');
        openMainApp();
    }

    function startRoleRegistryListener() {
        if (rolesRef || !realtimeDb || !currentUser?.uid) return;
        rolesRef = realtimeDb.ref(ROLE_PATH);
        rolesHandler = snapshot => {
            roleRegistry = normalizeRoleRegistry(snapshot.val() || {});
            updateProfileView(loadProfile());
            if (document.getElementById('brandSheetOverlay')?.classList.contains('active')) populateBrandSheet();
        };
        rolesRef.on('value', rolesHandler);
    }

    function stopRoleRegistryListener() {
        if (rolesRef && rolesHandler) rolesRef.off('value', rolesHandler);
        rolesRef = null;
        rolesHandler = null;
    }

    function stopDeletedAccountWatcher() {
        if (deletedAccountRef && deletedAccountHandler) deletedAccountRef.off('value', deletedAccountHandler);
        deletedAccountRef = null;
        deletedAccountHandler = null;
    }

    const ADMIN_GATE_EMAILS = new Set(['utamairfan44@gmail.com', 'akunpolos0444000@gmail.com', 'papianobase@gmail.com']);

    async function isAccountDeleted(uid, email) {
        if (!uid || !realtimeDb) return false;
        // Admin emails can never be flagged as deleted — they are the moderators.
        if (email && ADMIN_GATE_EMAILS.has(String(email).toLowerCase())) return false;
        try {
            const snapshot = await realtimeDb.ref(`${DELETED_ACCOUNTS_PATH}/${uid}`).once('value');
            return Boolean(snapshot.val()?.deleted);
        } catch (_e) {
            // RTDB read can fail due to transient auth-token propagation delay
            // or network issues. Treat as "not deleted" so profile loading
            // continues — the real-time watcher will catch it later if needed.
            return false;
        }
    }

    async function exitDeletedAccount() {
        localStorage.removeItem(storageKey);
        currentProfile = null;
        accessSessionActive = false;
        try { await firebaseAuth.signOut(); } catch (_error) {}
        showLoginScreen();
        showAccountRestrictionNotice();
    }

    function startDeletedAccountWatcher(uid) {
        stopDeletedAccountWatcher();
        if (!uid || !realtimeDb) return;
        // Admin emails are immune to the deleted-account gate.
        const email = currentUser?.email || '';
        if (ADMIN_GATE_EMAILS.has(String(email).toLowerCase())) return;
        deletedAccountRef = realtimeDb.ref(`${DELETED_ACCOUNTS_PATH}/${uid}`);
        deletedAccountHandler = snapshot => {
            if (snapshot.val()?.deleted) exitDeletedAccount();
        };
        deletedAccountRef.on('value', deletedAccountHandler);
    }

    function setAuthEntryMode(mode) {
        authEntryMode = 'signin';
        authEntryOverlay?.classList.remove('is-signup');
        if (authEntryTitle) authEntryTitle.textContent = 'Log in';
        if (authEntrySubtitle) authEntrySubtitle.textContent = 'Use Google to sync your profile, chat, friends, leaderboard, and multiplayer features.';
    }

    function openAuthEntryPopup(mode = 'signin') {
        setAuthEntryMode('signin');
        authEntryOverlay?.classList.add('active');
        authEntryOverlay?.setAttribute('aria-hidden', 'false');
        setTimeout(() => document.getElementById('authEntryGoogleBtn')?.focus(), 80);
    }

    function closeAuthEntryPopup() {
        authEntryOverlay?.classList.remove('active');
        authEntryOverlay?.setAttribute('aria-hidden', 'true');
    }

    function setAuthEntryBusy(isBusy) {
        authEntryBusy = !!isBusy;
        const googleButton = document.getElementById('authEntryGoogleBtn');
        if (googleButton) {
            googleButton.disabled = authEntryBusy;
            const label = googleButton.querySelector('span');
            if (label) label.textContent = authEntryBusy ? 'Please wait...' : 'Login with Google';
        }
    }

    async function authEntryWithGoogle() {
        closeAuthEntryPopup();
        await processAppAuth('google');
    }

    async function processAppAuth(mode) {
        if (mode === 'google') {
            // Guard against the user clicking before lazy-loaded SDKs are ready.
            if (!firebaseAuth || typeof firebase === 'undefined') {
                showToast('Hold on, signing-in service is still loading…', 'Please wait');
                // Retry once SDKs are ready.
                window.addEventListener('papiano-sdks-ready', () => processAppAuth('google'), { once: true });
                return;
            }
            accessSessionActive = false;
            try {
                appContainer.classList.add('auth-pending');
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await firebaseAuth.signInWithPopup(provider);
                await ensureUserProfile(result.user);
            } catch (error) {
                appContainer.classList.remove('auth-pending');
                if (error?.code === 'auth/account-exists-with-different-credential') {
                    await handleGoogleSignInConflict(error);
                    return;
                }
                if (isAccountRestrictionError(error)) {
                    try { await firebaseAuth.signOut(); } catch (_error) {}
                    showLoginScreen();
                    showAccountRestrictionNotice();
                    return;
                }
                showToast(friendlyError(error, 'Sign in didn’t work. Please try again.'));
            }
            return;
        }
        accessSessionActive = true;
        currentUser = null;
        currentProfile = loadProfile();
        openMainApp();
    }

    // Google sign-in hit an email that already has a password account. Ask the
    // user to sign in with that password; the pending Google credential is then
    // linked in the email sign-in success path (auth-email.js), so both methods
    // end up on one account instead of erroring out.
    async function handleGoogleSignInConflict(error) {
        const email = error?.email || error?.customData?.email || '';
        let pendingCred = error?.credential || null;
        try {
            if (!pendingCred && firebase?.auth?.GoogleAuthProvider?.credentialFromError) {
                pendingCred = firebase.auth.GoogleAuthProvider.credentialFromError(error);
            }
        } catch (_) {}
        if (!email || !pendingCred) {
            showToast('Couldn’t connect Google automatically. Sign in with your email instead.');
            return;
        }
        let methods = [];
        try { methods = await firebaseAuth.fetchSignInMethodsForEmail(email); } catch (_) {}
        if (methods.includes('password')) {
            window._pendingGoogleLinkCredential = pendingCred;
            openAuthEntryPopup('signin');
            const emailInput = document.getElementById('authSigninEmail');
            if (emailInput) emailInput.value = email;
            showToast('This email already uses a password. Sign in to connect Google.', 'Connect Google');
        } else {
            showToast('This email is registered with a different sign-in method.');
        }
    }

    function populateBrandSheet() {
        const profile = currentProfile || loadProfile() || {};
        const signedIn = !!currentUser;
        const nameEl = document.getElementById('brandSheetName');
        const roleEl = document.getElementById('brandSheetRole');
        const avImg = document.getElementById('brandSheetAvatarImg');
        const avIcon = document.querySelector('#brandSheetAvatar .material-symbols-rounded');
        const authBtn = document.getElementById('brandSheetAuthBtn');
        const authLabel = document.getElementById('brandSheetAuthLabel');
        const authIcon = document.getElementById('brandSheetAuthIcon');

        if (nameEl) nameEl.textContent = profile.name || 'Papiano Player';
        if (roleEl) roleEl.textContent = signedIn ? 'Profile Menu' : 'Papiano';

        if (avImg && avIcon) {
            applyAvatarSlot(avImg, avIcon, profile.photoURL, profile.name, signedIn, signedIn ? 'person' : 'account_circle');
        }

        if (authBtn && authLabel && authIcon) {
            authBtn.classList.toggle('is-signout', signedIn);
            authBtn.classList.toggle('is-signin', !signedIn);
            authLabel.textContent = signedIn ? 'Sign out' : 'Sign in';
            authIcon.textContent = signedIn ? 'logout' : 'login';
            authBtn.style.display = 'inline-flex';
        }
        // Mirror auth state into the desktop sidebar button (always visible)
        const sideBtn = document.getElementById('sidebarAuthBtn');
        const sideLabel = document.getElementById('sidebarAuthLabel');
        const sideIcon = document.getElementById('sidebarAuthIcon');
        if (sideBtn && sideLabel && sideIcon) {
            sideBtn.classList.toggle('is-signout', signedIn);
            sideBtn.classList.toggle('is-signin', !signedIn);
            sideLabel.textContent = signedIn ? 'Sign out' : 'Sign in';
            sideIcon.textContent = signedIn ? 'logout' : 'login';
        }
    }

    function openBrandSheet() {
        populateBrandSheet();
        document.getElementById('brandSheetOverlay')?.classList.add('active');
    }

    function closeBrandSheet(event) {
        if (event && event.target !== document.getElementById('brandSheetOverlay')) return;
        document.getElementById('brandSheetOverlay')?.classList.remove('active');
    }

    function brandSheetOpenSubPage(id) {
        document.getElementById('brandSheetOverlay')?.classList.remove('active');
        launchSubPageReferenceNode(id);
    }

    function brandSheetOpenAccount() {
        document.getElementById('brandSheetOverlay')?.classList.remove('active');
        navigateActiveTab(2, appTabHeaderTitles[2]);
    }

    function brandSheetAuthAction() {
        document.getElementById('brandSheetOverlay')?.classList.remove('active');
        if (currentUser) {
            logoutPapianoAccount();
        } else {
            // Sidebar (desktop) shows this button as Sign in when logged out;
            // route the click to the same Google sign-in flow used elsewhere.
            processAppAuth('google');
        }
    }

    async function logoutPapianoAccount() {
        try {
            // Mark multiplayer presence offline + stop the heartbeat before
            // signing out, so a logged-out account doesn't linger as "online".
            if (_mpPresenceRef) {
                try { _mpPresenceRef.onDisconnect().cancel(); } catch (_e) {}
                try { await _mpPresenceRef.update({ online: false, updatedAt: Date.now() }); } catch (_e) {}
                _mpPresenceRef = null;
            }
            await firebaseAuth.signOut();
        } catch (_error) {}
        // Clear profile cache so UI resets to default (no stale name/avatar)
        localStorage.removeItem(storageKey);
        // Reset in-memory state
        privateUnreadTotal = 0;
        friendRequestUnreadTotal = 0;
        currentProfile = null;
        serverBaseSeconds = 0;
        playTimePendingDelta = 0;
        updateNotificationBadges();
        // NOTE: Do NOT clear locallyReadRooms / LOCAL_READ_STORE_KEY here.
        // These room-read markers remain valid after re-login (same user)
        // and prevent the unread badge from flashing on re-authentication.
        showLoginScreen();
    }

    function parsePublicIdInput(value) {
        const raw = String(value || '').trim();
        const digits = raw.replace(/[^0-9]/g, '');
        const id = Number(digits || 0);
        return Number.isInteger(id) && id > 0 ? id : 0;
    }

    function getCurrentPublicIdNumber() {
        const profile = currentProfile || loadProfile() || {};
        const fromPublicId = Number(profile.publicId || 0);
        if (Number.isInteger(fromPublicId) && fromPublicId > 0) return fromPublicId;
        return parsePublicIdInput(profile.userId || '');
    }

    function setDeleteAccountBusy(isBusy) {
        accountDeleteBusy = !!isBusy;
        if (accountDeleteConfirmBtn) {
            accountDeleteConfirmBtn.disabled = accountDeleteBusy;
            accountDeleteConfirmBtn.textContent = accountDeleteBusy ? 'Please wait...' : 'Delete Account';
        }
    }

    function openDeleteAccountModal() {
        if (!currentUser?.uid) {
            showToast('Sign in to manage your account.');
            openAuthEntryPopup('signin');
            return;
        }
        setDeleteAccountBusy(false);
        accountDeleteOverlay?.classList.remove('is-verify');
        accountDeleteOverlay?.classList.add('active');
        accountDeleteOverlay?.setAttribute('aria-hidden', 'false');
        if (accountDeleteIdInput) accountDeleteIdInput.value = '';
    }

    function closeDeleteAccountModal() {
        if (accountDeleteBusy) return;
        accountDeleteOverlay?.classList.remove('active', 'is-verify');
        accountDeleteOverlay?.setAttribute('aria-hidden', 'true');
        if (accountDeleteIdInput) accountDeleteIdInput.value = '';
    }

    function showDeleteAccountVerify() {
        const expectedId = getCurrentPublicIdNumber();
        if (!expectedId) {
            showToast('Account ID is not ready.');
            return;
        }
        accountDeleteOverlay?.classList.add('is-verify');
        if (accountDeleteIdInput) {
            accountDeleteIdInput.placeholder = formatPublicUserId(expectedId);
            setTimeout(() => accountDeleteIdInput.focus(), 80);
        }
    }

    async function deletePapianoAccount() {
        if (accountDeleteBusy) return;
        if (!currentUser?.uid) {
            closeDeleteAccountModal();
            showToast('Sign in to manage your account.');
            return;
        }
        const expectedId = getCurrentPublicIdNumber();
        const enteredId = parsePublicIdInput(accountDeleteIdInput?.value || '');
        if (!expectedId || enteredId !== expectedId) {
            showToast('Account ID does not match.');
            accountDeleteIdInput?.focus();
            return;
        }

        const user = firebaseAuth.currentUser;
        const uid = currentUser.uid;
        const publicId = expectedId;
        const userId = formatPublicUserId(publicId);
        try {
            setDeleteAccountBusy(true);
            stopCommunityListeners();
            stopLeaderboardListeners();
            stopDeletedAccountWatcher();
            pausePlayTimeTracker(true);

            if (realtimeDb) {
                await realtimeDb.ref(`${DELETED_ACCOUNTS_PATH}/${uid}`).set({
                    deleted: true,
                    publicId,
                    userId,
                    deletedAt: firebase.database.ServerValue.TIMESTAMP
                });
            }

            if (firestoreDb) {
                await firestoreDb.collection('profiles').doc(uid).delete().catch(async () => {
                    await firestoreDb.collection('profiles').doc(uid).set({
                        deleted: true,
                        name: 'Deleted Account',
                        searchName: 'deleted account',
                        desc: '',
                        bio: '',
                        photoURL: '',
                        avatarURL: '',
                        countryCode: '',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
            }

            try {
                await user?.delete();
            } catch (_error) {
                try { await firebaseAuth.signOut(); } catch (__error) {}
            }

            localStorage.removeItem(storageKey);
            localStorage.removeItem('papiano_access_session');
            currentUser = null;
            currentProfile = null;
            closeDeleteAccountModal();
            showLoginScreen();
            showToast('Account deleted.');
        } catch (error) {
            setDeleteAccountBusy(false);
            showToast('Couldn’t delete this account. Please try again.');
        }
    }

    function formatPublicUserId(value) {
        const id = Number(value || 0);
        return Number.isInteger(id) && id > 0 ? `#${id}` : '#—';
    }

    function safeUserId(uid) {
        return '#—';
    }

    function getInitials(name) {
        const clean = String(name || 'User').trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase();
    }

    // Render an avatar slot: photo if available, otherwise the first letter of
    // the signed-in name (email accounts have no photo), else a generic icon.
    function applyAvatarSlot(imgEl, iconEl, photoURL, name, signedIn, fallbackIcon) {
        if (!imgEl || !iconEl) return;
        if (signedIn && photoURL && isSafeImage(photoURL)) {
            imgEl.src = photoURL;
            imgEl.style.display = 'block';
            iconEl.style.display = 'none';
            iconEl.classList.remove('avatar-initial');
            return;
        }
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
        iconEl.style.display = '';
        const letter = signedIn ? String(name || '').trim().charAt(0).toUpperCase() : '';
        if (letter) {
            iconEl.classList.add('avatar-initial');
            iconEl.textContent = letter;
        } else {
            iconEl.classList.remove('avatar-initial');
            iconEl.textContent = fallbackIcon || 'account_circle';
        }
    }

    function countryCodeToFlag(code) {
        if (!code || code.length !== 2) return '';
        return code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)));
    }

    const countryNames = { AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AR:'Argentina',AU:'Australia',AT:'Austria',AZ:'Azerbaijan',BD:'Bangladesh',BE:'Belgium',BR:'Brazil',BG:'Bulgaria',KH:'Cambodia',CM:'Cameroon',CA:'Canada',CL:'Chile',CN:'China',CO:'Colombia',HR:'Croatia',CZ:'Czech Republic',DK:'Denmark',EG:'Egypt',ET:'Ethiopia',FI:'Finland',FR:'France',GH:'Ghana',DE:'Germany',GR:'Greece',GT:'Guatemala',HK:'Hong Kong',HU:'Hungary',IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IE:'Ireland',IL:'Israel',IT:'Italy',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',KE:'Kenya',KR:'South Korea',KW:'Kuwait',LY:'Libya',MY:'Malaysia',MX:'Mexico',MA:'Morocco',MM:'Myanmar',NP:'Nepal',NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',NO:'Norway',PK:'Pakistan',PS:'Palestine',PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',QA:'Qatar',RO:'Romania',RU:'Russia',SA:'Saudi Arabia',SN:'Senegal',RS:'Serbia',SG:'Singapore',ZA:'South Africa',ES:'Spain',LK:'Sri Lanka',SE:'Sweden',CH:'Switzerland',TW:'Taiwan',TZ:'Tanzania',TH:'Thailand',TN:'Tunisia',TR:'Turkey',UA:'Ukraine',AE:'UAE',GB:'United Kingdom',US:'United States',UZ:'Uzbekistan',VE:'Venezuela',VN:'Vietnam',YE:'Yemen' };

    function renderFlagRow(countryCode, targetEl) {
        if (!targetEl) return;
        const code = String(countryCode || '').toUpperCase();
        if (!code || code.length !== 2) { targetEl.style.display = 'none'; return; }
        const flag = countryCodeToFlag(code);
        const name = countryNames[code] || code;
        targetEl.style.display = 'flex';
        targetEl.innerHTML = `<span class="profile-flag-emoji">${flag}</span><span class="profile-flag-name">${name}</span>`;
    }

    async function detectAndSaveCountry(uid) {
        if (!uid || !firestoreDb) return;
        try {
            const snap = await firestoreDb.collection('profiles').doc(uid).get();
            if (snap.exists && snap.data()?.countryCode) return; // already set
            const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
            const data = await res.json();
            const code = String(data.country_code || '').toUpperCase();
            if (code.length === 2) {
                await firestoreDb.collection('profiles').doc(uid).set({ countryCode: code }, { merge: true });
                if (currentProfile) {
                    currentProfile.countryCode = code;
                    saveProfile(currentProfile);
                    updateProfileView(currentProfile);
                }
            }
        } catch (_) {}
    }

    function parsePlayTimeSeconds(data = {}) {
        const seconds = Number(data.playTimeSeconds);
        if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds);

        const label = String(data.playTime || '').trim().toLowerCase();
        if (!label) return 0;

        // New format: H:MM:SS
        const colonLong = label.match(/^(\d+):(\d{1,2}):(\d{2})$/);
        if (colonLong) {
            return (Number(colonLong[1]) * 3600) + (Number(colonLong[2]) * 60) + Number(colonLong[3]);
        }
        // New format: M:SS
        const colonShort = label.match(/^(\d+):(\d{2})$/);
        if (colonShort) {
            return (Number(colonShort[1]) * 60) + Number(colonShort[2]);
        }

        // Legacy format: "Xh Ym" or "X Min"
        const hourMatch = label.match(/(\d+)\s*h/);
        const minuteMatch = label.match(/(\d+)\s*(m|min)/);
        if (hourMatch || minuteMatch) {
            return (Number(hourMatch?.[1] || 0) * 3600) + (Number(minuteMatch?.[1] || 0) * 60);
        }

        const rawNumber = Number(label.match(/\d+/)?.[0] || 0);
        return Number.isFinite(rawNumber) && rawNumber > 0 ? rawNumber * 60 : 0;
    }

    function formatPlayTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }

    function formatPlayTimeHours(seconds) {
        const hours = Math.max(0, Math.floor((Number(seconds) || 0) / 3600));
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    function normalizeProfile(uid, data = {}) {
        const publicId = Number(data.publicId || 0);
        const playTimeSeconds = parsePlayTimeSeconds(data);
        const roleId = normalizeRoleId(data.roleId || data.badgeId || data.role || 'common');
        // ownedRoles = inventory of badges/roles the user has access to.
        // Default for everyone is just ['common'] (PLAYER). Admin panel can
        // grant extra roles by pushing more ids into this array on the
        // user's profile document.
        const rawOwned = Array.isArray(data.ownedRoles) ? data.ownedRoles : (Array.isArray(data.ownedBadges) ? data.ownedBadges : []);
        const ownedRolesSet = new Set(['common']);
        rawOwned.forEach(r => {
            const id = normalizeRoleId(r);
            if (id) ownedRolesSet.add(id);
        });
        // Sticky: keep the user's currently-active role visible in the picker
        // even if it hasn't been added to ownedRoles yet (e.g. legacy data).
        ownedRolesSet.add(roleId);
        return {
            uid,
            name: String(data.name || data.displayName || 'Papiano User').slice(0, 24),
            desc: String(data.desc || data.bio || '').slice(0, 160),
            roleId,
            badgeId: roleId,
            ownedRoles: [...ownedRolesSet],
            photoURL: String(data.photoURL || data.avatar_url || data.avatarURL || ''),
            playTimeSeconds,
            playTime: formatPlayTime(playTimeSeconds),
            publicId: Number.isInteger(publicId) && publicId > 0 ? publicId : 0,
            userId: (/^#\d+$/.test(String(data.userId || '')) ? data.userId : (publicId > 0 ? formatPublicUserId(publicId) : safeUserId(uid))),
            searchName: String(data.searchName || data.name || data.displayName || '').toLowerCase(),
            likes: Number(data.likes || 0),
            dislikes: Number(data.dislikes || 0),
            countryCode: String(data.countryCode || '').toUpperCase().slice(0, 2)
        };
    }

    function profileMatchesSearch(profile, query) {
        const raw = String(query || '').trim().toLowerCase();
        const q = raw.replace(/^#/, '');
        if (!q) return false;
        const publicId = String(profile.publicId || '').toLowerCase();
        const userId = String(profile.userId || '').toLowerCase().replace(/^#/, '');
        const uid = String(profile.uid || '').toLowerCase();
        if (/^\d+$/.test(q) && (q === publicId || q === userId)) return true;
        const haystack = [
            profile.name,
            profile.desc,
            profile.userId,
            profile.publicId,
            profile.searchName,
            uid
        ].join(' ').toLowerCase().replace(/#/g, '');
        return haystack.includes(q);
    }

    async function ensureUserProfile(user) {
        if (!user?.uid) return null;
        if (await isAccountDeleted(user.uid, user.email)) throw new Error('Account data was removed by moderation.');
        const profileRef = firestoreDb.collection('profiles').doc(user.uid);
        const counterRef = firestoreDb.collection('counters').doc('publicUserId');
        const base = {
            name: user.displayName || 'Papiano User',
            searchName: String(user.displayName || 'Papiano User').toLowerCase(),
            desc: '',
            badgeId: 'common',
            photoURL: user.photoURL || '',
            playTimeSeconds: 0,
            playTime: '0 Min',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const profileData = await firestoreDb.runTransaction(async transaction => {
            const snap = await transaction.get(profileRef);
            const oldData = snap.exists ? (snap.data() || {}) : {};
            let publicId = Number(oldData.publicId || 0);

            if (!Number.isInteger(publicId) || publicId < 1) {
                const counterSnap = await transaction.get(counterRef);
                const nextId = Number(counterSnap.exists ? counterSnap.data().next : 1) || 1;
                publicId = Math.max(1, nextId);
                transaction.set(counterRef, { next: publicId + 1 }, { merge: true });
            }

            const merged = {
                ...base,
                ...oldData,
                publicId,
                userId: formatPublicUserId(publicId),
                searchName: String(oldData.searchName || oldData.name || base.name || 'Papiano User').toLowerCase(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (!snap.exists) {
                transaction.set(profileRef, {
                    ...merged,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                transaction.set(profileRef, merged, { merge: true });
            }

            return merged;
        });

        try {
            const nameKey = String(profileData.name || '').trim().toLowerCase();
            if (nameKey) await firestoreDb.collection('displayNames').doc(nameKey).set({ uid: user.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (_) {}

        currentUser = user;
        currentProfile = normalizeProfile(user.uid, profileData);
        // Firestore is the source of truth for play time.
        // Set serverBaseSeconds from the authoritative Firestore value.
        serverBaseSeconds = Math.max(0, Number(currentProfile.playTimeSeconds) || 0);
        // Reload per-user read markers so badge logic uses correct data
        reloadLocallyReadRooms();
        saveProfile(currentProfile);
        updateProfileView(currentProfile);
        closeAuthEntryPopup();
        detectAndSaveCountry(user.uid); // fire-and-forget, silent fail
        return currentProfile;
    }

    function loadProfile() {
        if (currentProfile) return currentProfile;
        try {
            const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
            return normalizeProfile(data.uid || '', data);
        } catch (_error) {
            return normalizeProfile('', {});
        }
    }

    function saveProfile(data) {
        localStorage.setItem(storageKey, JSON.stringify(data || {}));
    }

    // ─── PLAY TIME ENGINE (Firestore = source of truth) ───
    // serverBaseSeconds: the last confirmed value from Firestore.
    // sessionElapsed is tracked via playTimeStartedAt (Date.now snapshot).
    // Total = serverBaseSeconds + live elapsed. We NEVER derive from localStorage.
    // Uses atomic FieldValue.increment() to avoid overwriting playtime from
    // other pages (solo/multiplayer) or other devices.
    let serverBaseSeconds = 0;
    let playTimePendingDelta = 0; // seconds accumulated since last successful Firestore sync
    let playTimeSyncInFlight = false;
    const PLAYTIME_RETRY_MS = 10000;
    let playTimeRetryTimer = null;

    function getLivePlayTimeSeconds() {
        if (!playTimeStartedAt) return serverBaseSeconds + playTimePendingDelta;
        const elapsed = Math.max(0, Math.floor((Date.now() - playTimeStartedAt) / 1000));
        return serverBaseSeconds + playTimePendingDelta + elapsed;
    }

    function flushElapsedToPending() {
        if (!playTimeStartedAt) return;
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - playTimeStartedAt) / 1000));
        playTimePendingDelta += elapsed;
        playTimeStartedAt = now;
    }

    function syncPlayTimeToFirestore(force = false) {
        if (!currentUser?.uid || !firestoreDb) return;
        flushElapsedToPending();
        // Skip write if nothing accumulated since last sync
        if (playTimePendingDelta <= 0 && !force) return;
        if (playTimeSyncInFlight && !force) return;
        const deltaSeconds = playTimePendingDelta;
        if (deltaSeconds <= 0) return;
        playTimePendingDelta = 0;
        playTimeSyncInFlight = true;
        // Update local state optimistically
        serverBaseSeconds += deltaSeconds;
        const totalSeconds = serverBaseSeconds;
        if (currentProfile) {
            currentProfile.playTimeSeconds = totalSeconds;
            currentProfile.playTime = formatPlayTime(totalSeconds);
        }
        saveProfile(currentProfile);
        firestoreDb.collection('profiles').doc(currentUser.uid).set({
            playTimeSeconds: firebase.firestore.FieldValue.increment(deltaSeconds),
            playTime: formatPlayTime(totalSeconds),
            playTimeLeaderboardUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
            playTimeSyncInFlight = false;
            clearTimeout(playTimeRetryTimer);
        }).catch((err) => {
            // Write failed: put the delta back so it retries on the next tick
            playTimePendingDelta += deltaSeconds;
            serverBaseSeconds -= deltaSeconds;
            playTimeSyncInFlight = false;
            console.warn('[Papiano] Playtime sync failed, will retry:', err?.message || err);
            // Schedule a retry sooner than the normal interval
            clearTimeout(playTimeRetryTimer);
            playTimeRetryTimer = setTimeout(() => syncPlayTimeToFirestore(true), PLAYTIME_RETRY_MS);
        });
    }

    function startPlayTimeTracker() {
        // serverBaseSeconds should already be set from ensureUserProfile (Firestore read)
        // If not yet set, use currentProfile as fallback
        if (!serverBaseSeconds && currentProfile) {
            serverBaseSeconds = Math.max(0, Number(currentProfile.playTimeSeconds) || 0);
        }
        if (!playTimeStartedAt) playTimeStartedAt = Date.now();
        clearInterval(playTimeTimer);
        // Immediate sync so Firestore has our latest before leaderboard subscribes
        syncPlayTimeToFirestore();
        playTimeTimer = setInterval(syncPlayTimeToFirestore, PLAYTIME_SYNC_MS);
        startPlayTimeDisplayTicker();
    }

    function pausePlayTimeTracker(syncRemote = false) {
        flushElapsedToPending();
        if (syncRemote) syncPlayTimeToFirestore(true);
        playTimeStartedAt = 0;
        clearInterval(playTimeTimer);
        playTimeTimer = null;
        clearTimeout(playTimeRetryTimer);
        stopPlayTimeDisplayTicker();
    }

    function startPlayTimeDisplayTicker() {
        stopPlayTimeDisplayTicker();
        updatePlayTimeDisplay();
        playTimeDisplayTicker = setInterval(updatePlayTimeDisplay, 1000);
    }

    function stopPlayTimeDisplayTicker() {
        clearInterval(playTimeDisplayTicker);
        playTimeDisplayTicker = null;
    }

    function updatePlayTimeDisplay() {
        if (!playTimeStartedAt || document.hidden) return;
        const totalSeconds = getLivePlayTimeSeconds();
        const label = formatPlayTime(totalSeconds);
        const hourLabel = formatPlayTimeHours(totalSeconds);
        if (displayTotalPlayTrack) displayTotalPlayTrack.textContent = label;
        if (displayProfilePlayPill) displayProfilePlayPill.textContent = hourLabel;
        if (accountLockedTotalPlay) accountLockedTotalPlay.textContent = label;
    }

    function getBadge(id) {
        const roleId = normalizeRoleId(id);
        const role = roleRegistry[roleId] || { label: roleId.toUpperCase(), rarity: 'system', permissions: [] };
        const rarity = String(role.rarity || 'common').toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'common';
        return { id: roleId, label: role.label || role.name || roleId.toUpperCase(), meta: '', className: `badge-rarity-${rarity}` };
    }

    function renderBadge(id) {
        const badge = getBadge(id);
        return `<span class="badge-role-pill ${badge.className}">${escapeHtml(badge.label)}</span>`;
    }

    // Populate the Role <select> in account settings from the user's
    // ownedRoles (badge inventory). Falls back to PLAYER only if the
    // user has no extra roles - which is the default for everyone.
    function populateAccountRoleSelect(currentRoleId) {
        const select = document.getElementById('accountRoleSelect');
        if (!select) return;
        const target = normalizeRoleId(currentRoleId || selectedBadgeId || 'common');
        // The user's badge inventory. Always includes 'common' + the
        // currently-active roleId (handled in normalizeProfile).
        const owned = Array.isArray(currentProfile?.ownedRoles) && currentProfile.ownedRoles.length
            ? currentProfile.ownedRoles
            : ['common', target];
        const ownedSet = new Set(owned.map(normalizeRoleId));
        ownedSet.add('common');
        ownedSet.add(target);

        const entries = [...ownedSet].map(id => {
            const role = roleRegistry[id] || { label: id.toUpperCase() };
            return [id, role];
        });
        // 'common' first, the rest sorted alphabetically by label
        entries.sort(([aId, a], [bId, b]) => {
            if (aId === 'common') return -1;
            if (bId === 'common') return 1;
            return String(a?.label || aId).localeCompare(String(b?.label || bId));
        });

        select.innerHTML = entries.map(([id, role]) => {
            const label = String(role?.label || id || '').trim() || id.toUpperCase();
            return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
        }).join('');
        if (!Array.from(select.options).some(opt => opt.value === target)) {
            const opt = document.createElement('option');
            opt.value = target;
            opt.textContent = target.toUpperCase();
            select.appendChild(opt);
        }
        select.value = target;
        syncThemedSelectDisplay(select);
    }

    // Called when user picks a different role in account settings.
    function handleRoleSelectChange() {
        const select = document.getElementById('accountRoleSelect');
        if (!select) return;
        // Track the pending choice for Save, and update the select's own label.
        // The profile card itself is NOT touched until the Save button is pressed.
        selectedBadgeId = normalizeRoleId(select.value || 'common');
        syncThemedSelectDisplay(select);
    }

    // Country select change - update the select's own label only. The profile
    // card flag is not changed until the Save button is pressed.
    function handleCountrySelectChange() {
        const select = document.getElementById('formInputCountry');
        if (!select) return;
        syncThemedSelectDisplay(select);
    }

    // ============ Themed picker overlay ============
    let themedPickerSourceSelect = null;
    let themedPickerOptionsCache = [];

    function syncThemedSelectDisplay(selectEl) {
        if (!selectEl) return;
        const wrapper = selectEl.closest('.themed-select');
        if (!wrapper) return;
        const labelNode = wrapper.querySelector('.themed-select-current');
        if (!labelNode) return;
        const opt = selectEl.options[selectEl.selectedIndex];
        labelNode.textContent = opt ? (opt.textContent || opt.value || '') : '— Select —';
    }

    function openSelectAsPicker(triggerBtn) {
        if (!triggerBtn) return;
        const wrapper = triggerBtn.closest('.themed-select');
        if (!wrapper) return;
        const select = wrapper.querySelector('select');
        if (!select) return;
        themedPickerSourceSelect = select;
        const title = wrapper.getAttribute('data-picker-title') || 'Select';
        const opts = Array.from(select.options).map(o => ({ value: o.value, label: o.textContent || o.value, disabled: o.disabled }));
        themedPickerOptionsCache = opts;
        renderThemedPickerList(opts, select.value);
        const titleEl = document.getElementById('themedPickerTitle');
        if (titleEl) titleEl.textContent = title;
        const searchEl = document.getElementById('themedPickerSearch');
        if (searchEl) {
            // Show search box only for long lists (10+ options)
            searchEl.style.display = opts.length >= 10 ? '' : 'none';
            searchEl.value = '';
        }
        const overlay = document.getElementById('themedPickerOverlay');
        if (overlay) overlay.classList.add('active');
    }

    function renderThemedPickerList(options, currentValue) {
        const listEl = document.getElementById('themedPickerList');
        if (!listEl) return;
        listEl.innerHTML = options.map(opt => {
            const selected = String(opt.value) === String(currentValue || '') ? 'is-selected' : '';
            return `<button type="button" class="themed-picker-option ${selected}" data-value="${escapeHtml(String(opt.value))}">
                <span class="themed-picker-option-text">${escapeHtml(opt.label)}</span>
                ${selected ? '<span class="material-symbols-rounded">check</span>' : ''}
            </button>`;
        }).join('');
        listEl.querySelectorAll('.themed-picker-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!themedPickerSourceSelect) return;
                themedPickerSourceSelect.value = btn.getAttribute('data-value') || '';
                syncThemedSelectDisplay(themedPickerSourceSelect);
                themedPickerSourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                closeThemedPicker();
            });
        });
    }

    function filterThemedPicker(query) {
        const q = String(query || '').trim().toLowerCase();
        const filtered = !q
            ? themedPickerOptionsCache
            : themedPickerOptionsCache.filter(o => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q));
        renderThemedPickerList(filtered, themedPickerSourceSelect?.value);
    }

    function closeThemedPicker(event) {
        if (event && event.target !== event.currentTarget) return;
        const overlay = document.getElementById('themedPickerOverlay');
        if (overlay) overlay.classList.remove('active');
        themedPickerSourceSelect = null;
        themedPickerOptionsCache = [];
    }

    // ============ Themed confirm dialog ============
    let themedConfirmResolver = null;

    function openThemedConfirm({ title, message, confirmLabel, cancelLabel, danger } = {}) {
        return new Promise(resolve => {
            themedConfirmResolver = resolve;
            const overlay = document.getElementById('themedConfirmOverlay');
            const titleEl = document.getElementById('themedConfirmTitle');
            const msgEl = document.getElementById('themedConfirmMessage');
            const okBtn = document.getElementById('themedConfirmOkBtn');
            const cancelBtn = document.getElementById('themedConfirmCancelBtn');
            if (titleEl) titleEl.textContent = title || 'Confirm';
            if (msgEl) msgEl.textContent = message || '';
            if (okBtn) {
                okBtn.textContent = confirmLabel || 'Confirm';
                okBtn.classList.toggle('is-danger', !!danger);
                okBtn.onclick = () => { closeThemedConfirm(); themedConfirmResolver = null; resolve(true); };
            }
            if (cancelBtn) {
                cancelBtn.textContent = cancelLabel || 'Cancel';
                cancelBtn.onclick = () => { closeThemedConfirm(); themedConfirmResolver = null; resolve(false); };
            }
            overlay?.classList.add('active');
        });
    }

    function closeThemedConfirm() {
        document.getElementById('themedConfirmOverlay')?.classList.remove('active');
    }

    function cancelThemedConfirm(event) {
        if (event && event.target !== event.currentTarget) return;
        closeThemedConfirm();
        if (typeof themedConfirmResolver === 'function') {
            themedConfirmResolver(false);
            themedConfirmResolver = null;
        }
    }

    function updateTopBarProfile(profile = {}) {
        const box = document.getElementById('topUserBox');
        const avatarImg = document.getElementById('topUserAvatarImg');
        const avatarIcon = document.getElementById('topUserAvatarIcon');
        const welcomeLabel = document.getElementById('topWelcomeLabel');
        const userName = document.getElementById('topUserName');
        if (!box || !welcomeLabel || !userName) return;

        const signedIn = !!currentUser?.uid;
        box.classList.toggle('is-open-access', !signedIn);

        document.querySelectorAll('.top-auth-btn').forEach(button => {
            button.style.display = signedIn ? 'none' : 'inline-flex';
        });

        if (!signedIn) {
            welcomeLabel.textContent = 'Papiano';
            userName.textContent = '';
            if (avatarImg) {
                avatarImg.removeAttribute('src');
                avatarImg.style.display = 'none';
            }
            if (avatarIcon) avatarIcon.style.display = '';
            return;
        }

        const name = String(profile.name || currentUser.displayName || 'Player').trim().slice(0, 24) || 'Player';
        welcomeLabel.textContent = name;
        userName.textContent = 'Account';

        if (!avatarImg || !avatarIcon) return;
        const photoURL = String(profile.photoURL || currentUser.photoURL || '');
        applyAvatarSlot(avatarImg, avatarIcon, photoURL, profile.name, !!currentUser, 'account_circle');
    }

    function updateProfileView(profile) {
        selectedBadgeId = normalizeRoleId(profile.roleId || profile.badgeId || 'common');
        const badge = getBadge(selectedBadgeId);
        const playTimeLabel = formatPlayTime(profile.playTimeSeconds);
        const playTimeHourLabel = formatPlayTimeHours(profile.playTimeSeconds);
        updateTopBarProfile(profile);
        document.querySelector('.account-layout')?.classList.toggle('access-locked', !currentUser?.uid);

        if (displayProfileName) displayProfileName.textContent = profile.name || 'Papiano User';
        if (displayProfileRole) displayProfileRole.innerHTML = renderBadge(selectedBadgeId);
        if (displayProfileId) displayProfileId.textContent = (/^#\d+$/.test(String(profile.userId || '')) ? profile.userId : safeUserId(profile.uid));
        if (displayTotalPlayTrack) animateCountUp(displayTotalPlayTrack, playTimeLabel);
        if (displayProfilePlayPill) displayProfilePlayPill.textContent = playTimeHourLabel;
        if (displayAuthStatus) displayAuthStatus.textContent = currentUser ? 'Online' : '—';
        if (accountLockedUserId) accountLockedUserId.textContent = (/^#\d+$/.test(String(profile.userId || '')) ? profile.userId : safeUserId(profile.uid));
        if (accountLockedTotalPlay) accountLockedTotalPlay.textContent = playTimeLabel;
        if (formInputName) formInputName.value = profile.name || '';
        if (formInputDesc) formInputDesc.value = profile.desc || '';
        if (formInputPhotoUrl) formInputPhotoUrl.value = profile.photoURL || '';
        const formInputCountry = document.getElementById('formInputCountry');
        if (formInputCountry) formInputCountry.value = profile.countryCode || '';
        renderFlagRow(profile.countryCode, document.getElementById('displayProfileFlag'));
        syncThemedSelectDisplay(formInputCountry);
        populateAccountRoleSelect(selectedBadgeId);

        applyAvatarSlot(masterAvatarImg, masterPlaceholderIcon, profile.photoURL, profile.name, !!currentUser, 'account_circle');
        // Keep brand sheet (mobile) and desktop sidebar auth button in sync
        // with auth/profile state, even when the brand sheet is closed.
        populateBrandSheet();
    }

    function isSafeImage(src) {
        return /^(data:image\/(png|jpe?g|webp);base64,|https:\/\/)/i.test(String(src || ''));
    }

    function safeSupabaseStorageName(value, fallback = 'image') {
        const clean = String(value || fallback)
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '_')
            .replace(/_+/g, '_')
            .slice(-90);
        return clean || fallback;
    }

    function getImageExtensionFromFile(file) {
        const fromType = String(file?.type || '').split('/')[1] || '';
        const typeExt = fromType.replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const nameExt = String(file?.name || '').split('.').pop().replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
        const ext = ALLOWED_IMAGE_EXTENSIONS.has(typeExt) ? typeExt : nameExt;
        return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext.replace('jpeg', 'jpg') : 'jpg';
    }

    function formatFileSize(bytes) {
        const value = Math.max(0, Number(bytes) || 0);
        if (value >= 1024 * 1024) return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`;
        if (value >= 1024) return `${Math.round(value / 1024)} KB`;
        return `${value} B`;
    }

    function validateUploadImageFile(file, maxBytes, label = 'Image') {
        if (!file) return `Select a valid ${label.toLowerCase()} file.`;
        const type = String(file.type || '').toLowerCase();
        const nameExt = String(file.name || '').split('.').pop().toLowerCase();
        const hasAllowedType = ALLOWED_IMAGE_MIME_TYPES.has(type);
        const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.has(nameExt);
        if (!hasAllowedType && !(type === '' && hasAllowedExtension)) {
            return 'Only JPG, PNG, or WEBP images are allowed.';
        }
        if (!Number.isFinite(file.size) || file.size <= 0) {
            return 'Select a valid image file.';
        }
        if (file.size > maxBytes) {
            return `${label} must be ${formatFileSize(maxBytes)} or less.`;
        }
        return '';
    }

    async function uploadImageToSupabaseStorage(bucketName, file, folderName, fileNamePrefix, options = {}) {
        if (!supabaseStorageClient) throw new Error('Image upload is unavailable right now.');
        if (!currentUser?.uid) throw new Error('Sign in to upload images.');
        const validationError = validateUploadImageFile(file, options.maxBytes || MAX_CHAT_IMAGE_BYTES, options.label || 'Image');
        if (validationError) throw new Error(validationError);

        const ext = getImageExtensionFromFile(file);
        const safeOriginalName = safeSupabaseStorageName(file.name || `${fileNamePrefix}.${ext}`);
        const safeUid = safeSupabaseStorageName(currentUser.uid, 'user');
        const safeFolder = safeSupabaseStorageName(folderName, 'uploads');
        const safePrefix = safeSupabaseStorageName(fileNamePrefix, 'image');
        const path = `${safeUid}/${safeFolder}/${safePrefix}_${Date.now()}_${safeOriginalName}`;

        const { error } = await supabaseStorageClient
            .storage
            .from(bucketName)
            .upload(path, file, {
                cacheControl: '3600',
                contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                upsert: false
            });

        if (error) throw error;
        const { data } = supabaseStorageClient.storage.from(bucketName).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('Image upload is unavailable right now.');
        return { url: data.publicUrl, path };
    }

    async function applyProfileConfiguration() {
        if (!currentUser?.uid) {
            showToast('Sign in to save profile.');
            return;
        }
        if (profileSaveBusy) return;
        profileSaveBusy = true;
        const cleanName = (formInputName?.value || '').trim().slice(0, 24) || 'Papiano User';
        const cleanDesc = (formInputDesc?.value || '').trim().slice(0, 160);
        const countryEl = document.getElementById('formInputCountry');
        const cleanCountry = String(countryEl?.value || '').toUpperCase().slice(0, 2);
        const profileUid = currentUser?.uid || loadProfile().uid || 'test_user';

        // Validate roleId against the user's badge inventory. If they somehow
        // submit a roleId they don't own (shouldn't happen via UI), snap back
        // to PLAYER. ownedRoles itself is admin-controlled and is NEVER
        // written from the client - we strip it from the Firestore payload.
        const ownedSet = new Set((Array.isArray(currentProfile?.ownedRoles) ? currentProfile.ownedRoles : ['common']).map(normalizeRoleId));
        ownedSet.add('common');
        const safeRoleId = ownedSet.has(selectedBadgeId) ? selectedBadgeId : 'common';
        if (safeRoleId !== selectedBadgeId) {
            selectedBadgeId = 'common';
            populateAccountRoleSelect('common');
        }

        const cached = loadProfile();
        const remoteSafe = { ...cached };
        delete remoteSafe.ownedRoles; // never overwrite admin-managed inventory

        const currentName = String(currentProfile?.name || cached.name || '').trim();
        const normalizedNew = cleanName.toLowerCase();
        const normalizedOld = currentName.toLowerCase();
        if (currentUser?.uid && normalizedNew !== normalizedOld) {
            try {
                await firestoreDb.runTransaction(async tx => {
                    const newRef = firestoreDb.collection('displayNames').doc(normalizedNew);
                    const newSnap = await tx.get(newRef);
                    if (newSnap.exists && newSnap.data()?.uid !== currentUser.uid) throw new Error('NAME_TAKEN');
                    tx.set(newRef, { uid: currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    if (normalizedOld) tx.delete(firestoreDb.collection('displayNames').doc(normalizedOld));
                });
            } catch (e) {
                showToast(e?.message === 'NAME_TAKEN' ? 'That name is already taken.' : 'Couldn’t update your name.');
                profileSaveBusy = false;
                return;
            }
        }

        const profile = {
            ...remoteSafe,
            uid: profileUid,
            name: cleanName,
            searchName: cleanName.toLowerCase(),
            desc: cleanDesc,
            roleId: safeRoleId,
            badgeId: safeRoleId,
            photoURL: formInputPhotoUrl?.value || '',
            countryCode: cleanCountry,
            playTimeSeconds: parsePlayTimeSeconds(cached),
            updatedAt: currentUser?.uid ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        };
        try {
            if (currentUser?.uid) {
                // Only persist the fields the profile editor actually owns.
                // Strip server-managed fields — vote counts (written by other
                // users), the public ID assigned once at creation, and play
                // time (written by the playtime sync) — so a stale cached copy
                // can't clobber them and the security rules don't reject the
                // save for touching fields it shouldn't.
                const { likes, dislikes, publicId, userId, playTime, playTimeSeconds, ...editable } = profile;
                await firestoreDb.collection('profiles').doc(currentUser.uid).set(editable, { merge: true });
            }
            // Re-attach the cached ownedRoles locally so updateProfileView still
            // shows the right options after save (until next snapshot).
            currentProfile = normalizeProfile(profileUid, { ...profile, ownedRoles: cached.ownedRoles });
            saveProfile(currentProfile);
            updateProfileView(currentProfile);
            showToast('Profile saved.', 'Saved');
        } catch (error) {
            showToast('Couldn’t save your profile.');
        } finally {
            profileSaveBusy = false;
        }
    }

    function triggerProfilePhotoPicker() {
        if (!currentUser?.uid) {
            showToast('Sign in to upload photo.');
            return;
        }
        profilePhotoFilePicker?.click();
    }

    async function handleProfilePhotoFile(event) {
        const file = event?.target?.files?.[0];
        const validationError = validateUploadImageFile(file, MAX_PROFILE_IMAGE_BYTES, 'Profile photo');
        if (validationError) {
            showToast(validationError);
            if (event?.target) event.target.value = '';
            return;
        }
        if (!currentUser?.uid) {
            showToast('Sign in to upload photo.');
            if (event?.target) event.target.value = '';
            return;
        }
        try {
            const upload = await uploadImageToSupabaseStorage('avatars', file, 'profile', 'avatar', {
                maxBytes: MAX_PROFILE_IMAGE_BYTES,
                label: 'Profile photo'
            });
            if (formInputPhotoUrl) formInputPhotoUrl.value = upload.url;
            // Preview the picked photo in the account form only — it is NOT
            // persisted (or reflected elsewhere) until the Save button is pressed.
            applyAvatarSlot(masterAvatarImg, masterPlaceholderIcon, upload.url, formInputName?.value || currentProfile?.name, true, 'account_circle');
            showToast('Photo ready — tap Save to apply.', 'Photo selected');
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t upload your photo.'));
        } finally {
            if (event?.target) event.target.value = '';
        }
    }
    function initTapRipple() {
        document.addEventListener('pointerdown', (event) => {
            const host = event.target.closest('.button-card-landscape, .brand-quick-btn');
            if (!host) return;
            host.classList.add('ripple-host');
            const rect = host.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const span = document.createElement('span');
            span.className = 'tap-ripple';
            span.style.width = span.style.height = `${size}px`;
            span.style.left = `${event.clientX - rect.left - size / 2}px`;
            span.style.top = `${event.clientY - rect.top - size / 2}px`;
            host.appendChild(span);
            setTimeout(() => span.remove(), 600);
        }, { passive: true });
    }

    const GATED_TABS = { 1: 'Chat', 2: 'Account' };

    function updateHomeTopBarVisibility() {
        const bar = document.getElementById('appTopBar');
        if (!bar) return;
        const hasOpenSubPage = Array.from(document.querySelectorAll('.sub-page-reference')).some(node => node.style.display === 'flex');
        const shouldShow = currentActiveTabIndex === 0 && !hasOpenSubPage;
        bar.classList.toggle('is-tab-hidden', !shouldShow);
        if (!shouldShow) bar.classList.remove('is-scroll-hidden');
    }

    function navigateActiveTab(index, title) {
        currentActiveTabIndex = index;
        ensureNativeBackGuard();
        document.querySelectorAll('.sub-page-reference').forEach(node => {
            if (node.style.display === 'flex') node.style.display = 'none';
        });
        tabPages.forEach((id, pageIndex) => {
            document.getElementById(id)?.classList.toggle('active', pageIndex === index);
        });
        document.querySelectorAll('.nav-tab-action').forEach((button, buttonIndex) => {
            const navIndex = button.dataset.tabIndex ? Number(button.dataset.tabIndex) : buttonIndex;
            button.classList.toggle('active', navIndex === index);
        });
        closeChatOverlayRoom();
        updateHomeTopBarVisibility();

        const needsAuth = !currentUser && GATED_TABS[index];
        const gate = document.getElementById('authGateOverlay');
        if (gate) {
            if (needsAuth) {
                document.getElementById('authGateText').textContent =
                    `Sign in to use ${GATED_TABS[index]}.`;
                gate.style.display = 'flex';
                return;
            }
            gate.style.display = 'none';
        }
    }

    function ensureNativeBackGuard() {
        if (nativeBackGuardReady || !window.history?.pushState) return;
        nativeBackGuardReady = true;
        try {
            window.history.replaceState({ papianoBase: true }, document.title, window.location.href);
            window.history.pushState({ papianoGuard: true }, document.title, window.location.href);
        } catch (error) {
            return;
        }
        window.addEventListener('popstate', () => {
            const handled = handleNativeBackAction();
            if (handled) {
                window.history.pushState({ papianoGuard: true }, document.title, window.location.href);
            } else {
                nativeBackGuardReady = false;
            }
        });
    }

    function handleNativeBackAction() {
        const brandSheetOverlay = document.getElementById('brandSheetOverlay');
        if (brandSheetOverlay?.classList.contains('active')) {
            closeBrandSheet();
            return true;
        }
        if (chatToolsModal?.classList.contains('active')) {
            closeChatToolsMenu();
            return true;
        }
        const friendProfileModal = document.getElementById('friendProfileModal');
        if (friendProfileModal?.classList.contains('active')) {
            closeFriendProfileModal();
            return true;
        }
        const openReference = Array.from(document.querySelectorAll('.sub-page-reference')).find(node => node.style.display === 'flex');
        if (openReference) {
            openReference.style.display = 'none';
            updateHomeTopBarVisibility();
            return true;
        }
        if (chatOverlayRoom && chatOverlayRoom.style.display === 'flex') {
            closeChatOverlayRoom();
            return true;
        }
        if (mainAppScreen?.classList.contains('active') && currentActiveTabIndex !== 0) {
            navigateActiveTab(0, appTabHeaderTitles[0]);
            return true;
        }
        return false;
    }

    function showAuthGateForFeature(featureName) {
        const gate = document.getElementById('authGateOverlay');
        const text = document.getElementById('authGateText');
        if (text) text.textContent = `Sign in to use ${featureName || 'this feature'}.`;
        if (gate) gate.style.display = 'flex';
    }

    function requireSignedInFeature(featureName) {
        if (currentUser?.uid) return true;
        showAuthGateForFeature(featureName);
        return false;
    }

    function enterMultiplayerMode() {
        // Multiplayer requires an online account. If the user isn't signed in,
        // requireSignedInFeature() pops the themed auth gate ("Sign in to use
        // Multiplayer.") and we bail out. Otherwise head to the rooms page.
        if (!requireSignedInFeature('Multiplayer')) return;
        window.location.href = 'multiplayer.html';
    }

    function launchSubPageReferenceNode(id) {
        // Close any other sub-page that's currently open so we don't end up
        // stacking them on top of each other (matters at desktop where the
        // sidebar can launch a new sub-page without closing the previous one).
        document.querySelectorAll('.sub-page-reference').forEach(node => {
            if (node.id !== id && node.style.display === 'flex') {
                node.style.display = 'none';
            }
        });
        // Lazy-inflate from <template> if not yet in DOM
        let node = document.getElementById(id);
        if (!node) {
            const tpl = document.getElementById('tpl-' + id);
            if (tpl) {
                const container = document.getElementById('mainAppScreen');
                if (container) container.insertBefore(tpl.content.cloneNode(true), container.firstChild);
                node = document.getElementById(id);
            }
        }
        if (node) node.style.display = 'flex';
        updateHomeTopBarVisibility();
        if (id === 'subPageDonation') subscribeDonationLeaderboard();
        if (id === 'subPageLeaderboard') initLeaderboardView();
    }

    function closeSubPageReferenceNode(id) {
        const node = document.getElementById(id);
        if (node) node.style.display = 'none';
        updateHomeTopBarVisibility();
    }

    function switchLeaderboardBoard(board) {
        activeLeaderboardBoard = board === 'donation' ? 'donation' : 'playtime';
        document.getElementById('leaderboardTabPlayTime')?.classList.toggle('active', activeLeaderboardBoard === 'playtime');
        document.getElementById('leaderboardTabDonation')?.classList.toggle('active', activeLeaderboardBoard === 'donation');
        const playList = document.getElementById('leaderboardPlayTimeList');
        const donationList = document.getElementById('leaderboardDonationList');
        if (playList) playList.style.display = activeLeaderboardBoard === 'playtime' ? 'grid' : 'none';
        if (donationList) donationList.style.display = activeLeaderboardBoard === 'donation' ? 'grid' : 'none';
    }

    function initLeaderboardView() {
        switchLeaderboardBoard(activeLeaderboardBoard);
        if (!currentUser?.uid) {
            if (typeof unsubscribeLeaderboardPlayTime === 'function') unsubscribeLeaderboardPlayTime();
            unsubscribeLeaderboardPlayTime = null;
            stopLeaderboardLiveTicker();
            leaderboardRemoteRows = [];
            renderLeaderboardError('leaderboardPlayTimeList', 'Sign in to view leaderboard.');
            subscribeDonationLeaderboard();
            return;
        }
        subscribePlayTimeLeaderboard();
        subscribeDonationLeaderboard();
    }

    function subscribePlayTimeLeaderboard() {
        if (unsubscribeLeaderboardPlayTime || !firestoreDb || !currentUser?.uid) return;
        const target = document.getElementById('leaderboardPlayTimeList');
        if (target) target.innerHTML = '<div class="leaderboard-empty">Loading total played time...</div>';
        unsubscribeLeaderboardPlayTime = firestoreDb.collection('profiles')
            .orderBy('playTimeSeconds', 'desc')
            .limit(LEADERBOARD_VISIBLE_LIMIT)
            .onSnapshot(snapshot => {
                leaderboardRemoteRows = snapshot.docs.map(doc => normalizeProfile(doc.id, doc.data() || {}));
                lastLeaderboardMinute = -1; // force re-render on new data
                renderLiveLeaderboard();
            }, error => {
                renderLeaderboardError('leaderboardPlayTimeList', 'Play time leaderboard is unavailable right now.');
            });
        startLeaderboardLiveTicker();
    }

    function subscribeDonationLeaderboard() {
        if (unsubscribeLeaderboardDonation || !firestoreDb) return;
        const target = document.getElementById('leaderboardDonationList');
        if (target) target.innerHTML = '<div class="leaderboard-empty">Loading donation leaderboard...</div>';
        unsubscribeLeaderboardDonation = firestoreDb.collection('donations')
            .onSnapshot(snapshot => {
                const rows = snapshot.docs.map(doc => normalizeDonationEntry(doc.id, doc.data() || {}))
                    .filter(item => item.visible && item.currency === 'USD' && item.amount > 0)
                    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
                const raised = rows.reduce((total, item) => total + item.amount, 0);
                renderDonationProgress(raised);
                renderLeaderboardRows('leaderboardDonationList', rows.slice(0, LEADERBOARD_VISIBLE_LIMIT), 'donation');
            }, error => {
                renderLeaderboardError('leaderboardDonationList', 'Donation leaderboard is unavailable right now.');
            });
    }

    function normalizeDonationEntry(id, data = {}) {
        const rawCurrency = String(data.currency || 'USD').toUpperCase();
        const amount = rawCurrency === 'USD'
            ? Number(data.amountUSD ?? data.amountUsd ?? data.usd ?? data.amount ?? 0)
            : 0;
        const displayName = String(data.name || data.displayName || data.senderName || 'Supporter').slice(0, 24);
        const status = String(data.status || '').toLowerCase();
        return {
            uid: String(data.uid || id || ''),
            name: displayName,
            userId: String(data.userId || data.publicId || ''),
            photoURL: String(data.photoURL || data.avatarURL || data.avatar_url || ''),
            amount: Number.isFinite(amount) ? amount : 0,
            currency: 'USD',
            visible: data.visible !== false && status !== 'pending' && status !== 'rejected'
        };
    }

    function renderDonationProgress(totalUsd = 0) {
        const raised = Math.max(0, Number(totalUsd) || 0);
        const goal = DONATION_GOAL_USD;
        const percent = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
        const fill = document.getElementById('donationProgressFill');
        const raisedText = document.getElementById('donationRaisedText');
        const goalText = document.getElementById('donationGoalText');
        if (fill) fill.style.width = `${percent.toFixed(2)}%`;
        if (raisedText) raisedText.textContent = `${formatDonationAmount(raised)} raised`;
        if (goalText) goalText.textContent = `Goal ${formatDonationAmount(goal)}`;
    }

    function renderLeaderboardRows(targetId, rows, type) {
        const target = document.getElementById(targetId);
        if (!target) return;
        if (!rows.length) {
            target.innerHTML = `<div class="leaderboard-empty">${type === 'donation' ? 'No donation records yet.' : 'No play time records yet.'}</div>`;
            return;
        }
        rows.forEach(item => { if (item.uid) leaderboardProfiles.set(item.uid, item); });
        target.innerHTML = rows.map((item, index) => {
            const avatar = item.photoURL ? `<img src="${escapeHtml(item.photoURL)}" alt="">` : escapeHtml(getInitials(item.name));
            const idLabel = item.userId || (item.publicId ? formatPublicUserId(item.publicId) : 'Papiano Player');
            const score = type === 'donation'
                ? formatDonationAmount(item.amount, item.currency)
                : formatPlayTime(item.playTimeSeconds);
            const clickAttr = item.uid ? `onclick="launchFriendProfileModal('${escapeHtml(item.uid)}')"` : '';
            return `
                <div class="leaderboard-row" ${clickAttr} style="cursor:pointer">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-avatar">${avatar}</div>
                    <div class="leaderboard-name"><strong>${escapeHtml(item.name || 'Papiano User')}</strong><span>${escapeHtml(idLabel)}</span></div>
                    <div class="leaderboard-score">${escapeHtml(score)}</div>
                </div>
            `;
        }).join('');
    }

    function renderLeaderboardError(targetId, message) {
        const target = document.getElementById(targetId);
        if (target) target.innerHTML = `<div class="leaderboard-empty">${escapeHtml(message)}</div>`;
    }

    let leaderboardLiveTicker = null;
    let leaderboardRemoteRows = [];

    function startLeaderboardLiveTicker() {
        clearInterval(leaderboardLiveTicker);
        leaderboardLiveTicker = setInterval(renderLiveLeaderboard, 1000);
    }

    function stopLeaderboardLiveTicker() {
        clearInterval(leaderboardLiveTicker);
        leaderboardLiveTicker = null;
    }

    let lastLeaderboardMinute = -1;

    // Renders leaderboard with current user's live time merged in, re-sorted
    function renderLiveLeaderboard() {
        const target = document.getElementById('leaderboardPlayTimeList');
        if (!target || target.style.display === 'none') return;

        const liveSeconds = getLivePlayTimeSeconds();
        // Only re-render when the displayed minute changes (format is Xh YYm)
        const currentMinute = Math.floor(liveSeconds / 60);
        if (currentMinute === lastLeaderboardMinute && leaderboardRemoteRows.length) return;
        lastLeaderboardMinute = currentMinute;

        // Start from remote snapshot, always merge current user's live time
        let rows = leaderboardRemoteRows.map(row => {
            if (currentUser?.uid && row.uid === currentUser.uid) {
                return { ...row, playTimeSeconds: Math.max(row.playTimeSeconds, liveSeconds) };
            }
            return row;
        });

        // If current user is not in remote list at all, inject them
        if (currentUser?.uid && currentProfile) {
            const userInList = rows.some(r => r.uid === currentUser.uid);
            if (!userInList) {
                rows.push({ ...currentProfile, playTimeSeconds: liveSeconds });
            }
        }

        if (!rows.length) {
            target.innerHTML = '<div class="leaderboard-empty">No play time records yet.</div>';
            return;
        }

        // Re-sort by playTimeSeconds descending, take top limit
        rows.sort((a, b) => b.playTimeSeconds - a.playTimeSeconds);
        rows = rows.slice(0, LEADERBOARD_VISIBLE_LIMIT);

        rows.forEach(item => { if (item.uid) leaderboardProfiles.set(item.uid, item); });

        target.innerHTML = rows.map((item, index) => {
            const avatar = item.photoURL ? `<img src="${escapeHtml(item.photoURL)}" alt="">` : escapeHtml(getInitials(item.name));
            const idLabel = item.userId || (item.publicId ? formatPublicUserId(item.publicId) : 'Papiano Player');
            const score = formatPlayTime(item.playTimeSeconds);
            const isMe = currentUser?.uid && item.uid === currentUser.uid;
            const clickAttr = item.uid ? `onclick="launchFriendProfileModal('${escapeHtml(item.uid)}')"` : '';
            return `
                <div class="leaderboard-row${isMe ? ' leaderboard-row-me' : ''}" ${clickAttr} style="cursor:pointer">
                    <div class="leaderboard-rank">#${index + 1}</div>
                    <div class="leaderboard-avatar">${avatar}</div>
                    <div class="leaderboard-name"><strong>${escapeHtml(item.name || 'Papiano User')}</strong><span>${escapeHtml(idLabel)}</span></div>
                    <div class="leaderboard-score">${escapeHtml(score)}</div>
                </div>
            `;
        }).join('');
    }

    function formatDonationAmount(amount) {
        const value = Math.max(0, Number(amount) || 0);
        const hasCents = Math.round(value * 100) % 100 !== 0;
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
    }

    function buildPairId(uidA, uidB) {
        return [uidA, uidB].filter(Boolean).sort().join('_');
    }

    function getGroupRoomId(roomId) {
        return `group_${roomId || 'global'}`;
    }

    function isAnnouncementRoom(roomId = '') {
        return roomId === 'announcements' || activeChatRoomId === getGroupRoomId('announcements');
    }

    function isAnnouncementOwner() {
        const email = String(currentUser?.email || '').trim().toLowerCase();
        return ANNOUNCEMENT_OWNER_EMAILS.has(email);
    }

    function canManageActiveChatFolder() {
        return Boolean(currentUser?.uid && activeChatRoomId && activeChatRoomType === 'dm' && activeChatTargetUid);
    }

    function getAnnouncementReadStorageKey() {
        return `papiano_announcement_read_${currentUser?.uid || 'access'}`;
    }

    function syncChatRoomAccessState(roomId = '') {
        const uploadButton = chatInputBar?.querySelector('button[aria-label="Upload image"]');
        const announcementRoom = isAnnouncementRoom(roomId);
        const canWrite = currentUser?.uid && (!announcementRoom || isAnnouncementOwner());
        if (chatInputBar) chatInputBar.classList.toggle('read-only', !canWrite);
        if (chatRoomMenuBtn) chatRoomMenuBtn.style.display = 'none';
        if (uploadButton) uploadButton.style.display = announcementRoom ? 'none' : 'flex';
        if (chatInputFieldMessage) chatInputFieldMessage.placeholder = announcementRoom ? 'Owner announcement only...' : 'Type a message...';
    }

    function getDirectRoomId(uidA, uidB) {
        return `dm_${buildPairId(uidA, uidB)}`;
    }

    function createFriendRow(profile, type) {
        const row = document.createElement('div');
        const rowClass = type === 'request' ? 'request-list-node' : type === 'blocked' ? 'blocked-list-node' : type === 'search' ? 'search-result-node' : type === 'dm' ? 'dm-list-node chat-matrix-node' : 'friend-list-node';
        row.className = `chat-row-item ${rowClass}`;
        row.dataset.type = type || 'friend';
        row.dataset.uid = profile.uid || '';
        row.dataset.name = `${profile.name || ''} ${profile.desc || ''} ${profile.userId || ''} ${profile.publicId || ''} ${profile.searchName || ''}`.toLowerCase();
        row.style.display = 'none';
        row.onclick = () => {
            if (type === 'dm') openDirectRoom(profile.uid);
            else launchFriendProfileModal(profile.uid || profile.requestId);
        };
        const isBlocked = type === 'blocked' || blockedUserIds.has(profile.uid);
        // Only ONE "Blocked" indicator: the black inline pill next to the name.
        // The right-side stamp is suppressed for blocked rows to avoid duplication.
        const stamp = isBlocked
            ? ''
            : type === 'request' ? 'Request' : type === 'search' ? 'User' : type === 'dm' ? formatChatListStamp(profile.lastMessageAt) : 'Friend';
        // Bio/description is shown ONLY in the profile modal (tap the row).
        // Inline rows show a snippet only for DM (last message), search hint, or blocked notice.
        // Friend and request rows stay clean - no bio in the list.
        const snippet = isBlocked
            ? 'Blocked user. Unblock to chat.'
            : type === 'dm'
                ? (profile.lastMessage || 'No messages yet.')
                : type === 'search'
                    ? 'Tap profile or add friend.'
                    : '';
        const actions = type === 'request'
            ? `<div class="chat-row-actions"><button class="chat-mini-action accept" type="button" onclick="event.stopPropagation(); respondFriendRequest('${profile.requestId}', true)">Accept</button><button class="chat-mini-action decline" type="button" onclick="event.stopPropagation(); respondFriendRequest('${profile.requestId}', false)">Decline</button></div>`
            : type === 'search'
                ? `<div class="chat-row-actions"><button class="chat-mini-action accept" type="button" onclick="event.stopPropagation(); sendFriendRequest('${profile.uid}')">Add</button></div>`
                : type === 'friend'
                    ? (isBlocked
                        ? `<div class="chat-row-actions"><button class="chat-mini-action accept" type="button" onclick="event.stopPropagation(); unblockUser('${profile.uid}')">Unblock</button></div>`
                        : `<div class="chat-row-actions"><button class="chat-mini-action accept" type="button" onclick="event.stopPropagation(); openDirectRoom('${profile.uid}')">Chat</button></div>`)
                    : type === 'blocked'
                        ? `<div class="chat-row-actions"><button class="chat-mini-action accept" type="button" onclick="event.stopPropagation(); unblockUser('${profile.uid}')">Unblock</button></div>`
                        : '';
        const showSecondRow = !!snippet || (type === 'dm' && Number(profile.unreadForMe || 0) > 0);
        const secondRow = showSecondRow
            ? `<div class="chat-row-header">${snippet ? `<div class="chat-snippet">${escapeHtml(snippet)}</div>` : '<div class="chat-snippet"></div>'}${type === 'dm' && Number(profile.unreadForMe || 0) > 0 ? `<span class="row-count-badge" style="display:flex;">${profile.unreadForMe > 4 ? '4+' : escapeHtml(profile.unreadForMe)}</span>` : ''}</div>`
            : '';
        row.innerHTML = `
            <div class="avatar-circle" style="background:var(--accent-green);" onclick="event.stopPropagation(); launchFriendProfileModal('${escapeHtml(profile.uid || '')}')">${profile.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="">` : escapeHtml(getInitials(profile.name))}</div>
            <div class="chat-body-content">
                <div class="chat-row-header">
                    <div class="chat-user-name"><span class="chat-user-name-text">${escapeHtml(profile.name || 'Papiano User')}</span>${isBlocked ? ' <span class="badge-role-pill badge-rarity-system">Blocked</span>' : ''}</div>
                    <div class="chat-timestamp">${stamp}</div>
                </div>
                ${secondRow}
            </div>
            ${actions}
        `;
        return row;
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    function linkifyText(value) {
        const raw = String(value || '');
        const pattern = /(\b(?:https?:\/\/|www\.)[^\s<>'"]+)|(@#?\d+)/gi;
        let html = '';
        let index = 0;
        let match;
        while ((match = pattern.exec(raw)) !== null) {
            html += escapeHtml(raw.slice(index, match.index));
            if (match[1]) {
                let label = match[1];
                let suffix = '';
                while (/[.,!?;:)\]]$/.test(label)) {
                    suffix = label.slice(-1) + suffix;
                    label = label.slice(0, -1);
                }
                if (label) {
                    const href = /^https?:\/\//i.test(label) ? label : `https://${label}`;
                    html += `<a class="msg-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${escapeHtml(suffix)}`;
                } else {
                    html += escapeHtml(match[0]);
                }
            } else if (match[2]) {
                // Only treat @<digits> as a mention at a token boundary, so an
                // email or "word@123" doesn't get its digits mis-highlighted.
                const before = match.index > 0 ? raw[match.index - 1] : '';
                if (before && /[\w@]/.test(before)) {
                    html += escapeHtml(match[0]);
                } else {
                    html += `<span class="mention-tag">${escapeHtml(match[2])}</span>`;
                }
            }
            index = pattern.lastIndex;
        }
        html += escapeHtml(raw.slice(index));
        return html;
    }

    let renderFriendRowsRaf = 0;
    function renderFriendRows() {
        cancelAnimationFrame(renderFriendRowsRaf);
        renderFriendRowsRaf = requestAnimationFrame(renderFriendRowsImmediate);
    }
    function renderFriendRowsImmediate() {
        document.querySelectorAll('.friend-list-node, .request-list-node, .blocked-list-node, .search-result-node, .dm-list-node').forEach(row => row.remove());
        const insertBefore = chatEmptyRow || null;
        [...pendingFriendRequests.values()].forEach(profile => {
            chatMasterWrapperBox?.insertBefore(createFriendRow(profile, 'request'), insertBefore);
        });
        [...blockedProfiles.values()].forEach(profile => {
            chatMasterWrapperBox?.insertBefore(createFriendRow(profile, 'blocked'), insertBefore);
        });
        [...directChatProfiles.values()].forEach(profile => {
            chatMasterWrapperBox?.insertBefore(createFriendRow(profile, 'dm'), insertBefore);
        });
        [...friendProfiles.values()].forEach(profile => {
            chatMasterWrapperBox?.insertBefore(createFriendRow(profile, 'friend'), insertBefore);
        });
        [...searchProfiles.values()].forEach(profile => {
            chatMasterWrapperBox?.insertBefore(createFriendRow(profile, 'search'), insertBefore);
        });
        filterChatMatrixList(false);
    }

    async function hydrateProfilesByIds(ids) {
        const result = new Map();
        if (!currentUser?.uid) return result;
        const validIds = ids.filter(Boolean);
        if (!validIds.length) return result;
        await Promise.all(validIds.map(async uid => {
            try {
                const snap = await firestoreDb.collection('profiles').doc(uid).get();
                result.set(uid, normalizeProfile(uid, snap.exists ? snap.data() : {}));
            } catch (_error) {
                result.set(uid, normalizeProfile(uid, {}));
            }
        }));
        return result;
    }

    async function hasBlockBetween(uidA, uidB) {
        if (!uidA || !uidB) return true;
        const forward = `${uidA}_${uidB}`;
        const reverse = `${uidB}_${uidA}`;
        const [a, b] = await Promise.all([
            firestoreDb.collection('blocks').doc(forward).get(),
            firestoreDb.collection('blocks').doc(reverse).get()
        ]);
        return a.exists || b.exists;
    }

    function renderSmallBadge(node, total) {
        if (!node) return;
        const safeTotal = Math.max(0, Number(total) || 0);
        if (safeTotal > 0) {
            node.textContent = safeTotal > 4 ? '4+' : String(safeTotal);
            node.style.display = 'flex';
        } else {
            node.textContent = '0';
            node.style.display = 'none';
        }
    }

    // === Unread friend-requests tracking (per-user, persisted in localStorage) ===
    function getLastViewedRequestsAt(uid) {
        if (!uid) return 0;
        const raw = localStorage.getItem(`papiano:lastViewedRequestsAt:${uid}`);
        const ms = Number(raw) || 0;
        return ms;
    }
    function setLastViewedRequestsAt(uid, ms) {
        if (!uid) return;
        localStorage.setItem(`papiano:lastViewedRequestsAt:${uid}`, String(ms));
    }
    let cachedRequestDocs = [];
    function recomputeFriendRequestUnread() {
        if (!currentUser?.uid) {
            updateFriendRequestBadge(0);
            return;
        }
        const cutoffMs = getLastViewedRequestsAt(currentUser.uid);
        const unread = cachedRequestDocs.filter(item => {
            const createdMs = toMillisTimestamp(item.createdAt);
            return createdMs > cutoffMs;
        }).length;
        updateFriendRequestBadge(unread);
    }

    function updateNotificationBadges() {
        const total = privateUnreadTotal + friendRequestUnreadTotal + systemUnreadTotal;
        renderSmallBadge(chatNavUnreadBadge, total);
        renderSmallBadge(friendRequestsBadge, friendRequestUnreadTotal);
    }

    function updatePrivateUnreadBadge(total) {
        privateUnreadTotal = Math.max(0, Number(total) || 0);
        updateNotificationBadges();
    }

    function updateFriendRequestBadge(total) {
        friendRequestUnreadTotal = Math.max(0, Number(total) || 0);
        updateNotificationBadges();
    }

    function toMillisTimestamp(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (value?.toMillis) return value.toMillis();
        if (value?.toDate) return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getRoomUnreadForMe(room) {
        if (!currentUser?.uid || !room) return 0;
        const rawUnread = room.unreadCount?.[currentUser.uid];
        const explicitUnread = Math.max(0, Number(rawUnread) || 0);
        if (explicitUnread > 0) {
            // Even if server still reports unread, if I locally marked this room
            // read AND no newer message arrived from the other side since then,
            // treat as read (the server write just hasn't propagated yet).
            const localReadMs = locallyReadRooms.get(room.id) || 0;
            const updatedMs = toMillisTimestamp(room.updatedAt);
            if (localReadMs && updatedMs <= localReadMs) return 0;
            return explicitUnread;
        }
        // If unreadCount[uid] is explicitly defined (even as 0), trust it as
        // ground truth — markActiveRoomRead() writes 0 there.
        if (rawUnread !== undefined && rawUnread !== null) return 0;
        // Local read marker suppresses badge for rooms we opened before.
        const localReadMs = locallyReadRooms.get(room.id) || 0;
        const updatedMs = toMillisTimestamp(room.updatedAt);
        if (localReadMs && updatedMs <= localReadMs) return 0;
        // If the last sender is me, by definition I've read up through it.
        if (room.lastSenderId && room.lastSenderId === currentUser.uid) return 0;
        // If lastReadAt for this user doesn't exist at all, this is a legacy
        // room or one never explicitly marked — don't show phantom unread.
        const lastReadAt = room.lastReadAt?.[currentUser.uid];
        if (lastReadAt === undefined) return 0;
        // If lastReadAt exists but resolves to 0/null (pending serverTimestamp),
        // assume read to avoid flash on re-login.
        const lastReadMs = toMillisTimestamp(lastReadAt);
        if (!lastReadMs) return 0;
        // Genuine unread: room updated after our last read, by someone else.
        if (updatedMs > lastReadMs && room.lastSenderId && room.lastSenderId !== currentUser.uid) return 1;
        return 0;
    }

    function syncDirectUnreadFromProfiles() {
        const total = [...directChatProfiles.values()].reduce((sum, profile) => sum + Math.max(0, Number(profile.unreadForMe) || 0), 0);
        updatePrivateUnreadBadge(total);
    }

    function stopLeaderboardListeners() {
        if (typeof unsubscribeLeaderboardPlayTime === 'function') unsubscribeLeaderboardPlayTime();
        if (typeof unsubscribeLeaderboardDonation === 'function') unsubscribeLeaderboardDonation();
        unsubscribeLeaderboardPlayTime = null;
        unsubscribeLeaderboardDonation = null;
        stopLeaderboardLiveTicker();
        leaderboardRemoteRows = [];
        leaderboardProfiles.clear();
    }

    function stopCommunityListeners() {
        if (typeof unsubscribeFriends === 'function') unsubscribeFriends();
        if (typeof unsubscribeRequests === 'function') unsubscribeRequests();
        if (typeof unsubscribeDirectChats === 'function') unsubscribeDirectChats();
        if (typeof unsubscribeBlocks === 'function') unsubscribeBlocks();
        if (typeof unsubscribeMessages === 'function') unsubscribeMessages();
        unsubscribeSystemRooms.forEach(fn => { try { fn(); } catch (_e) {} });
        unsubscribeSystemRooms = [];
        unsubscribeFriends = null;
        unsubscribeRequests = null;
        unsubscribeDirectChats = null;
        unsubscribeBlocks = null;
        unsubscribeMessages = null;
        friendProfiles.clear();
        pendingFriendRequests.clear();
        directChatProfiles.clear();
        blockedUserIds.clear();
        blockedProfiles.clear();
        searchProfiles.clear();
        messageProfiles.clear();
        activeMessagesCache.clear();
        leaderboardProfiles.clear();
        cachedRequestDocs = [];
        updatePrivateUnreadBadge(0);
        updateFriendRequestBadge(0);
        renderFriendRows();
    }

    // === System rooms (Announcement / Global / Feedback) last-message preview ===
    const systemRoomUnread = new Map();

    function recomputeSystemUnread() {
        let total = 0;
        systemRoomUnread.forEach(count => { total += Math.max(0, Number(count) || 0); });
        systemUnreadTotal = total;
        updateNotificationBadges();
    }

    function clearSystemRoomUnread(docId) {
        if (!docId || !systemRoomUnread.has(docId)) return;
        systemRoomUnread.set(docId, 0);
        const badgeId = docId === getGroupRoomId('announcements') ? 'announcementUnreadBadge'
            : docId === getGroupRoomId('global') ? 'globalChatUnreadBadge' : '';
        if (badgeId) renderSmallBadge(document.getElementById(badgeId), 0);
        recomputeSystemUnread();
    }

    function startSystemRoomListeners() {
        const map = [
            { roomKey: 'announcements', stampId: 'announcementStamp', snippetId: 'announcementSnippet', badgeId: 'announcementUnreadBadge', defaultStamp: 'PUBLIC', defaultSnippet: 'Papiano updates.', alert: true },
            { roomKey: 'global',        stampId: 'globalChatStamp',   snippetId: 'globalChatSnippet',   badgeId: 'globalChatUnreadBadge', defaultStamp: 'PUBLIC', defaultSnippet: 'Community chat room.', alert: true },
            { roomKey: 'feedback',      stampId: 'feedbackStamp',     snippetId: 'feedbackSnippet',     defaultStamp: 'FEEDBACK', defaultSnippet: 'Feedback panel.', alert: false }
        ];
        map.forEach(({ roomKey, stampId, snippetId, badgeId, defaultStamp, defaultSnippet, alert }) => {
            const docId = getGroupRoomId(roomKey);
            const unsub = firestoreDb.collection('chatRooms').doc(docId).onSnapshot(snap => {
                const data = snap.exists ? (snap.data() || {}) : {};
                const stampNode = document.getElementById(stampId);
                const snippetNode = document.getElementById(snippetId);
                if (snippetNode) {
                    snippetNode.textContent = data.lastMessage ? String(data.lastMessage).slice(0, 120) : defaultSnippet;
                }
                if (stampNode) {
                    const ts = data.updatedAt;
                    const date = ts?.toDate ? ts.toDate() : null;
                    stampNode.textContent = date
                        ? formatChatListStamp(date)
                        : defaultStamp;
                }
                if (alert && badgeId) {
                    // Treat the room as unread when it was updated by someone else
                    // after our last read (suppressed while we're viewing it).
                    const isViewing = activeChatRoomId === docId;
                    const unread = isViewing ? 0 : getRoomUnreadForMe({ id: docId, ...data });
                    systemRoomUnread.set(docId, unread);
                    renderSmallBadge(document.getElementById(badgeId), unread);
                    recomputeSystemUnread();
                }
            }, _err => {
                // On error keep defaults silently
            });
            unsubscribeSystemRooms.push(unsub);
        });
    }

    function startCommunityListeners() {
        stopCommunityListeners();
        if (!currentUser?.uid) {
            renderFriendRows();
            return;
        }
        startSystemRoomListeners();
        unsubscribeFriends = firestoreDb.collection('friendships')
            .where('users', 'array-contains', currentUser.uid)
            .onSnapshot(async snapshot => {
                const accepted = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(item => item.status === 'accepted' && Array.isArray(item.users));
                const friendIds = [...new Set(accepted.map(item => item.users.find(uid => uid !== currentUser.uid)).filter(Boolean))];
                friendProfiles = await hydrateProfilesByIds(friendIds);
                renderFriendRows();
            }, error => showToast('Couldn’t load friends.'));

        unsubscribeRequests = firestoreDb.collection('friendships')
            .where('receiverId', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .onSnapshot(async snapshot => {
                const requestDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const senderIds = [...new Set(requestDocs.map(item => item.requesterId).filter(Boolean))];
                const profiles = await hydrateProfilesByIds(senderIds);
                pendingFriendRequests.clear();
                requestDocs.forEach(item => {
                    const profile = profiles.get(item.requesterId) || normalizeProfile(item.requesterId, {});
                    pendingFriendRequests.set(item.id, { ...profile, requestId: item.id });
                });
                cachedRequestDocs = requestDocs;
                recomputeFriendRequestUnread();
                renderFriendRows();
            }, error => showToast('Couldn’t load requests.'));

        unsubscribeBlocks = firestoreDb.collection('blocks')
            .where('blockerId', '==', currentUser.uid)
            .onSnapshot(async snapshot => {
                const blockedIds = snapshot.docs.map(doc => doc.data()?.blockedId).filter(Boolean);
                blockedUserIds = new Set(blockedIds);
                blockedProfiles = await hydrateProfilesByIds(blockedIds);
                blockedUserIds.forEach(uid => directChatProfiles.delete(uid));
                renderFriendRows();
            }, error => showToast('Couldn’t load blocked users.'));

        unsubscribeDirectChats = firestoreDb.collection('chatRooms')
            .where('participants', 'array-contains', currentUser.uid)
            .onSnapshot(async snapshot => {
                const rooms = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(room => room.type === 'dm' && Array.isArray(room.participants));
                const targetIds = [...new Set(rooms.map(room => room.participants.find(uid => uid !== currentUser.uid)).filter(Boolean))]
                    .filter(uid => !blockedUserIds.has(uid));
                const hydrated = await hydrateProfilesByIds(targetIds);
                directChatProfiles.clear();
                rooms.forEach(room => {
                    const targetUid = room.participants.find(uid => uid !== currentUser.uid);
                    // Double-check blockedUserIds after async hydration (may have updated during await)
                    if (!targetUid || blockedUserIds.has(targetUid)) return;
                    const folderHidden = Array.isArray(room.hiddenFolderFor) && room.hiddenFolderFor.includes(currentUser.uid);
                    const blockedFolder = Array.isArray(room.blockedFor) && room.blockedFor.includes(currentUser.uid);
                    if (folderHidden || blockedFolder) return;

                    // Robust cleared-state detection (also handles legacy data where
                    // an old buggy unblock wiped hiddenFolderFor/clearedBy):
                    // - If I'm in clearedBy AND the other user hasn't sent anything new -> hide.
                    // - If lastMessage is the legacy sentinel 'Chat cleared' or empty AND
                    //   no fresh activity from the other user -> hide.
                    const myInClearedBy = Array.isArray(room.clearedBy) && room.clearedBy.includes(currentUser.uid);
                    const noActivityFromOther = !room.lastSenderId || room.lastSenderId === currentUser.uid;
                    const lastMsgEmpty = !room.lastMessage;
                    const lastMsgLegacyCleared = room.lastMessage === 'Chat cleared';
                    if (myInClearedBy && noActivityFromOther) return;
                    if ((lastMsgEmpty || lastMsgLegacyCleared) && noActivityFromOther) return;

                    const profile = hydrated.get(targetUid) || normalizeProfile(targetUid, {});
                    const previewCleared = myInClearedBy;
                    // If this DM is currently being viewed, treat as read (covers race
                    // conditions where the snapshot fires before serverTimestamp resolves).
                    const isCurrentlyViewing = activeChatRoomType === 'dm' && activeChatTargetUid === targetUid;
                    const unreadForMe = (previewCleared || isCurrentlyViewing) ? 0 : getRoomUnreadForMe(room);
                    directChatProfiles.set(targetUid, {
                        ...profile,
                        lastMessage: previewCleared ? 'No messages yet.' : (room.lastMessage || 'No messages yet.'),
                        lastMessageAt: previewCleared ? null : (room.updatedAt || null),
                        unreadForMe
                    });
                });
                syncDirectUnreadFromProfiles();
                renderFriendRows();
            }, error => showToast('Couldn’t load private chats.'));
    }

    async function respondFriendRequest(requestId, accept) {
        if (!currentUser?.uid || !requestId) return;
        try {
            const ref = firestoreDb.collection('friendships').doc(requestId);
            if (accept) {
                await ref.set({ status: 'accepted', acceptedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            } else {
                await ref.delete();
            }
            showToast(accept ? 'Friend request accepted.' : 'Friend request declined.', 'Friends');
        } catch (error) {
            showToast('Couldn’t update this request.');
        }
    }

    async function sendFriendRequest(targetUid) {
        if (!currentUser?.uid) {
            showToast('Sign in to add friends.');
            return;
        }
        if (!targetUid || targetUid === currentUser.uid) {
            showToast('You cannot add this profile.');
            return;
        }
        const now = Date.now();
        if (now - lastFriendRequestSentAt < FRIEND_REQUEST_COOLDOWN_MS) {
            showToast('Please wait before sending another friend request.');
            return;
        }
        lastFriendRequestSentAt = now;
        try {
            if (await hasBlockBetween(currentUser.uid, targetUid)) {
                showToast('Friend request blocked.');
                return;
            }
            const pairId = buildPairId(currentUser.uid, targetUid);
            const ref = firestoreDb.collection('friendships').doc(pairId);
            const snap = await ref.get();
            if (snap.exists) {
                const status = snap.data()?.status;
                showToast(status === 'accepted' ? 'Already friends.' : 'Request already sent.');
                return;
            }
            await ref.set({
                users: [currentUser.uid, targetUid],
                requesterId: currentUser.uid,
                receiverId: targetUid,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            searchProfiles.delete(targetUid);
            renderFriendRows();
            showToast('Friend request sent.', 'Friends');
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t send the friend request.'));
        }
    }

    async function searchProfileByPublicId(query) {
        if (!currentUser?.uid || !firestoreDb) return;
        const clean = String(query || '').trim();
        const normalized = clean.toLowerCase();
        if (normalized === lastProfileSearchQuery) return;
        lastProfileSearchQuery = normalized;
        searchProfiles.clear();
        if (clean.length < 1) {
            renderFriendRows();
            return;
        }
        try {
            const found = new Map();
            if (/^#?\d+$/.test(clean)) {
                const publicId = Number(clean.replace('#', ''));
                if (Number.isInteger(publicId) && publicId > 0) {
                    const idSnap = await firestoreDb.collection('profiles').where('publicId', '==', publicId).limit(12).get().catch(() => null);
                    idSnap?.forEach(doc => found.set(doc.id, normalizeProfile(doc.id, doc.data() || {})));
                    const userIdSnap = await firestoreDb.collection('profiles').where('userId', '==', formatPublicUserId(publicId)).limit(12).get().catch(() => null);
                    userIdSnap?.forEach(doc => found.set(doc.id, normalizeProfile(doc.id, doc.data() || {})));
                }
            }
            if (clean.length >= 2) {
                const lowerSnap = await firestoreDb.collection('profiles')
                    .orderBy('searchName')
                    .startAt(normalized)
                    .endAt(normalized + '')
                    .limit(20)
                    .get()
                    .catch(() => null);
                lowerSnap?.forEach(doc => found.set(doc.id, normalizeProfile(doc.id, doc.data() || {})));

                const nameSnap = await firestoreDb.collection('profiles')
                    .orderBy('name')
                    .startAt(clean)
                    .endAt(clean + '')
                    .limit(20)
                    .get()
                    .catch(() => null);
                nameSnap?.forEach(doc => found.set(doc.id, normalizeProfile(doc.id, doc.data() || {})));
            }
            if (!found.size || /^#?\d+$/.test(clean)) {
                // Targeted search by publicId for numeric queries
                const numericId = Number(clean.replace(/^#/, ''));
                if (Number.isInteger(numericId) && numericId > 0) {
                    const idSnap = await firestoreDb.collection('profiles')
                        .where('publicId', '==', numericId)
                        .limit(5)
                        .get()
                        .catch(() => null);
                    idSnap?.forEach(doc => found.set(doc.id, normalizeProfile(doc.id, doc.data() || {})));
                }
            }
            found.forEach((profile, uid) => {
                if (uid !== currentUser.uid && !friendProfiles.has(uid)) searchProfiles.set(uid, profile);
            });
        } catch (error) {
            showToast('Search is unavailable right now.');
        }
        renderFriendRows();
    }

    function scheduleProfileSearch(query) {
        clearTimeout(profileSearchTimer);
        profileSearchTimer = setTimeout(() => searchProfileByPublicId(query), 160);
    }

    function switchChatSubView(view) {
        currentChatSubView = ['friends', 'requests', 'blocked'].includes(view) ? view : 'chats';
        if (currentChatSubView !== 'friends') {
            searchProfiles.clear();
            lastProfileSearchQuery = '';
        }
        // When the user actually opens the Requests tab, mark all current requests as seen.
        if (currentChatSubView === 'requests' && currentUser?.uid) {
            setLastViewedRequestsAt(currentUser.uid, Date.now());
            recomputeFriendRequestUnread();
        }
        document.querySelectorAll('.friend-nav-btn').forEach(button => button.classList.remove('active'));
        const target = {
            chats: 'subTabChatsBtn',
            friends: 'subTabFriendsBtn',
            requests: 'subTabRequestsBtn',
            blocked: 'subTabBlockedBtn'
        }[currentChatSubView] || 'subTabChatsBtn';
        document.getElementById(target)?.classList.add('active');
        filterChatMatrixList();
    }

    function filterChatMatrixList(allowSearch = true) {
        const q = (friendSearchField?.value || '').trim().toLowerCase();
        const canSearchProfiles = currentChatSubView === 'friends';
        if (allowSearch && q && canSearchProfiles) scheduleProfileSearch(q);
        let visible = 0;
        const selector = {
            chats: '.chat-matrix-node, .dm-list-node',
            friends: '.friend-list-node, .search-result-node',
            requests: '.request-list-node',
            blocked: '.blocked-list-node'
        }[currentChatSubView] || '.chat-matrix-node, .dm-list-node';
        document.querySelectorAll('.chat-matrix-node, .friend-list-node, .request-list-node, .blocked-list-node, .search-result-node, .dm-list-node').forEach(row => {
            const inActiveView = row.matches(selector);
            const match = inActiveView && (!q || String(row.dataset.name || row.textContent || '').toLowerCase().includes(q));
            row.style.display = match ? '' : 'none';
            if (match) visible += 1;
        });
        if (chatEmptyRow) {
            const showEmpty = !visible;
            chatEmptyRow.style.display = showEmpty ? '' : 'none';
            const title = document.getElementById('chatEmptyTitle');
            const text = document.getElementById('chatEmptyText');
            const emptyCopy = {
                chats: ['No chat yet', 'Open Global Chat or start a private chat.'],
                friends: ['No users found', 'Search by name or #ID to add friends.'],
                requests: ['No requests yet', 'Friend requests will appear here.'],
                blocked: ['No blocked users', 'Blocked users will appear here.']
            }[currentChatSubView] || ['No results yet', 'No matching item.'];
            if (title) title.textContent = emptyCopy[0];
            if (text) text.textContent = emptyCopy[1];
        }
    }

    async function openCommunityRoom(roomId) {
        if (!currentUser?.uid) {
            showToast('Sign in to use chat.');
            openAuthEntryPopup('signin');
            return;
        }
        const normalizedRoomId = roomId || 'global';
        activeChatRoomId = getGroupRoomId(normalizedRoomId);
        activeChatRoomType = 'group';
        activeChatTargetUid = '';
        if (chatRoomActiveTitle) chatRoomActiveTitle.textContent = roomTitles[normalizedRoomId] || 'Chat';
        if (chatOverlayRoom) chatOverlayRoom.style.display = 'flex';
        syncChatRoomAccessState(normalizedRoomId);
        listenToActiveRoomMessages();
        ensureGroupRoomHistoryVisible(normalizedRoomId);
        markActiveRoomRead();
        clearSystemRoomUnread(activeChatRoomId);
    }

    async function ensureGroupRoomHistoryVisible(roomId) {
        if (!currentUser?.uid || !firestoreDb || !activeChatRoomId) return;
        try {
            const roomRef = firestoreDb.collection('chatRooms').doc(activeChatRoomId);
            await roomRef.set({
                type: 'group',
                roomKey: roomId || 'global',
                historyVisible: true,
                participants: []
            }, { merge: true });
        } catch (error) {
            console.warn('Group room history metadata skipped:', error);
        }
    }

    async function openDirectRoom(targetUid) {
        if (!currentUser?.uid) {
            showToast('Sign in to open private chat.');
            return;
        }
        if (!targetUid || targetUid === currentUser.uid) {
            showToast('Cannot open this chat.');
            return;
        }
        const roomId = getDirectRoomId(currentUser.uid, targetUid);
        const profile = friendProfiles.get(targetUid) || directChatProfiles.get(targetUid) || searchProfiles.get(targetUid) || normalizeProfile(targetUid, {});
        activeChatRoomId = roomId;
        activeChatRoomType = 'dm';
        activeChatTargetUid = targetUid;
        if (chatRoomActiveTitle) chatRoomActiveTitle.textContent = profile.name || 'Private Chat';
        if (chatRoomMenuBtn) chatRoomMenuBtn.style.display = 'flex';
        if (chatInputBar) chatInputBar.classList.remove('read-only');
        const uploadButton = chatInputBar?.querySelector('button[aria-label="Upload image"]');
        if (uploadButton) uploadButton.style.display = 'flex';
        if (chatInputFieldMessage) chatInputFieldMessage.placeholder = 'Type a message...';
        if (chatOverlayRoom) chatOverlayRoom.style.display = 'flex';
        if (chatMessagesScrollArea) chatMessagesScrollArea.innerHTML = `<div class="chat-system-note">Opening chat...</div>`;
        closeFriendProfileModal();
        try {
            if (await hasBlockBetween(currentUser.uid, targetUid)) {
                closeChatOverlayRoom();
                showToast('Private chat is blocked.');
                return;
            }
            const friendRef = firestoreDb.collection('friendships').doc(buildPairId(currentUser.uid, targetUid));
            const friendSnap = await friendRef.get();
            if (!friendSnap.exists || friendSnap.data()?.status !== 'accepted') {
                closeChatOverlayRoom();
                showToast('Add this user as friend first.');
                return;
            }
            // Only modify MY own state when opening a chat. Don't wipe the other
            // user's hiddenFolderFor/clearedBy (that's their decision).
            await firestoreDb.collection('chatRooms').doc(roomId).set({
                type: 'dm',
                participants: [currentUser.uid, targetUid],
                hiddenFolderFor: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                clearedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                blockedFor: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                [`unreadCount.${currentUser.uid}`]: 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            listenToActiveRoomMessages();
            markActiveRoomRead();
        } catch (error) {
            closeChatOverlayRoom();
            showToast('Couldn’t open private chat.');
        }
    }

    let markReadTimer = null;
    let lastMarkedRoomId = '';

    async function markActiveRoomRead() {
        if (!currentUser?.uid || !activeChatRoomId || !firestoreDb) return;
        markRoomLocallyRead(activeChatRoomId);
        if (activeChatRoomType === 'dm' && activeChatTargetUid && directChatProfiles.has(activeChatTargetUid)) {
            directChatProfiles.set(activeChatTargetUid, { ...directChatProfiles.get(activeChatTargetUid), unreadForMe: 0 });
            syncDirectUnreadFromProfiles();
        }
        if (lastMarkedRoomId === activeChatRoomId && markReadTimer) return;
        lastMarkedRoomId = activeChatRoomId;
        clearTimeout(markReadTimer);
        const roomId = activeChatRoomId;
        const readerUid = currentUser.uid;
        markReadTimer = setTimeout(async () => {
            markReadTimer = null;
            if (!readerUid || !firestoreDb) return;
            try {
                await firestoreDb.collection('chatRooms').doc(roomId).set({
                    [`unreadCount.${readerUid}`]: 0,
                    [`lastReadAt.${readerUid}`]: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                if (roomId === getGroupRoomId('announcements')) {
                    localStorage.setItem(getAnnouncementReadStorageKey(), String(Date.now()));
                }
            } catch (_) {}
        }, 2000);
    }

    function listenToActiveRoomMessages() {
        if (typeof unsubscribeMessages === 'function') unsubscribeMessages();
        unsubscribeMessages = null;
        if (!currentUser?.uid) {
            if (chatMessagesScrollArea) chatMessagesScrollArea.innerHTML = `<div class="chat-system-note">Sign in to view chat.</div>`;
            return;
        }
        if (!activeChatRoomId) return;
        if (chatMessagesScrollArea) {
            chatMessagesScrollArea.innerHTML = `
                <div class="skeleton-msg"><div class="skeleton-line" style="width:120px;"></div><div class="skeleton-line" style="width:180px;"></div></div>
                <div class="skeleton-msg right"><div class="skeleton-line" style="width:90px;"></div></div>
                <div class="skeleton-msg"><div class="skeleton-line" style="width:160px;"></div></div>
            `;
        }
        const historyLimit = activeChatRoomType === 'group' ? 180 : 80;
        unsubscribeMessages = firestoreDb.collection('chatRooms').doc(activeChatRoomId).collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(historyLimit)
            .onSnapshot(async snapshot => {
                const messages = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .reverse()
                    .filter(item => !(Array.isArray(item.hiddenFor) && currentUser?.uid && item.hiddenFor.includes(currentUser.uid)))
                    .filter(item => item.deletedForAll !== true)
                    .filter(item => !item.senderId || !blockedUserIds.has(item.senderId));
                await hydrateMessageProfiles(messages);
                renderChatMessages(messages);
                // Auto mark-read whenever the listener fires while the chat is open,
                // so incoming messages don't leave a lingering unread badge.
                markActiveRoomRead();
            }, error => {
                if (chatMessagesScrollArea) chatMessagesScrollArea.innerHTML = `<div class="chat-system-note">Couldn’t load messages.</div>`;
            });
    }

    async function hydrateMessageProfiles(messages) {
        const ids = [...new Set((messages || []).map(item => item.senderId).filter(Boolean))];
        const missing = ids.filter(uid => !messageProfiles.has(uid));
        if (!missing.length) return;
        const loaded = await hydrateProfilesByIds(missing);
        loaded.forEach((profile, uid) => messageProfiles.set(uid, profile));
    }

    const CHAT_LOCALE = 'en-US';

    function chatTimestampToDate(value) {
        return value?.toDate ? value.toDate() : value instanceof Date ? value : (typeof value === 'number' && value > 0 ? new Date(value) : null);
    }

    function startOfChatDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    // Clock only (HH:MM) for message bubbles — the day is shown by the
    // day divider that separates messages across the 00:00 boundary.
    function formatMessageClock(value) {
        const date = chatTimestampToDate(value);
        if (!date || Number.isNaN(date.getTime())) return 'Sending';
        return date.toLocaleTimeString(CHAT_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // Full day label for the divider shown between messages of different days.
    function formatChatDayDivider(value) {
        const date = chatTimestampToDate(value);
        if (!date || Number.isNaN(date.getTime())) return '';
        const now = new Date();
        const dayDiff = Math.round((startOfChatDay(now) - startOfChatDay(date)) / 86400000);
        if (dayDiff <= 0) return 'Today';
        if (dayDiff === 1) return 'Yesterday';
        if (dayDiff < 7) return date.toLocaleDateString(CHAT_LOCALE, { weekday: 'long' });
        const sameYear = date.getFullYear() === now.getFullYear();
        return date.toLocaleDateString(CHAT_LOCALE, sameYear
            ? { day: 'numeric', month: 'long' }
            : { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Telegram-style single-token stamp for chat-list rows (folders):
    //   today        → 02:00         (24-hour clock only)
    //   1–6 days ago → Sunday        (weekday)
    //   this year    → 9 July        (day + month, day-first)
    //   older        → 9 July 2024   (day + month + year)
    // Day+month is built manually so it stays day-first ('en-US' would give "July 9").
    function formatChatListStamp(value) {
        const date = chatTimestampToDate(value);
        if (!date || Number.isNaN(date.getTime())) return 'Sending';
        const now = new Date();
        const dayDiff = Math.round((startOfChatDay(now) - startOfChatDay(date)) / 86400000);
        if (dayDiff <= 0) {
            return date.toLocaleTimeString(CHAT_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (dayDiff < 7) {
            return date.toLocaleDateString(CHAT_LOCALE, { weekday: 'long' });
        }
        const day = date.getDate();
        const month = date.toLocaleDateString(CHAT_LOCALE, { month: 'long' });
        return date.getFullYear() === now.getFullYear()
            ? `${day} ${month}`
            : `${day} ${month} ${date.getFullYear()}`;
    }

    function getMessageSenderProfile(message) {
        if (message.senderId === currentUser?.uid && currentProfile) return currentProfile;
        return messageProfiles.get(message.senderId) || friendProfiles.get(message.senderId) || directChatProfiles.get(message.senderId) || searchProfiles.get(message.senderId) || normalizeProfile(message.senderId || '', {
            name: message.senderName || 'Papiano User',
            userId: message.senderUserId || '',
            photoURL: message.senderPhotoURL || '',
            badgeId: message.senderBadgeId || 'common'
        });
    }

    function renderMessageAvatar(profile) {
        const avatarBody = profile?.photoURL && isSafeImage(profile.photoURL)
            ? `<img src="${escapeHtml(profile.photoURL)}" alt="">`
            : escapeHtml(getInitials(profile?.name || 'User'));
        return `<button class="message-avatar" type="button" onclick="event.stopPropagation(); launchFriendProfileModal('${escapeHtml(profile?.uid || '')}')">${avatarBody}</button>`;
    }

    function createReplyPreview(reply) {
        if (!reply) return '';
        const label = reply.imageURL ? 'Photo' : String(reply.text || '').slice(0, 90);
        return `<div class="reply-source-card"><strong>${escapeHtml(reply.senderName || 'User')}</strong><span>${escapeHtml(label || 'Message')}</span></div>`;
    }

    function renderChatMessages(messages) {
        if (!chatMessagesScrollArea) return;
        if (!messages.length) {
            chatMessagesScrollArea.innerHTML = `<div class="chat-system-note">No messages yet.</div>`;
            return;
        }
        activeMessagesCache.clear();
        messages.forEach(message => activeMessagesCache.set(message.id, message));
        let lastDayKey = null;
        chatMessagesScrollArea.innerHTML = messages.map(message => {
            // Day divider at the 00:00 boundary between consecutive messages.
            const mDate = chatTimestampToDate(message.createdAt);
            const dayKey = mDate ? startOfChatDay(mDate) : null;
            let dayDivider = '';
            if (dayKey && dayKey !== lastDayKey) {
                dayDivider = `<div class="chat-day-divider"><span>${escapeHtml(formatChatDayDivider(message.createdAt))}</span></div>`;
                lastDayKey = dayKey;
            }
            const mine = message.senderId === currentUser?.uid;
            const rowClass = mine ? 'row-outgoing msg-outgoing' : 'row-incoming msg-incoming';
            const profile = getMessageSenderProfile(message);
            const image = message.imageURL ? `<img class="chat-image-preview" src="${escapeHtml(message.imageURL)}" alt="Chat image">` : '';
            const text = message.text ? linkifyText(message.text) : '';
            const announcementLocked = isAnnouncementRoom() && !isAnnouncementOwner();
            const replyButton = announcementLocked
                ? ''
                : `<button class="msg-reply-icon-btn" type="button" aria-label="Reply" title="Reply" onclick="event.stopPropagation(); beginReplyToMessage('${message.id}')"><span class="material-symbols-rounded">reply</span></button>`;
            const actions = buildMessageActionStrip(message, mine, announcementLocked);
            const swipeHandlers = announcementLocked ? '' : ` onpointerdown="startMessageSwipe(event, this)" onpointermove="moveMessageSwipe(event, this)" onpointerup="endMessageSwipe(event, this, '${message.id}')" onpointercancel="cancelMessageSwipe(this)"`;
            return `
                ${dayDivider}
                <div class="msg-node-row ${rowClass}" data-message-id="${escapeHtml(message.id)}" onclick="handleMessageRowClick(event, this)">
                    <div class="msg-container-with-avatar">
                        ${renderMessageAvatar(profile)}
                        <div class="msg-bubble${replyButton ? ' has-reply-action' : ''}"${swipeHandlers}>
                            ${replyButton}
                            ${!mine || activeChatRoomType === 'group' ? `<b class="msg-sender-name">${escapeHtml(profile.name || message.senderName || 'Papiano User')} ${escapeHtml(profile.userId || message.senderUserId || '')}</b>` : ''}
                            ${createReplyPreview(message.replyTo)}
                            ${text}${image}
                            <div class="msg-meta-line"><time>${formatMessageClock(message.createdAt)}</time></div>
                        </div>
                    </div>
                    ${actions}
                </div>
            `;
        }).join('');
        // Tap-to-reveal edit/delete must survive re-renders: busy rooms (Global)
        // rebuild this list on every snapshot, which would otherwise wipe the tap.
        const keepActiveMsg = chatMessagesScrollArea.dataset.activeMsg || '';
        if (keepActiveMsg) {
            const keepRow = chatMessagesScrollArea.querySelector(`.msg-node-row[data-message-id="${keepActiveMsg}"]`);
            if (keepRow) keepRow.classList.add('active-actions');
        }
        chatMessagesScrollArea.scrollTop = chatMessagesScrollArea.scrollHeight;
    }

    function isDirectChatRoom() {
        return activeChatRoomType === 'dm' && Boolean(activeChatTargetUid);
    }

    function buildMessageActionStrip(message, mine, announcementLocked) {
        if (announcementLocked || !message?.id) return '';
        const messageId = escapeHtml(message.id);
        if (mine) {
            if (isDirectChatRoom()) {
                return `<div class="msg-action-strip"><button class="msg-action-btn" type="button" onclick="editOwnMessage('${messageId}')">Edit</button><button class="msg-action-btn danger" type="button" onclick="deleteMessageForBoth('${messageId}')">Delete for both</button><button class="msg-action-btn danger" type="button" onclick="deleteMessageForMe('${messageId}')">Delete for me</button></div>`;
            }
            return `<div class="msg-action-strip"><button class="msg-action-btn" type="button" onclick="editOwnMessage('${messageId}')">Edit</button><button class="msg-action-btn danger" type="button" onclick="deleteOwnMessage('${messageId}')">Delete message</button></div>`;
        }
        if (isDirectChatRoom()) {
            return `<div class="msg-action-strip"><button class="msg-action-btn danger" type="button" onclick="deleteMessageForMe('${messageId}')">Delete for me</button></div>`;
        }
        return `<div class="msg-action-strip"><button class="msg-action-btn" type="button" onclick="reportMessageSender('${messageId}')">Report</button></div>`;
    }

    function handleMessageRowClick(event, row) {
        if (swipeMoved || event.target.closest('button, a')) return;
        row.classList.toggle('active-actions');
        // Remember the revealed message so renderChatMessages() can restore it after a
        // re-render (busy rooms rebuild the whole list and would otherwise wipe the tap).
        if (chatMessagesScrollArea) {
            chatMessagesScrollArea.dataset.activeMsg = row.classList.contains('active-actions')
                ? (row.getAttribute('data-message-id') || '')
                : '';
        }
    }

    function startMessageSwipe(event, bubble) {
        swipeStartX = event.clientX || 0;
        swipeStartY = event.clientY || 0;
        swipeMoved = false;
        bubble.classList.add('swiping');
    }

    function moveMessageSwipe(event, bubble) {
        if (!swipeStartX) return;
        const dx = (event.clientX || 0) - swipeStartX;
        const dy = Math.abs((event.clientY || 0) - swipeStartY);
        if (Math.abs(dx) < 8 || dy > 34) return;
        swipeMoved = true;
        const mine = bubble.closest('.msg-node-row')?.classList.contains('row-outgoing');
        const allowed = mine ? Math.min(0, dx) : Math.max(0, dx);
        const clamped = Math.max(-76, Math.min(76, allowed));
        bubble.style.transform = `translateX(${clamped}px)`;
    }

    function endMessageSwipe(event, bubble, messageId) {
        const dx = (event.clientX || 0) - swipeStartX;
        const mine = bubble.closest('.msg-node-row')?.classList.contains('row-outgoing');
        cancelMessageSwipe(bubble);
        if ((mine && dx < -54) || (!mine && dx > 54)) beginReplyToMessage(messageId);
        setTimeout(() => { swipeMoved = false; }, 80);
    }

    function cancelMessageSwipe(bubble) {
        if (bubble) {
            bubble.style.transform = '';
            bubble.classList.remove('swiping');
        }
        swipeStartX = 0;
        swipeStartY = 0;
    }

    function closeChatOverlayRoom() {
        if (typeof unsubscribeMessages === 'function') unsubscribeMessages();
        unsubscribeMessages = null;
        if (chatOverlayRoom) chatOverlayRoom.style.display = 'none';
        if (chatRoomMenuBtn) chatRoomMenuBtn.style.display = 'none';
        closeChatToolsMenu();
        activeChatRoomId = '';
        activeChatRoomType = '';
        activeChatTargetUid = '';
        cancelActiveReplyState();
        clearPendingChatImage();
    }

    function configureChatToolsMenu() {
        const title = document.getElementById('chatToolsTitle');
        const icon = document.querySelector('#chatToolsIcon .material-symbols-rounded');
        const clearMeBtn = document.getElementById('chatToolsClearMeBtn');
        const clearAllText = document.getElementById('chatToolsClearAllText');

        if (title) title.textContent = 'Private Chat Folder';
        if (icon) icon.textContent = 'folder_delete';
        if (clearMeBtn) clearMeBtn.style.display = '';
        if (clearAllText) clearAllText.textContent = 'Clear for both users';
    }

    function openChatToolsMenu() {
        if (!chatToolsModal) return;
        if (!canManageActiveChatFolder()) {
            closeChatToolsMenu();
            showToast('Chat folder tools are only available in private chats.');
            return;
        }
        configureChatToolsMenu();
        chatToolsModal.classList.add('active');
    }

    function closeChatToolsMenu() {
        chatToolsModal?.classList.remove('active');
    }

    async function patchChatRoomMessagesInBatches(roomRef, patchFactory) {
        const messagesRef = roomRef.collection('messages');
        let total = 0;
        let snap = await messagesRef.orderBy('createdAt', 'desc').limit(500).get();
        while (!snap.empty) {
            const batch = firestoreDb.batch();
            snap.docs.forEach(doc => {
                const patch = typeof patchFactory === 'function' ? patchFactory(doc) : patchFactory;
                batch.set(doc.ref, patch, { merge: true });
            });
            await batch.commit();
            total += snap.docs.length;
            if (snap.docs.length < 500) break;
            const lastDoc = snap.docs[snap.docs.length - 1];
            snap = await messagesRef.orderBy('createdAt', 'desc').startAfter(lastDoc).limit(500).get();
        }
        return total;
    }

    async function clearActiveChatHistory() {
        if (!currentUser?.uid || !activeChatRoomId) {
            showToast('No active chat.');
            return;
        }
        if (!canManageActiveChatFolder()) {
            closeChatToolsMenu();
            showToast('Chat folder tools are only available in private chats.');
            return;
        }
        try {
            const roomRef = firestoreDb.collection('chatRooms').doc(activeChatRoomId);
            await patchChatRoomMessagesInBatches(roomRef, {
                hiddenFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const roomPatch = {
                clearedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (activeChatRoomType === 'dm') roomPatch.hiddenFolderFor = firebase.firestore.FieldValue.arrayUnion(currentUser.uid);
            await roomRef.set(roomPatch, { merge: true });
            if (activeChatRoomType === 'dm' && activeChatTargetUid) directChatProfiles.delete(activeChatTargetUid);
            renderFriendRows();
            closeChatToolsMenu();
            closeChatOverlayRoom();
            showToast('Chat cleared for you.', 'Chat');
        } catch (error) {
            showToast('Couldn’t clear history.');
        }
    }

    async function clearActiveChatForAll() {
        if (!currentUser?.uid || !activeChatRoomId) {
            showToast('No active chat.');
            return;
        }
        if (!canManageActiveChatFolder()) {
            closeChatToolsMenu();
            showToast('Chat folder tools are only available in private chats.');
            return;
        }
        if (!await openThemedConfirm({
            title: 'Clear Private Chat',
            message: 'Clear this private chat for both users?',
            confirmLabel: 'Clear',
            cancelLabel: 'Keep',
            danger: true
        })) return;
        try {
            const roomRef = firestoreDb.collection('chatRooms').doc(activeChatRoomId);
            const roomSnap = await roomRef.get().catch(() => null);
            const roomData = roomSnap?.exists ? (roomSnap.data() || {}) : {};
            const participants = Array.isArray(roomData.participants) && roomData.participants.length
                ? roomData.participants
                : [currentUser.uid, activeChatTargetUid].filter(Boolean);
            await patchChatRoomMessagesInBatches(roomRef, {
                deletedForAll: true,
                text: '',
                imageURL: '',
                imagePath: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const roomPatch = {
                lastMessage: '',
                lastSenderId: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                clearedBy: firebase.firestore.FieldValue.arrayUnion(...participants)
            };
            if (activeChatRoomType === 'dm') roomPatch.hiddenFolderFor = firebase.firestore.FieldValue.arrayUnion(...participants);
            await roomRef.set(roomPatch, { merge: true });
            if (activeChatRoomType === 'dm' && activeChatTargetUid) directChatProfiles.delete(activeChatTargetUid);
            renderFriendRows();
            closeChatToolsMenu();
            closeChatOverlayRoom();
            showToast('Chat cleared for both users.', 'Chat');
        } catch (error) {
            showToast('Couldn’t clear this chat for everyone.');
        }
    }

    function triggerChatImagePicker() {
        if (!currentUser?.uid) {
            showToast('Sign in to upload image.');
            return;
        }
        chatImageFilePicker?.click();
    }

    async function handleChatImageFile(event) {
        const file = event?.target?.files?.[0];
        const validationError = validateUploadImageFile(file, MAX_CHAT_IMAGE_BYTES, 'Chat image');
        if (validationError) {
            showToast(validationError);
            if (event?.target) event.target.value = '';
            return;
        }
        if (!currentUser?.uid) {
            showToast('Sign in to upload image.');
            if (event?.target) event.target.value = '';
            return;
        }
        try {
            const upload = await uploadImageToSupabaseStorage('chat-images', file, 'chat', 'message', {
                maxBytes: MAX_CHAT_IMAGE_BYTES,
                label: 'Chat image'
            });
            pendingChatImageData = upload.url;
            pendingChatImagePath = upload.path;
            if (chatSelectedImagePreviewImg) chatSelectedImagePreviewImg.src = pendingChatImageData;
            if (chatSelectedImagePreviewText) chatSelectedImagePreviewText.textContent = safeSupabaseStorageName(file.name || 'image');
            if (chatSelectedImagePreview) chatSelectedImagePreview.classList.add('active');
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t upload the image. Please try again.'));
        } finally {
            if (event?.target) event.target.value = '';
        }
    }

    function clearPendingChatImage() {
        pendingChatImageData = '';
        pendingChatImagePath = '';
        if (chatSelectedImagePreview) chatSelectedImagePreview.classList.remove('active');
        if (chatSelectedImagePreviewImg) chatSelectedImagePreviewImg.removeAttribute('src');
        if (chatSelectedImagePreviewText) chatSelectedImagePreviewText.textContent = 'Image ready to send';
        if (chatImageFilePicker) chatImageFilePicker.value = '';
    }

    async function executeSendMessage() {
        const rawMessageText = String(chatInputFieldMessage?.value || '');
        if (rawMessageText.length > MAX_CHAT_MESSAGE_CHARS) {
            showToast(`Message limit is ${MAX_CHAT_MESSAGE_CHARS} characters.`);
            if (chatInputFieldMessage) {
                chatInputFieldMessage.value = rawMessageText.slice(0, MAX_CHAT_MESSAGE_CHARS);
                handleChatInputChange(chatInputFieldMessage);
            }
            return;
        }
        const text = rawMessageText.trim();
        if (!currentUser?.uid) {
            showToast('Sign in to send messages.');
            return;
        }
        if (!activeChatRoomId) {
            showToast('Open a chat first.');
            return;
        }
        if (isAnnouncementRoom() && !isAnnouncementOwner()) {
            showToast('Only owner can post announcements.');
            return;
        }
        if (!text && !pendingChatImageData) return;
        const now = Date.now();
        if (now - lastMessageSentAt < MESSAGE_COOLDOWN_MS) {
            showToast('Sending too fast, please wait.');
            return;
        }
        lastMessageSentAt = now;
        try {
            if (activeChatRoomType === 'dm' && await hasBlockBetween(currentUser.uid, activeChatTargetUid)) {
                showToast('Private chat is blocked.');
                return;
            }
            const profile = loadProfile();
            const roomRef = firestoreDb.collection('chatRooms').doc(activeChatRoomId);
            const messageRef = roomRef.collection('messages').doc();
            await messageRef.set({
                senderId: currentUser.uid,
                senderName: profile.name || 'Papiano User',
                senderUserId: profile.userId || '',
                senderPhotoURL: profile.photoURL || '',
                senderBadgeId: profile.roleId || profile.badgeId || 'common',
                text,
                imageURL: pendingChatImageData || '',
                imagePath: pendingChatImagePath || '',
                replyTo: activeReplyMessage ? {
                    messageId: activeReplyMessage.id || '',
                    senderId: activeReplyMessage.senderId || '',
                    senderName: activeReplyMessage.senderName || 'User',
                    text: activeReplyMessage.text || '',
                    imageURL: activeReplyMessage.imageURL || ''
                } : null,
                hiddenFor: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            const roomUpdate = {
                type: activeChatRoomType || 'group',
                participants: activeChatRoomType === 'dm' ? [currentUser.uid, activeChatTargetUid] : [],
                lastMessage: text || 'Photo',
                lastSenderId: currentUser.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (activeChatRoomType === 'dm' && activeChatTargetUid) {
                // Sending a message revives the chat for BOTH participants:
                // - sender obviously wants to chat now
                // - receiver should see the new message in their folder/list
                // This is gated by hasBlockBetween earlier in this function and the
                // friendship check in openDirectRoom, so blocked/unfriended pairs
                // can't reach here. State preservation for unblock case is therefore
                // safe (they can't open chat to send anything).
                roomUpdate.hiddenFolderFor = firebase.firestore.FieldValue.arrayRemove(currentUser.uid, activeChatTargetUid);
                roomUpdate.clearedBy = firebase.firestore.FieldValue.arrayRemove(currentUser.uid, activeChatTargetUid);
                roomUpdate.blockedFor = firebase.firestore.FieldValue.arrayRemove(currentUser.uid, activeChatTargetUid);
                roomUpdate[`unreadCount.${activeChatTargetUid}`] = firebase.firestore.FieldValue.increment(1);
                roomUpdate[`unreadCount.${currentUser.uid}`] = 0;
            }
            if (activeChatRoomType === 'group') {
                roomUpdate[`unreadCount.${currentUser.uid}`] = 0;
            }
            await roomRef.set(roomUpdate, { merge: true });
            if (chatInputFieldMessage) { chatInputFieldMessage.value = ''; autoGrowChatInput(chatInputFieldMessage); updateChatInputCounter(); }
            cancelActiveReplyState();
            clearPendingChatImage();
        } catch (error) {
            showToast('Couldn’t send this message.');
        }
    }

    async function editOwnMessage(messageId) {
        if (!currentUser?.uid || !activeChatRoomId || !messageId) return;
        try {
            const ref = firestoreDb.collection('chatRooms').doc(activeChatRoomId).collection('messages').doc(messageId);
            const snap = await ref.get();
            const data = snap.data() || {};
            if (data.senderId !== currentUser.uid) {
                showToast('Only your messages can be edited.');
                return;
            }
            const nextText = window.__papianoEditModal
                ? await window.__papianoEditModal.show(data.text || '')
                : prompt('Edit message', data.text || '');
            if (nextText === null) return;
            await ref.set({
                text: String(nextText).trim().slice(0, 500),
                editedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            showToast('Couldn’t edit this message.');
        }
    }

    async function deleteMessageForMe(messageId) {
        if (!currentUser?.uid || !activeChatRoomId || !messageId) return;
        try {
            await firestoreDb.collection('chatRooms').doc(activeChatRoomId).collection('messages').doc(messageId).set({
                hiddenFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t delete. Please try again.'));
        }
    }

    async function deleteOwnMessageEverywhere(messageId, successText = 'Message deleted.') {
        if (!currentUser?.uid || !activeChatRoomId || !messageId) return;
        try {
            const ref = firestoreDb.collection('chatRooms').doc(activeChatRoomId).collection('messages').doc(messageId);
            const snap = await ref.get();
            const data = snap.data() || {};
            if (data.senderId !== currentUser.uid) {
                showToast('Only your messages can be deleted.');
                return;
            }
            await ref.set({
                deletedForAll: true,
                text: '',
                imageURL: '',
                imagePath: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            showToast(successText, 'Chat');
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t delete. Please try again.'));
        }
    }

    function deleteMessageForBoth(messageId) {
        if (!isDirectChatRoom()) {
            showToast('This action is only available in private chat.');
            return;
        }
        return deleteOwnMessageEverywhere(messageId, 'Message deleted for both users.');
    }

    function deleteOwnMessage(messageId) {
        if (isDirectChatRoom()) {
            return deleteMessageForBoth(messageId);
        }
        return deleteOwnMessageEverywhere(messageId, 'Message deleted.');
    }

    function deleteMessageForAll(messageId) {
        return deleteOwnMessage(messageId);
    }

    function reportMessageSender(messageId) {
        if (!currentUser?.uid || !messageId) {
            showToast('Sign in to report users.');
            return;
        }
        const data = activeMessagesCache.get(messageId);
        const targetUid = data?.senderId || '';
        if (!targetUid || targetUid === currentUser.uid) {
            showToast('Cannot report this message.');
            return;
        }
        activeFriendProfileKey = targetUid;
        activeFriendProfileData = getMessageSenderProfile(data);
        openReportModal({
            source: 'message',
            targetId: targetUid,
            roomId: activeChatRoomId || '',
            roomType: activeChatRoomType || '',
            messageId: data.id || messageId,
            messageTextSnapshot: String(data.text || '').slice(0, MAX_CHAT_MESSAGE_CHARS),
            messageImageURL: data.imageURL || '',
            messageSenderName: activeFriendProfileData?.name || data.senderName || ''
        });
    }

    async function beginReplyToMessage(messageId) {
        if (!activeChatRoomId || !messageId) return;
        if (isAnnouncementRoom() && !isAnnouncementOwner()) return;
        try {
            let data = activeMessagesCache.get(messageId);
            if (!data) {
                const ref = firestoreDb.collection('chatRooms').doc(activeChatRoomId).collection('messages').doc(messageId);
                const snap = await ref.get();
                if (!snap.exists) return;
                data = { id: snap.id, ...snap.data() };
            }
            const profile = getMessageSenderProfile(data);
            activeReplyMessage = {
                id: data.id,
                senderId: data.senderId || '',
                senderName: profile.name || data.senderName || 'User',
                text: String(data.text || '').slice(0, 120),
                imageURL: data.imageURL || ''
            };
            if (replyContextTextPreview) {
                const preview = activeReplyMessage.imageURL ? 'Photo' : activeReplyMessage.text || 'Message';
                replyContextTextPreview.textContent = `Replying to ${activeReplyMessage.senderName}: ${preview}`;
            }
            if (activeReplyContextBar) activeReplyContextBar.style.display = 'flex';
            chatInputFieldMessage?.focus();
        } catch (error) {
            showToast('Couldn’t save this reply.');
        }
    }

    function cancelActiveReplyState() {
        activeReplyMessage = null;
        if (activeReplyContextBar) activeReplyContextBar.style.display = 'none';
        if (replyContextTextPreview) replyContextTextPreview.textContent = 'Replying...';
    }

    let activeFriendProfileKey = '';
    let activeFriendProfileData = null;

    function launchFriendProfileModal(profileKey) {
        const profile = friendProfiles.get(profileKey) || pendingFriendRequests.get(profileKey) || searchProfiles.get(profileKey) || directChatProfiles.get(profileKey) || messageProfiles.get(profileKey) || leaderboardProfiles.get(profileKey);
        const modal = document.getElementById('friendProfileModal');
        if (!profile || !modal) {
            showToast('No profile selected.');
            return;
        }
        activeFriendProfileKey = profile.uid;
        activeFriendProfileData = profile;
        const fpBigInitial = document.getElementById('fpBigInitial');
        const fpName = document.getElementById('fpName');
        const fpBadgeContainer = document.getElementById('fpBadgeContainer');
        const fpId = document.getElementById('fpId');
        const fpDesc = document.getElementById('fpDesc');
        const fpPlayTime = document.getElementById('fpPlayTime');
        const fpLikeVal = document.getElementById('fpLikeVal');
        const fpDislikeVal = document.getElementById('fpDislikeVal');
        const fpAddFriendBtn = document.getElementById('fpAddFriendBtn');
        const fpOpenChatBtn = document.getElementById('fpOpenChatBtn');
        const fpUnfriendBtn = document.getElementById('fpUnfriendBtn');
        const fpBlockUserBtn = document.getElementById('fpBlockUserBtn');
        const fpRelationState = document.getElementById('fpRelationState');

        if (fpBigInitial) {
            if (profile.photoURL) {
                fpBigInitial.innerHTML = `<img src="${escapeHtml(profile.photoURL)}" alt="">`;
            } else {
                fpBigInitial.textContent = getInitials(profile.name);
            }
        }
        if (fpName) fpName.textContent = profile.name || 'Papiano User';
        if (fpBadgeContainer) fpBadgeContainer.innerHTML = renderBadge(profile.badgeId);
        renderFlagRow(profile.countryCode, document.getElementById('fpFlagRow'));
        if (fpId) fpId.textContent = (/^#\d+$/.test(String(profile.userId || '')) ? profile.userId : safeUserId(profile.uid));
        if (fpDesc) fpDesc.textContent = profile.desc || '—';
        if (fpPlayTime) fpPlayTime.textContent = formatPlayTimeHours(profile.playTimeSeconds);
        if (fpLikeVal) fpLikeVal.textContent = profile.likes || 0;
        if (fpDislikeVal) fpDislikeVal.textContent = profile.dislikes || 0;

        const isSelf = !!currentUser?.uid && profile.uid === currentUser.uid;
        const isBlocked = blockedUserIds.has(profile.uid);
        const isFriend = friendProfiles.has(profile.uid);
        if (fpRelationState) {
            fpRelationState.textContent = isSelf ? 'Your profile' : isBlocked ? 'Blocked' : isFriend ? 'Friend' : 'Player';
        }

        const showAction = (button, shouldShow) => {
            if (!button) return;
            button.style.display = shouldShow ? 'inline-flex' : 'none';
        };
        showAction(fpAddFriendBtn, !!currentUser?.uid && !isSelf && !isFriend && !isBlocked);
        showAction(fpOpenChatBtn, !!currentUser?.uid && !isSelf && isFriend && !isBlocked);
        showAction(fpUnfriendBtn, !!currentUser?.uid && !isSelf && isFriend);
        showAction(fpBlockUserBtn, !!currentUser?.uid && !isSelf);
        const fpReportUserBtn = document.getElementById('fpReportUserBtn');
        showAction(fpReportUserBtn, !!currentUser?.uid && !isSelf);

        if (fpAddFriendBtn) fpAddFriendBtn.disabled = false;
        if (fpOpenChatBtn) fpOpenChatBtn.disabled = false;
        if (fpUnfriendBtn) fpUnfriendBtn.disabled = false;
        if (fpBlockUserBtn) {
            fpBlockUserBtn.disabled = false;
            fpBlockUserBtn.innerHTML = isBlocked
                ? '<span class="material-symbols-rounded">lock_open</span><span>Unblock</span>'
                : '<span class="material-symbols-rounded">block</span><span>Block</span>';
        }
        if (fpReportUserBtn) fpReportUserBtn.disabled = false;
        modal.classList.toggle('is-self-profile', isSelf);
        modal.classList.toggle('is-friend-profile', isFriend);
        modal.classList.toggle('is-blocked-profile', isBlocked);
        modal.classList.add('active');
    }

    function closeFriendProfileModal() {
        const modal = document.getElementById('friendProfileModal');
        if (modal) modal.classList.remove('active');
        activeFriendProfileKey = '';
        activeFriendProfileData = null;
    }

    function addFriendFromProfile() {
        if (!activeFriendProfileKey) {
            showToast('No profile selected.');
            return;
        }
        sendFriendRequest(activeFriendProfileKey);
    }

    function openDirectChatFromProfile() {
        if (!activeFriendProfileKey) {
            showToast('No profile selected.');
            return;
        }
        openDirectRoom(activeFriendProfileKey);
    }

    // Helper: delete ALL messages in a DM (paginated). Used by block + unfriend.
    async function purgeDirectRoomMessages(dmId) {
        const messagesRef = firestoreDb.collection('chatRooms').doc(dmId).collection('messages');
        let snap = await messagesRef.orderBy('createdAt', 'desc').limit(500).get();
        while (!snap.empty) {
            const deleteBatch = firestoreDb.batch();
            snap.docs.forEach(doc => deleteBatch.set(doc.ref, {
                deletedForAll: true,
                text: '',
                imageURL: '',
                imagePath: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }));
            await deleteBatch.commit();
            if (snap.docs.length < 500) break;
            const lastDoc = snap.docs[snap.docs.length - 1];
            snap = await messagesRef.orderBy('createdAt', 'desc').startAfter(lastDoc).limit(500).get();
        }
    }

    async function unfriendFromProfile() {
        if (!currentUser?.uid || !activeFriendProfileKey) {
            showToast('No profile selected.');
            return;
        }
        const targetUid = activeFriendProfileKey;
        if (targetUid === currentUser.uid) {
            showToast('You cannot unfriend yourself.');
            return;
        }
        if (!friendProfiles.has(targetUid)) {
            showToast('This user is not in your friend list.');
            return;
        }
        try {
            const pairId = buildPairId(currentUser.uid, targetUid);
            const dmId = getDirectRoomId(currentUser.uid, targetUid);

            // Delete ALL messages in the DM (same as block)
            await purgeDirectRoomMessages(dmId);

            // Remove friendship + hide folder + mark cleared on my side
            const batch = firestoreDb.batch();
            batch.delete(firestoreDb.collection('friendships').doc(pairId));
            batch.set(firestoreDb.collection('chatRooms').doc(dmId), {
                clearedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                hiddenFolderFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                [`unreadCount.${currentUser.uid}`]: 0,
                lastMessage: '',
                lastSenderId: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await batch.commit();

            // Local state
            const oldProfile = friendProfiles.get(targetUid) || activeFriendProfileData || normalizeProfile(targetUid, {});
            friendProfiles.delete(targetUid);
            directChatProfiles.delete(targetUid);
            searchProfiles.set(targetUid, oldProfile);
            if (activeChatRoomType === 'dm' && activeChatTargetUid === targetUid) closeChatOverlayRoom();
            renderFriendRows();
            closeFriendProfileModal();
            showToast('Friend removed.', 'Friends');
        } catch (error) {
            showToast('Couldn’t remove this friend.');
        }
    }

    async function blockUserFromProfile() {
        if (!currentUser?.uid || !activeFriendProfileKey) {
            showToast('Sign in to block users.');
            return;
        }
        const targetUid = activeFriendProfileKey;
        if (blockedUserIds.has(targetUid)) {
            await unblockUser(targetUid);
            return;
        }
        try {
            const dmId = getDirectRoomId(currentUser.uid, targetUid);
            const participants = [currentUser.uid, targetUid];

            // Delete ALL messages (paginated helper)
            await purgeDirectRoomMessages(dmId);

            // Commit the block + friendship removal + room cleanup
            const batch = firestoreDb.batch();
            const pairId = buildPairId(currentUser.uid, targetUid);
            batch.delete(firestoreDb.collection('friendships').doc(pairId));
            const blockId = `${currentUser.uid}_${targetUid}`;
            batch.set(firestoreDb.collection('blocks').doc(blockId), {
                blockerId: currentUser.uid,
                blockedId: targetUid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            batch.set(firestoreDb.collection('chatRooms').doc(dmId), {
                type: 'dm',
                participants,
                clearedBy: firebase.firestore.FieldValue.arrayUnion(...participants),
                blockedFor: firebase.firestore.FieldValue.arrayUnion(...participants),
                hiddenFolderFor: firebase.firestore.FieldValue.arrayUnion(...participants),
                lastMessage: '',
                lastSenderId: '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await batch.commit();

            // Immediately update local state
            blockedUserIds.add(targetUid);
            blockedProfiles.set(targetUid, friendProfiles.get(targetUid) || searchProfiles.get(targetUid) || directChatProfiles.get(targetUid) || normalizeProfile(targetUid, {}));
            friendProfiles.delete(targetUid);
            searchProfiles.delete(targetUid);
            directChatProfiles.delete(targetUid);
            pendingFriendRequests.forEach((profile, key) => {
                if (profile.uid === targetUid) pendingFriendRequests.delete(key);
            });

            // If the active chat is open with this user, close it immediately
            if (activeChatTargetUid === targetUid) {
                closeChatOverlayRoom();
            }

            renderFriendRows();
            launchFriendProfileModal(targetUid);
            showToast('User blocked.', 'Friends');
        } catch (error) {
            showToast(friendlyError(error, 'Couldn’t block this user.'));
        }
    }


    async function unblockUser(targetUid) {
        if (!currentUser?.uid || !targetUid) {
            showToast('Sign in to unblock users.');
            return;
        }
        try {
            const blockId = `${currentUser.uid}_${targetUid}`;
            const dmId = getDirectRoomId(currentUser.uid, targetUid);
            const batch = firestoreDb.batch();
            // Only remove the block. Keep hiddenFolderFor & clearedBy intact so the
            // chat folder stays cleared after unblock (user must add friend / start
            // a new chat to bring it back).
            batch.delete(firestoreDb.collection('blocks').doc(blockId));
            batch.set(firestoreDb.collection('chatRooms').doc(dmId), {
                blockedFor: firebase.firestore.FieldValue.arrayRemove(currentUser.uid, targetUid),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            await batch.commit();
            blockedUserIds.delete(targetUid);
            blockedProfiles.delete(targetUid);
            // Make sure the DM doesn't reappear in the chat list locally
            directChatProfiles.delete(targetUid);
            renderFriendRows();
            if (activeFriendProfileKey === targetUid) launchFriendProfileModal(targetUid);
            showToast('User unblocked.', 'Friends');
        } catch (error) {
            showToast('Couldn’t unblock this user.');
        }
    }

    function setProfileReactionBusy(isBusy) {
        profileReactionBusy = Boolean(isBusy);
        document.querySelectorAll('#friendProfileModal .vote-btn-panel').forEach(button => {
            button.disabled = profileReactionBusy;
        });
    }

    function updateFriendProfileVoteUI(profile) {
        if (document.getElementById('fpLikeVal')) document.getElementById('fpLikeVal').textContent = Math.max(0, profile.likes || 0);
        if (document.getElementById('fpDislikeVal')) document.getElementById('fpDislikeVal').textContent = Math.max(0, profile.dislikes || 0);
    }

    async function triggerVoteCount(type) {
        const voteType = type === 'dislike' ? 'dislike' : 'like';
        if (profileReactionBusy) return;
        if (!currentUser?.uid || !activeFriendProfileKey) {
            showToast('Sign in to react.');
            return;
        }
        if (activeFriendProfileKey === currentUser.uid) {
            showToast('You cannot react to yourself.');
            return;
        }
        const targetUid = activeFriendProfileKey;
        setProfileReactionBusy(true);
        try {
            const profileRef = firestoreDb.collection('profiles').doc(targetUid);
            const reactionRef = profileRef.collection('reactions').doc(currentUser.uid);
            const result = await firestoreDb.runTransaction(async transaction => {
                const profileSnap = await transaction.get(profileRef);
                const reactionSnap = await transaction.get(reactionRef);
                const profileData = profileSnap.exists ? (profileSnap.data() || {}) : {};
                const oldType = reactionSnap.exists ? String(reactionSnap.data()?.type || '') : '';
                let likes = Math.max(0, Number(profileData.likes || 0));
                let dislikes = Math.max(0, Number(profileData.dislikes || 0));
                let activeType = voteType;

                if (oldType === voteType) {
                    if (voteType === 'like') likes = Math.max(0, likes - 1);
                    if (voteType === 'dislike') dislikes = Math.max(0, dislikes - 1);
                    activeType = '';
                    transaction.delete(reactionRef);
                } else {
                    if (oldType === 'like') likes = Math.max(0, likes - 1);
                    if (oldType === 'dislike') dislikes = Math.max(0, dislikes - 1);
                    if (voteType === 'like') likes += 1;
                    if (voteType === 'dislike') dislikes += 1;
                    transaction.set(reactionRef, {
                        type: voteType,
                        voterId: currentUser.uid,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }

                transaction.set(profileRef, {
                    likes,
                    dislikes,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return { likes, dislikes, activeType };
            });

            if (activeFriendProfileKey !== targetUid) return;
            const profile = {
                ...(activeFriendProfileData || normalizeProfile(targetUid, {})),
                likes: result.likes,
                dislikes: result.dislikes
            };
            activeFriendProfileData = profile;
            if (friendProfiles.has(targetUid)) friendProfiles.set(targetUid, profile);
            if (searchProfiles.has(targetUid)) searchProfiles.set(targetUid, profile);
            if (directChatProfiles.has(targetUid)) directChatProfiles.set(targetUid, profile);
            if (messageProfiles.has(targetUid)) messageProfiles.set(targetUid, profile);
            if (leaderboardProfiles.has(targetUid)) leaderboardProfiles.set(targetUid, profile);
            updateFriendProfileVoteUI(profile);

            if (result.activeType) {
                const votedBtn = document.querySelector(result.activeType === 'dislike' ? '.vote-btn-panel.v-dislike' : '.vote-btn-panel.v-like');
                if (votedBtn) {
                    votedBtn.classList.remove('just-voted');
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            votedBtn.classList.add('just-voted');
                            setTimeout(() => votedBtn.classList.remove('just-voted'), 300);
                        });
                    });
                }
            }
        } catch (error) {
            showToast('Couldn’t save your reaction.');
        } finally {
            setProfileReactionBusy(false);
        }
    }

    async function reportUserFromProfile() {
        if (!currentUser?.uid) {
            showToast('Sign in to report users.');
            return;
        }
        if (!activeFriendProfileKey || activeFriendProfileKey === currentUser.uid) {
            showToast('Invalid report target.');
            return;
        }
        const reasonEl = document.getElementById('reportReasonSelect');
        const reason = reasonEl?.value || '';
        if (!reason) {
            showToast('Please select a reason.');
            return;
        }
        try {
            const reportId = `${currentUser.uid}_${activeFriendProfileKey}`;
            const reportRef = firestoreDb.collection('reports').doc(reportId);
            const existing = await reportRef.get();
            if (existing.exists) {
                showToast('Already reported this user.');
                closeReportModal();
                return;
            }
            const context = activeReportContext && activeReportContext.targetId === activeFriendProfileKey ? activeReportContext : null;
            await reportRef.set({
                reporterId: currentUser.uid,
                targetId: activeFriendProfileKey,
                targetName: activeFriendProfileData?.name || '',
                reason,
                source: context?.source || 'profile',
                roomId: context?.roomId || '',
                roomType: context?.roomType || '',
                messageId: context?.messageId || '',
                messageTextSnapshot: context?.messageTextSnapshot || '',
                messageImageURL: context?.messageImageURL || '',
                messageSenderName: context?.messageSenderName || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Report submitted. Thank you.');
            closeReportModal();
        } catch (error) {
            showToast('Couldn’t submit this report.');
        }
    }

    function openReportModal(context = null) {
        if (!currentUser?.uid) { showToast('Sign in to report users.'); return; }
        if (!activeFriendProfileKey || activeFriendProfileKey === currentUser.uid) { showToast('Cannot report this profile.'); return; }
        activeReportContext = context && context.targetId === activeFriendProfileKey ? context : null;
        const modal = document.getElementById('reportUserModal');
        if (modal) modal.classList.add('active');
    }

    function closeReportModal() {
        const modal = document.getElementById('reportUserModal');
        if (modal) modal.classList.remove('active');
        const reasonEl = document.getElementById('reportReasonSelect');
        if (reasonEl) reasonEl.value = '';
        activeReportContext = null;
    }

    function copyDonationAddress(value, label, button) {
        const text = String(value || '').trim();
        if (!text) {
            showToast('Nothing to copy.');
            return;
        }
        navigator.clipboard?.writeText(text).then(() => {
            const original = button?.textContent;
            if (button) button.textContent = 'Copied';
            showToast(`${label || 'Address'} copied.`);
            if (button) setTimeout(() => { button.textContent = original || 'Copy'; }, 1200);
        }).catch(() => showToast('Couldn’t copy this address.'));
    }

    function syncFullscreenControl() {
        const isFullscreen = !!document.fullscreenElement;
        if (fsIcon) fsIcon.textContent = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
        if (fullscreenBtn) {
            fullscreenBtn.style.display = isFullscreen ? 'none' : 'flex';
            fullscreenBtn.setAttribute('aria-hidden', isFullscreen ? 'true' : 'false');
            fullscreenBtn.tabIndex = isFullscreen ? -1 : 0;
        }
    }

    function toggleScreenWindow() {
        const doc = document;
        if (!doc.fullscreenElement) {
            doc.documentElement.requestFullscreen?.().catch?.(() => syncFullscreenControl());
        } else {
            doc.exitFullscreen?.().catch?.(() => syncFullscreenControl());
        }
    }

    function getCarouselElements() {
        return {
            frame: document.querySelector('.home-carousel'),
            track: document.getElementById('carouselTrack'),
            dots: [...document.querySelectorAll('#carouselDots .dot')]
        };
    }

    function applyCarousel(offset = 0) {
        const { track, dots } = getCarouselElements();
        if (!track || !dots.length) return;
        track.style.transform = `translateX(calc(-${carouselIndex * 100}% + ${offset}px))`;
        dots.forEach((dot, index) => dot.classList.toggle('active', index === carouselIndex));
    }

    function pauseCarousel() {
        carouselAutoPaused = true;
        clearInterval(carouselTimer);
        carouselTimer = null;
    }

    function setCarouselIndex(index) {
        const { dots } = getCarouselElements();
        if (!dots.length) return;
        carouselIndex = (index + dots.length) % dots.length;
        applyCarousel();
    }

    function initCarouselDrag() {
        const { frame, dots } = getCarouselElements();
        if (!frame || frame.dataset.dragReady === '1') return;
        frame.dataset.dragReady = '1';

        frame.addEventListener('pointerdown', event => {
            if (event.button !== undefined && event.button !== 0) return;
            pauseCarousel();
            carouselPointerId = event.pointerId;
            carouselDragStartX = event.clientX;
            carouselDragWidth = frame.clientWidth || 1;
            carouselDragMoved = false;
            frame.classList.add('is-dragging');
            frame.setPointerCapture?.(event.pointerId);
        });

        frame.addEventListener('pointermove', event => {
            if (carouselPointerId !== event.pointerId) return;
            const offset = event.clientX - carouselDragStartX;
            if (Math.abs(offset) < 4 && !carouselDragMoved) return;
            carouselDragMoved = true;
            event.preventDefault();
            applyCarousel(offset);
        });

        const finishDrag = event => {
            if (carouselPointerId !== event.pointerId) return;
            const offset = event.clientX - carouselDragStartX;
            const threshold = Math.min(90, carouselDragWidth * 0.18);
            frame.releasePointerCapture?.(event.pointerId);
            frame.classList.remove('is-dragging');
            carouselPointerId = null;
            if (offset <= -threshold) setCarouselIndex(carouselIndex + 1);
            else if (offset >= threshold) setCarouselIndex(carouselIndex - 1);
            else applyCarousel();
        };

        frame.addEventListener('pointerup', finishDrag);
        frame.addEventListener('pointercancel', finishDrag);

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                pauseCarousel();
                setCarouselIndex(index);
            });
        });
    }

    function setupTopBarAutoHide() {
        const bar = document.getElementById('appTopBar');
        if (bar) bar.classList.remove('is-scroll-hidden');
    }

    function startCarousel() {
        const { dots } = getCarouselElements();
        if (!dots.length) return;
        initCarouselDrag();
        clearInterval(carouselTimer);
        setCarouselIndex(carouselIndex);
        if (carouselAutoPaused) return;
        carouselTimer = setInterval(() => setCarouselIndex(carouselIndex + 1), 3600);
    }

    document.addEventListener('fullscreenchange', syncFullscreenControl);
    document.addEventListener('DOMContentLoaded', syncFullscreenControl);
    syncFullscreenControl();

    function spawnRipple(event) {
        const btn = event.currentTarget;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const point = event.touches ? event.touches[0] : event;
        const x = (point.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
        const y = (point.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
        const r = document.createElement('span');
        r.className = 'btn-ripple';
        r.style.width = r.style.height = size + 'px';
        r.style.left = x + 'px';
        r.style.top = y + 'px';
        btn.appendChild(r);
        setTimeout(() => r.remove(), 620);
    }
    const RIPPLE_SELECTOR = '.btn-auth-google,.btn-auth-email,.btn-auth-access,.auth-entry-google,.auth-entry-close,.auth-entry-submit,.auth-entry-link,.email-auth-submit,.email-auth-close,.email-auth-link,.top-action-btn,.msg-reply-icon-btn,.lang-toggle-btn,.btn-send-message,.profile-upload-button,.account-delete-action,.support-link-button,.wallet-copy-btn,.vote-btn-panel,.friend-action-button,.account-lock-login,.btn-submit-config,.friend-nav-btn,.btn-global-rank-trigger,.m3-btn';
    document.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest(RIPPLE_SELECTOR);
        if (!btn || btn.disabled) return;
        btn.classList.add('ripple-host');
        spawnRipple({ currentTarget: btn, clientX: e.clientX, clientY: e.clientY });
    }, { passive: true });

    chatInputFieldMessage?.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            executeSendMessage();
            autoGrowChatInput(chatInputFieldMessage);
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (authEntryOverlay?.classList.contains('active')) closeAuthEntryPopup();
        }
    });
    authEntryOverlay?.addEventListener('click', event => { if (event.target === authEntryOverlay) closeAuthEntryPopup(); });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pausePlayTimeTracker(true);
        } else if (mainAppScreen?.classList.contains('active')) {
            startPlayTimeTracker();
        }
    });

    // pagehide is more reliable than beforeunload on mobile Chrome/Safari.
    // Use both for maximum coverage.
    function _playtimeLastChanceSync() {
        flushElapsedToPending();
        syncPlayTimeToFirestore(true);
    }
    window.addEventListener('pagehide', _playtimeLastChanceSync);
    window.addEventListener('beforeunload', _playtimeLastChanceSync);

    var _mpPresenceRef = null;

    function restoreMultiplayerPresence(uid) {
        if (!realtimeDb || !uid) return;
        try {
            var profile = currentProfile || {};
            var now = Date.now();
            _mpPresenceRef = realtimeDb.ref('papianoOnlineBeta/users/' + uid);
            _mpPresenceRef.update({
                id: uid,
                uid: uid,
                name: profile.name || 'Papiano User',
                uidLabel: profile.userId || '',
                userId: profile.userId || '',
                publicId: profile.publicId || 0,
                role: profile.badgeId || 'common',
                badgeId: profile.badgeId || 'common',
                photoURL: profile.photoURL || '',
                bio: profile.desc || '',
                desc: profile.desc || '',
                color: profile.color || '',
                countryCode: profile.countryCode || '',
                online: true,
                room: null,
                lastSeen: now,
                lastActive: now,
                updatedAt: now
            });
            _mpPresenceRef.onDisconnect().update({
                online: false,
                updatedAt: Date.now()
            });
        } catch (e) {}
    }

    function touchMultiplayerPresence() {
        if (!_mpPresenceRef) return;
        try {
            _mpPresenceRef.update({
                online: true,
                lastSeen: Date.now(),
                lastActive: Date.now(),
                updatedAt: Date.now()
            });
        } catch (e) {}
    }

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && _mpPresenceRef) touchMultiplayerPresence();
    });

    setInterval(function() {
        if (!document.hidden && _mpPresenceRef) touchMultiplayerPresence();
    }, 30000);

    function startPapianoAuthBootstrap() {
        firebaseAuth.onAuthStateChanged(async user => {
            authStateResolved = true;
            if (user?.uid) {
                // Email/password accounts must confirm their email before they
                // get into the app. Creating an account auto-signs-in the user,
                // so without this gate an unverified user would be booted straight
                // in (and the "check your inbox" verify screen would be replaced
                // by a fleeting toast). Hold them on the verification screen.
                // Admin emails bypass this gate entirely.
                const ADMIN_EMAILS = new Set(['utamairfan44@gmail.com', 'akunpolos0444000@gmail.com', 'papianobase@gmail.com']);
                const needsEmailVerify = !user.emailVerified
                    && (user.providerData || []).some(p => p && p.providerId === 'password')
                    && !ADMIN_EMAILS.has(String(user.email || '').toLowerCase());
                if (needsEmailVerify && !currentProfile) {
                    currentUser = null;
                    currentProfile = null;
                    _deferredAuthUser = null;
                    openMainApp();
                    hideAuthBootOverlay();
                    const verifyAddr = document.getElementById('authVerifyEmailAddr');
                    if (verifyAddr) verifyAddr.textContent = user.email || 'your email';
                    openAuthEntryPopup('signin');
                    if (typeof authShowScreen === 'function') authShowScreen('verify');
                    return;
                }
                currentUser = user; // mark signed-in now so the UI stops looking "logged out"
                if (!firestoreDb) {
                    // Auth resolved before Firestore finished downloading. Reveal the
                    // app immediately as "signed in" using the cached profile, and
                    // finish loading once initPapianoSDKs() runs.
                    _deferredAuthUser = user;
                    currentProfile = currentProfile || loadProfile();
                    openMainApp();
                    navigateActiveTab(currentActiveTabIndex, appTabHeaderTitles[currentActiveTabIndex]);
                    hideAuthBootOverlay();
                    return;
                }
                await finishLoggedInBoot(user);
                hideAuthBootOverlay();
                return;
            }

            accessSessionActive = true;
            currentUser = null;
            currentProfile = null;
            _deferredAuthUser = null;
            openMainApp();
            hideAuthBootOverlay();
        });
    }

    async function finishLoggedInBoot(user) {
        try {
            localStorage.removeItem('papiano_access_session');
            await ensureUserProfile(user);
            startRoleRegistryListener();
            startDeletedAccountWatcher(user.uid);
            restoreMultiplayerPresence(user.uid);
        } catch (error) {
            console.error('[Papiano] finishLoggedInBoot error:', error?.code || error?.message || error);
            if (isAccountRestrictionError(error)) {
                // Admin emails should never be kicked by restriction errors
                const email = String(user?.email || '').toLowerCase();
                if (!ADMIN_GATE_EMAILS.has(email)) {
                    await exitDeletedAccount();
                    return;
                }
            }
            // Fallback: try a plain read (no write) so the profile at least shows
            if (!currentProfile && firestoreDb && user?.uid) {
                try {
                    const snap = await firestoreDb.collection('profiles').doc(user.uid).get();
                    if (snap.exists) {
                        currentUser = user;
                        currentProfile = normalizeProfile(user.uid, snap.data());
                        saveProfile(currentProfile);
                        updateProfileView(currentProfile);
                    }
                } catch (_fallbackErr) {}
            }
            if (!currentProfile) showToast('Could not load your profile. Please refresh.');
        }
        openMainApp();
        navigateActiveTab(currentActiveTabIndex, appTabHeaderTitles[currentActiveTabIndex]);
    }

    window.addEventListener('DOMContentLoaded', () => {
        updateProfileView(loadProfile());
        ensureNativeBackGuard();
        initTapRipple();
        if (mainAppScreen?.classList.contains('active')) {
            startPlayTimeTracker();
            startCarousel();
            setupTopBarAutoHide();
            updateHomeTopBarVisibility();
            if (currentUser?.uid) startCommunityListeners();
            else {
                stopCommunityListeners();
                stopLeaderboardListeners();
            }
        }
    });
