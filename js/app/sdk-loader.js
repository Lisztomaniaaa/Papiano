(function () {
    var APP_URL  = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
    // Auth now resolves via cognito-auth.js (window.papianoAuth), loaded
    // separately and earlier in index.html — no firebase-auth-compat.js here.
    // These remain Firebase-backed pending the data-layer migration off
    // RTDB/Firestore to AppSync.
    var REST_URLS = [
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js',
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js'
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
        loadScript(APP_URL)
            .then(function () { return Promise.all(REST_URLS.map(loadScript)); })
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
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadAll, { timeout: 1500 });
        } else {
            setTimeout(loadAll, 0);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule, { once: true });
    } else {
        schedule();
    }
})();
