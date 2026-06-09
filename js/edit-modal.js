// Custom edit modal to replace native prompt() for message editing
(function(){
    var overlay = document.createElement('div');
    overlay.id = 'papianoEditOverlay';
    overlay.innerHTML = '<div class="papiano-edit-card"><div class="papiano-edit-title">Edit Message</div><textarea class="papiano-edit-input" id="papianoEditInput" maxlength="500" rows="3" autocomplete="off" spellcheck="true"></textarea><div class="papiano-edit-counter"><span id="papianoEditCount">0</span>/500</div><div class="papiano-edit-actions"><button class="papiano-edit-btn cancel" id="papianoEditCancel" type="button">Cancel</button><button class="papiano-edit-btn confirm" id="papianoEditConfirm" type="button">Save</button></div></div>';
    var style = document.createElement('style');
    style.textContent = '#papianoEditOverlay{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.55);opacity:0;transition:opacity .2s ease}#papianoEditOverlay.show{display:flex;opacity:1}.papiano-edit-card{width:min(100%,380px);background:#ffffff;border:1px solid rgba(6,17,31,.12);border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:14px;box-shadow:0 28px 78px rgba(6,17,31,.32);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Plus Jakarta Sans",sans-serif;transform:translateY(10px) scale(.98);transition:transform .25s cubic-bezier(.32,.72,0,1),opacity .25s ease;opacity:0}#papianoEditOverlay.show .papiano-edit-card{transform:translateY(0) scale(1);opacity:1}.papiano-edit-title{font-size:18px;font-weight:900;color:#06111f;letter-spacing:-.02em}.papiano-edit-input{width:100%;min-height:80px;max-height:160px;padding:14px;border:1px solid rgba(6,17,31,.14);border-radius:16px;font-size:14px;font-weight:600;color:#06111f;background:#F8FAFC;outline:none;resize:none;font-family:inherit;line-height:1.45;transition:border-color .15s}.papiano-edit-input:focus{border-color:#005BFF;box-shadow:inset 0 0 0 1px #005BFF}.papiano-edit-counter{font-size:11px;font-weight:800;color:rgba(6,17,31,.4);text-align:right;margin-top:-8px}.papiano-edit-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.papiano-edit-btn{min-height:46px;border:none;border-radius:999px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:.02em;transition:transform .12s}.papiano-edit-btn:active{transform:scale(.96)}.papiano-edit-btn.cancel{background:#F1F5F9;color:#06111f;border:1px solid rgba(6,17,31,.1)}.papiano-edit-btn.confirm{background:#005BFF;color:#fff;box-shadow:0 4px 0 #00358f,0 8px 16px rgba(0,91,255,.2)}';
    document.head.appendChild(style);

    var ready = false;
    function inject(){
        if(ready) return;
        ready = true;
        document.body.appendChild(overlay);
    }
    if(document.body) inject();
    else document.addEventListener('DOMContentLoaded', inject, {once:true});

    window.__papianoEditModal = {
        pending: false,
        value: null,
        show: function(defaultValue){
            return new Promise(function(resolve){
                inject();
                var input = document.getElementById('papianoEditInput');
                var counter = document.getElementById('papianoEditCount');
                var cancelBtn = document.getElementById('papianoEditCancel');
                var confirmBtn = document.getElementById('papianoEditConfirm');
                if(!input || !overlay) { resolve(null); return; }
                input.value = defaultValue || '';
                counter.textContent = String(input.value.length);
                overlay.classList.add('show');
                setTimeout(function(){ input.focus(); }, 60);
                input.oninput = function(){ counter.textContent = String(input.value.length); };
                function close(val){
                    overlay.classList.remove('show');
                    input.oninput = null;
                    cancelBtn.onclick = null;
                    confirmBtn.onclick = null;
                    resolve(val);
                }
                cancelBtn.onclick = function(){ close(null); };
                confirmBtn.onclick = function(){ close(input.value); };
                overlay.onclick = function(e){ if(e.target === overlay) close(null); };
                input.onkeydown = function(e){
                    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); close(input.value); }
                    if(e.key === 'Escape') close(null);
                };
            });
        }
    };

    // Patch editOwnMessage after app.min.js loads
    var patched = false;
    function tryPatch(){
        if(patched) return;
        if(typeof window.editOwnMessage !== 'function'){
            setTimeout(tryPatch, 200);
            return;
        }
        patched = true;
        window.editOwnMessage = async function(msgId){
            try{
                if(!window.currentUser || !window.currentUser.uid || !window.activeChatRoomId || !msgId) return;
                var db = window.firestoreDb;
                if(!db) return;
                var ref = db.collection('chatRooms').doc(window.activeChatRoomId).collection('messages').doc(msgId);
                var snap = await ref.get();
                var data = snap.data() || {};
                if(data.senderId !== window.currentUser.uid){
                    if(typeof showToast==='function') showToast('Only your messages can be edited.');
                    return;
                }
                var result = await window.__papianoEditModal.show(data.text || '');
                if(result === null) return;
                var text = String(result).trim().slice(0, 500);
                if(!text) return;
                await ref.set({
                    text: text,
                    editedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                }, {merge: true});
            }catch(e){
                if(typeof showToast==='function') showToast("Couldn't edit this message.");
            }
        };
    }
    tryPatch();
})();
