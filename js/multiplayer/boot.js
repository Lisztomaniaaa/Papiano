/* Papiano — Multiplayer entry point.
 *
 * Boots the shared piano engine (js/engine/piano.js) with the online layer:
 * rooms, chat, presence and Firebase. Solo and multiplayer are deliberately
 * SEPARATE entry points that share the same engine — neither the engine nor
 * this file does "both functions". This one only ever starts multiplayer.
 */
(function () {
    function boot() {
        if (typeof window.papianoBootMultiplayer === 'function') window.papianoBootMultiplayer();
    }
    if (typeof window.papianoBootMultiplayer === 'function') boot();
    else window.addEventListener('papiano-engine-ready', boot, { once: true });
})();
