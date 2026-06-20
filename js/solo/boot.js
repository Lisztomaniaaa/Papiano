/* Papiano — Solo entry point.
 *
 * Boots the shared piano engine (js/engine/piano.js) in solo mode: local play
 * only, no Firebase, no rooms, no chat. Solo and multiplayer are deliberately
 * SEPARATE entry points that share the same engine — neither the engine nor
 * this file does "both functions". This one only ever starts solo.
 */
(function () {
    function boot() {
        if (typeof window.papianoBootSolo === 'function') window.papianoBootSolo();
    }
    if (typeof window.papianoBootSolo === 'function') boot();
    else window.addEventListener('papiano-engine-ready', boot, { once: true });
})();
