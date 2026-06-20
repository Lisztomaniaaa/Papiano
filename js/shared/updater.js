// Auto-update poller — reloads page when version.json changes
(function(){
    var APP_VERSION = null;
    var CHECK_MS = 120000;
    var busy = false;
    function isTyping(){
        var el = document.activeElement;
        if(!el) return false;
        var tag = (el.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
    }
    function applyUpdate(latest){
        try{
            if(sessionStorage.getItem('papianoReloadGuard') === latest) return;
            sessionStorage.setItem('papianoReloadGuard', latest);
        }catch(e){}
        if(window.caches){
            caches.keys().then(function(names){ names.forEach(function(n){ caches.delete(n); }); }).catch(function(){}).finally(function(){
                location.replace(location.pathname + '?v=' + encodeURIComponent(latest));
            });
        } else {
            location.replace(location.pathname + '?v=' + encodeURIComponent(latest));
        }
    }
    async function fetchVersion(){
        try{
            var res = await fetch('/version.json?_=' + Date.now(), { cache:'no-store' });
            if(res.ok){
                var data = await res.json();
                return String((data && data.version) || '');
            }
        }catch(e){}
        return '';
    }
    async function init(){
        APP_VERSION = await fetchVersion();
    }
    async function check(){
        if(busy || document.hidden || !APP_VERSION) return;
        busy = true;
        var latest = await fetchVersion();
        if(latest && latest !== APP_VERSION && !isTyping()) applyUpdate(latest);
        busy = false;
    }
    init();
    setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) check(); });
})();
