// Lazily loads Firebase + Supabase SDKs after the page is interactive.
// firebase-app must load first; the remaining SDKs can then load in parallel.
(function () {
    var FIREBASE_APP = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
    var PARALLEL_SDKS = [
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js',
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js',
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
    ];

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Failed to load ' + src)); };
            document.head.appendChild(s);
        });
    }

    function loadAll() {
        loadScript(FIREBASE_APP)
            .then(function () { return Promise.all(PARALLEL_SDKS.map(loadScript)); })
            .then(function () {
                window.__papianoSDKsReady = true;
                window.dispatchEvent(new Event('papiano-sdks-ready'));
            })
            .catch(function (err) {
                console.error('[papiano] SDK load failed:', err);
                if (typeof window.showToast === 'function') {
                    window.showToast('Network busy. Refresh to retry.', 'Offline');
                }
            });
    }

    function schedule() {
        if ('requestIdleCallback' in window) requestIdleCallback(loadAll, { timeout: 800 });
        else setTimeout(loadAll, 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule, { once: true });
    } else {
        schedule();
    }
})();
