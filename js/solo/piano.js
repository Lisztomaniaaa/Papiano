function forceBootVisible(){
    if(document.body.classList.contains('mp-entering-piano')) return;
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    if(app) app.classList.add('fade-in');
    if(loadingScreen){
        loadingScreen.classList.add('fade-out');
        loadingScreen.setAttribute('aria-hidden', 'true');
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 120);
    }
}
window.addEventListener('error', () => setTimeout(forceBootVisible, 0));
window.addEventListener('unhandledrejection', () => setTimeout(forceBootVisible, 0));
setTimeout(forceBootVisible, 5200);

function showToast(message, opts){
    opts = opts || {};
    const type = opts.type || 'info';
    const title = opts.title || (type === 'error' ? 'Something went wrong'
                              : type === 'success' ? 'Done'
                              : 'Notice');
    const duration = opts.duration || (type === 'error' ? 5000 : 3200);
    const wrap = document.getElementById('toastWrap');
    if(!wrap){ return; }
    const icon = type === 'error' ? '!' : type === 'success' ? '✓' : 'i';
    const el = document.createElement('div');
    el.className = 'toast t-' + type;
    el.innerHTML =
        '<div class="toast-icon">' + icon + '</div>' +
        '<div class="toast-body">' +
            '<div class="toast-title"></div>' +
            '<div class="toast-msg"></div>' +
        '</div>' +
        '<div class="toast-bar" style="animation-duration:' + duration + 'ms;"></div>';
    el.querySelector('.toast-title').textContent = title;
    el.querySelector('.toast-msg').textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    let done = false;
    const dismiss = () => {
        if(done) return; done = true;
        el.classList.remove('show');
        el.classList.add('hide');
        setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 360);
    };
    el.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
    return el;
}

let pianoRuntimePrepared = false;
let pianoEntryLoadingProgress = 0;
window.__papianoPianoInputReady = false;

function setPianoInputReady(ready){
    window.__papianoPianoInputReady = !!ready;
}

function isPianoInputAllowed(){
    return document.body.classList.contains('mp-room-active') && window.__papianoPianoInputReady === true;
}

function setPianoEntryLoading(progress, label){
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingLabel = document.querySelector('.ld-main-label');
    const ldBar1 = document.getElementById('ldBar1');
    if(!loadingScreen) return;
    pianoEntryLoadingProgress = Math.max(pianoEntryLoadingProgress, Math.max(0, Math.min(100, Number(progress) || 0)));
    loadingScreen.style.display = 'flex';
    loadingScreen.classList.remove('fade-out');
    loadingScreen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('mp-entering-piano');
    if(ldBar1){
        ldBar1.classList.toggle('done', pianoEntryLoadingProgress >= 100);
        ldBar1.style.width = pianoEntryLoadingProgress + '%';
    }
    if(label && loadingLabel) loadingLabel.textContent = label;
}

function hidePianoEntryLoading(){
    const loadingScreen = document.getElementById('loadingScreen');
    if(!loadingScreen) return;
    loadingScreen.classList.add('fade-out');
    loadingScreen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mp-entering-piano');
    setTimeout(() => {
        if(!document.body.classList.contains('mp-entering-piano')) loadingScreen.style.display = 'none';
    }, 260);
}

function preparePianoRuntimeForEntry(){
    if(pianoRuntimePrepared) return true;
    try{
        if(typeof syncCanvasSize === 'function') syncCanvasSize(true);
        if(typeof build === 'function') build();
        if(typeof ensurePianoBootVisible === 'function') ensurePianoBootVisible();
        if(typeof updateKeyHitCache === 'function') updateKeyHitCache();
        if(typeof refreshStageHeight === 'function') refreshStageHeight();
        if(typeof refreshNoteXCache === 'function') refreshNoteXCache();
        if(typeof startStageFreshWatcher === 'function') startStageFreshWatcher();
        pianoRuntimePrepared = true;
        return true;
    }catch(e){
        return false;
    }
}

async function preparePianoEntryRuntime(){
    setPianoInputReady(false);
    setPianoEntryLoading(42, 'Building Piano');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ready = preparePianoRuntimeForEntry();
    setPianoEntryLoading(76, 'Preparing Visuals');
    try{
        if(typeof getDustSprite === 'function'){
            const color = (typeof saberColor !== 'undefined' && saberColor) ? saberColor : '#ffffff';
            getDustSprite(color);
        }
        if(typeof ctx2d !== 'undefined' && ctx2d){
            ctx2d.save();
            ctx2d.globalAlpha = 0;
            ctx2d.fillRect(0, 0, 1, 1);
            ctx2d.restore();
        }
    }catch(e){}
    return ready;
}

function clearPianoEntryVisualState(){
    try{
        if(typeof stopAllNotes === 'function') stopAllNotes();
        if(Array.isArray(falling)) falling.length = 0;
        if(typeof fallingByMidi !== 'undefined' && fallingByMidi) fallingByMidi.clear();
        if(typeof neonDustEmitters !== 'undefined' && neonDustEmitters) neonDustEmitters.clear();
        if(typeof pressStartTimes !== 'undefined' && pressStartTimes) pressStartTimes.clear();
        if(typeof pointerNoteMap !== 'undefined' && pointerNoteMap) pointerNoteMap.clear();
        if(typeof qwertyHeldByCode !== 'undefined' && qwertyHeldByCode) qwertyHeldByCode.clear();
        if(typeof midiPedalHeldNotes !== 'undefined' && midiPedalHeldNotes) midiPedalHeldNotes.clear();
        if(typeof pendingActiveRemoves !== 'undefined' && pendingActiveRemoves) pendingActiveRemoves.clear();
        if(typeof _keyColorMap !== 'undefined' && _keyColorMap) _keyColorMap.clear();
        document.querySelectorAll('#piano .active').forEach(el => {
            el.classList.remove('active');
            _applyKeyColor(el, '');
            if(typeof setActiveKeyOverlay === 'function') setActiveKeyOverlay(el, false);
        });
        if(typeof chordNotes !== 'undefined' && chordNotes) chordNotes.clear();
        if(typeof requestChordUpdate === 'function') requestChordUpdate();
    }catch(e){}
}

async function finalizePianoEntryRuntime(){
    setPianoEntryLoading(88, 'Syncing Layout');
    setPianoInputReady(false);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try{
        if(typeof markStageGeomDirty === 'function') markStageGeomDirty();
        if(typeof refreshStageHeight === 'function') refreshStageHeight();
        if(typeof updateKeyLayout === 'function') updateKeyLayout();
        if(typeof syncCanvasSize === 'function') syncCanvasSize(true);
        if(typeof updateKeyHitCache === 'function') updateKeyHitCache();
        if(typeof refreshNoteXCache === 'function') refreshNoteXCache();
        if(typeof ensureStageCanvasFresh === 'function') ensureStageCanvasFresh(true);
    }catch(e){}
    clearPianoEntryVisualState();
    await new Promise(resolve => requestAnimationFrame(resolve));
    try{
        if(typeof markStageGeomDirty === 'function') markStageGeomDirty();
        if(typeof syncCanvasSize === 'function') syncCanvasSize(true);
        if(typeof updateKeyLayout === 'function') updateKeyLayout();
        if(typeof updateKeyHitCache === 'function') updateKeyHitCache();
        if(typeof refreshNoteXCache === 'function') refreshNoteXCache();
    }catch(e){}
    setPianoInputReady(true);
    setPianoEntryLoading(100, 'Ready');
    await new Promise(resolve => setTimeout(resolve, 80));
}

window.addEventListener('load', () => {
    const app = document.getElementById('app');
    const loadingScreen = document.getElementById('loadingScreen');
    if(app) app.classList.add('fade-in');
    if(loadingScreen && !document.body.classList.contains('mp-entering-piano')){
        loadingScreen.classList.add('fade-out');
        loadingScreen.setAttribute('aria-hidden', 'true');
        loadingScreen.style.display = 'none';
    }
});

function startBackgroundSoundfont(){
    if (window.__papianoSoundfontStarted) return;
    window.__papianoSoundfontStarted = true;
    const chip = document.getElementById('bootSfChip');
    const txt  = document.getElementById('bootSfChipText');
    const bar  = document.getElementById('bootSfChipBar');
    const setTxt = s => { if (txt) txt.textContent = s; };
    const setBar = p => { if (bar) bar.style.width = Math.max(0, Math.min(100, p)) + '%'; };
    if (chip) chip.classList.add('show');
    setTxt('Loading sound');
    try {
        loadSoundfontWithProgress(
            'sf1',
            'https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-mp3.js',
            (decoded, total) => {
                const pct = total > 0 ? Math.round((decoded / total) * 100) : 0;
                setBar(pct);
                setTxt('Loading sound  ' + pct + '%');
            },
            ok => {
                if (ok) {
                    setBar(100);
                    setTxt('Sound ready');
                    if (chip) chip.classList.add('ready');
                    setTimeout(() => { if (chip) chip.classList.remove('show'); }, 1400);
                } else {
                    setTxt('Sound unavailable — visuals only');
                    setTimeout(() => { if (chip) chip.classList.remove('show'); }, 2600);
                }
            },
            'piano'
        );

        setTimeout(() => { if (chip) chip.classList.remove('show'); }, 15000);
    } catch (e) {
        setTxt('Sound unavailable — visuals only');
        setTimeout(() => { if (chip) chip.classList.remove('show'); }, 2600);
    }
}

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = (() => {
    try { return new AudioContextClass({ latencyHint: 'interactive' }); }
    catch(e) { return new AudioContextClass(); }
})();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 1.0;
// Brick-wall limiter so many simultaneous voices can't sum past 0 dBFS and
// hard-clip into the crackle/static the user reported on chords/fast play.
const masterLimiter = audioCtx.createDynamicsCompressor();
try {
    masterLimiter.threshold.value = -3.0;
    masterLimiter.knee.value = 0.0;
    masterLimiter.ratio.value = 20.0;
    masterLimiter.attack.value = 0.003;
    masterLimiter.release.value = 0.25;
} catch(e) {}
masterGain.connect(masterLimiter);
masterLimiter.connect(audioCtx.destination);
let _recAudioDest = null;
function getRecAudioDest() {
    if (_recAudioDest) return _recAudioDest;
    _recAudioDest = audioCtx.createMediaStreamDestination();
    masterLimiter.connect(_recAudioDest);
    return _recAudioDest;
}
let reverbNode = null, reverbGain = null, reverbEnabled = false, currentSf = "sf1", currentStringSf = "stringSf1", stringEnabled = false, sustainLevel = 1.00, reverbLevel = 0.0, pianoVolume = 1.00, stringVolume = 0.75;
const SOUNDFONT_LABELS = {
    sf1:'Grand Piano',
    sf2:'Soft Piano',
    sf3:'Studio Piano',
    sf4:'Bright Piano',
    ep1:'Electric Piano 1',
    ep2:'Electric Piano 2',
    stringSf1:'String Ensemble',
    stringSf2:'Slow Strings',
    stringSf3:'Cello',
    stringSf4:'Viola',
    stringSf5:'Violin',
    stringSf6:'Bass Pizzicato',
    otherSf1:'Acoustic Guitar',
    otherSf2:'Steel Guitar',
    otherSf3:'Electric Guitar',
    otherSf4:'Overdrive Guitar',
    otherSf5:'Acoustic Bass',
    otherSf6:'Electric Bass',
    otherSf7:'Choir',
    otherSf8:'Flute',
    otherSf9:'Trumpet',
    otherSf10:'Marimba',
    otherSf11:'Vibraphone',
    otherSf12:'Harp'
};
function getSoundfontName(sfKey){
    return SOUNDFONT_LABELS[sfKey] || 'SoundFont';
}
function syncInstrumentStateIfReady(){
    if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.syncInstrument === 'function') window.PapianoMultiplayer.syncInstrument();
}
function updateSoundfontPickerUI(){
    const mainCurrent = document.getElementById('mainSfCurrent');
    const layerCurrent = document.getElementById('layerSfCurrent');
    if(mainCurrent) mainCurrent.textContent = getSoundfontName(currentSf);
    if(layerCurrent) layerCurrent.textContent = getSoundfontName(currentStringSf);
    document.querySelectorAll('.sf-option[data-layer="piano"]').forEach(btn => btn.classList.toggle('active', btn.dataset.sfKey === currentSf));
    document.querySelectorAll('.sf-option[data-layer="string"]').forEach(btn => btn.classList.toggle('active', btn.dataset.sfKey === currentStringSf));
}
let midiSustainPedalDown = false;
let manualSustainEnabled = false;
const midiPedalHeldNotes = new Set();
function getActivePianoSustain(){
    return (manualSustainEnabled || midiSustainPedalDown) ? Math.max(0, Math.min(1, sustainLevel || 0)) : 0;
}
function releaseMidiPedalHeldNotes(){
    if(!midiPedalHeldNotes.size) return;
    const notes = Array.from(midiPedalHeldNotes);
    midiPedalHeldNotes.clear();
    notes.forEach(note => stopNote(note));
}
function refreshSustainButton(){
    const active = !!(manualSustainEnabled || midiSustainPedalDown);
    const midiOnly = !!(!manualSustainEnabled && midiSustainPedalDown);
    const btn = document.getElementById('holdBtn');
    if(btn){
        btn.classList.toggle('active', active);
        btn.classList.toggle('midi-sustain-active', midiOnly);
        btn.title = midiOnly ? 'Sustain: MIDI pedal ON' : (manualSustainEnabled ? 'Sustain: Manual ON' : 'Sustain');
    }
    const settingsBtn = document.getElementById('settingsSustainBtn');
    if(settingsBtn){
        settingsBtn.classList.toggle('active', active);
        settingsBtn.classList.toggle('midi-sustain-active', midiOnly);
        settingsBtn.title = midiOnly ? 'Sustain: MIDI pedal ON' : (manualSustainEnabled ? 'Sustain: Manual ON' : 'Sustain');
    }
}
function setManualSustain(enabled){
    const wasActive = manualSustainEnabled || midiSustainPedalDown;
    manualSustainEnabled = !!enabled;
    refreshSustainButton();
    if(wasActive && !manualSustainEnabled && !midiSustainPedalDown) releaseMidiPedalHeldNotes();
    if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendSustainState === 'function') window.PapianoMultiplayer.sendSustainState();
}
function setMidiSustainPedal(down){
    const wasActive = manualSustainEnabled || midiSustainPedalDown;
    midiSustainPedalDown = !!down;
    refreshSustainButton();
    if(wasActive && !manualSustainEnabled && !midiSustainPedalDown) releaseMidiPedalHeldNotes();
    if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendSustainState === 'function') window.PapianoMultiplayer.sendSustainState();
}
// Sustain button (click mode) toggle. If sustain is active for ANY reason —
// including a MIDI pedal whose "up" was never received and got stuck down —
// a click force-clears everything so the user can always turn it off. (Before,
// a stuck MIDI flag made the click button unable to disable sustain; only a
// reload fixed it.)
function toggleSustainHold(){
    if(manualSustainEnabled || midiSustainPedalDown){
        manualSustainEnabled = false;
        midiSustainPedalDown = false;
        isSus = false;
        refreshSustainButton();
        releaseMidiPedalHeldNotes();
        if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendSustainState === 'function') window.PapianoMultiplayer.sendSustainState();
    } else {
        setManualSustain(true);
        isSus = true;
    }
}
let stringRangeLeft = 21;
let stringRangeRight = 108;
const sfEffectSettings = {
    sf1: { sustain: 1.00, reverb: 0.00 },
    sf2: { fadeSec: 2.00, reverb: 0.00 }
};
let sfBuffers = {};
let stringBuffers = {};
let loadedSfKey = null;
let stringLoadedSfKey = null;


function buildReverb() {
    if (reverbNode) return;
    const len = audioCtx.sampleRate * 2.2;
    const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6); }
    reverbNode = audioCtx.createConvolver(); reverbNode.buffer = buf;
    reverbGain = audioCtx.createGain(); reverbGain.gain.value = 0.65;
    reverbNode.connect(reverbGain); reverbGain.connect(masterGain);
}

const activeNotes = new Map();

function midiNoteToName(midi) {
    const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const oct = Math.floor(midi / 12) - 1;
    return names[midi % 12] + oct;
}

const STRING_TUTS_MIN = 1;
const STRING_TUTS_MAX = 88;
const STRING_TUTS_MIDI_OFFSET = 20;
const STRING_RANGE_SETTINGS_VERSION = 2;

function clampStringTuts(value, fallback){
    const parsed = Math.round(Number(value));
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(STRING_TUTS_MIN, Math.min(STRING_TUTS_MAX, safe));
}
function midiToTuts(midi){
    return clampStringTuts((Number(midi) || 0) - STRING_TUTS_MIDI_OFFSET, 1);
}
function tutsToMidi(tuts){
    return clampStringTuts(tuts, 1) + STRING_TUTS_MIDI_OFFSET;
}
function clampStringRange(){
    let leftTuts = midiToTuts(stringRangeLeft || 21);
    let rightTuts = midiToTuts(stringRangeRight || 108);
    if (leftTuts > rightTuts) {
        const swap = leftTuts;
        leftTuts = rightTuts;
        rightTuts = swap;
    }
    stringRangeLeft = tutsToMidi(leftTuts);
    stringRangeRight = tutsToMidi(rightTuts);
}
function updateStringRangeUI(){
    clampStringRange();
    const leftTuts = midiToTuts(stringRangeLeft);
    const rightTuts = midiToTuts(stringRangeRight);
    const leftPct = ((leftTuts - STRING_TUTS_MIN) / (STRING_TUTS_MAX - STRING_TUTS_MIN)) * 100;
    const rightPct = ((rightTuts - STRING_TUTS_MIN) / (STRING_TUTS_MAX - STRING_TUTS_MIN)) * 100;
    const val = document.getElementById('stringRangeVal');
    const leftInput = document.getElementById('stringLeftTutsRange');
    const rightInput = document.getElementById('stringRightTutsRange');
    const leftLabel = document.getElementById('stringLeftTutsLabel');
    const rightLabel = document.getElementById('stringRightTutsLabel');
    const slider = document.getElementById('stringRangeSlider');
    if (val) val.textContent = 'Keys ' + leftTuts + ' - ' + rightTuts;
    if (leftInput && leftInput.value !== String(leftTuts)) leftInput.value = leftTuts;
    if (rightInput && rightInput.value !== String(rightTuts)) rightInput.value = rightTuts;
    if (leftLabel) leftLabel.textContent = 'L ' + midiNoteToName(stringRangeLeft);
    if (rightLabel) rightLabel.textContent = 'R ' + midiNoteToName(stringRangeRight);
    if (slider) {
        slider.style.setProperty('--string-range-left', leftPct + '%');
        slider.style.setProperty('--string-range-right', rightPct + '%');
    }
}
function isMidiInStringRange(midi){
    clampStringRange();
    return midi >= stringRangeLeft && midi <= stringRangeRight;
}
function setStringRangeTuts(edge, value){
    let leftTuts = midiToTuts(stringRangeLeft);
    let rightTuts = midiToTuts(stringRangeRight);
    const next = clampStringTuts(value, edge === 'left' ? leftTuts : rightTuts);
    if (edge === 'left') leftTuts = Math.min(next, rightTuts);
    else rightTuts = Math.max(next, leftTuts);
    stringRangeLeft = tutsToMidi(leftTuts);
    stringRangeRight = tutsToMidi(rightTuts);
    updateStringRangeUI();
}
function bindStringRangeSliders(){
    const leftInput = document.getElementById('stringLeftTutsRange');
    const rightInput = document.getElementById('stringRightTutsRange');
    if (leftInput) leftInput.oninput = e => setStringRangeTuts('left', e.target.value);
    if (rightInput) rightInput.oninput = e => setStringRangeTuts('right', e.target.value);
}

const soundfontBufferCache = new Map();
const MAX_CACHED_SOUNDFONTS = 4;
const soundfontLoadSeq = { piano: 0, string: 0 };
const SOUNDFONT_LOAD_TIMEOUT_MS = 10000;

function countBufferMap(buffers){ return Object.keys(buffers || {}).length; }

function cloneBufferMap(buffers) {
    return Object.assign({}, buffers || {});
}

function getLayerBuffers(layer) {
    return layer === 'string' ? stringBuffers : sfBuffers;
}

function setLayerBuffers(layer, buffers, sfKey) {
    if (layer === 'string') {
        stringBuffers = cloneBufferMap(buffers);
        stringLoadedSfKey = sfKey;
    } else {
        sfBuffers = cloneBufferMap(buffers);
        loadedSfKey = sfKey;
    }
}

function getLoadedKey(layer) {
    return layer === 'string' ? stringLoadedSfKey : loadedSfKey;
}

function cacheSoundfontBuffers(sfKey, buffers) {
    if (!sfKey || !buffers || countBufferMap(buffers) === 0) return;
    if (soundfontBufferCache.has(sfKey)) soundfontBufferCache.delete(sfKey);
    soundfontBufferCache.set(sfKey, cloneBufferMap(buffers));
    while (soundfontBufferCache.size > MAX_CACHED_SOUNDFONTS) {
        const oldestKey = soundfontBufferCache.keys().next().value;
        soundfontBufferCache.delete(oldestKey);
    }
}

function useCachedSoundfont(sfKey, layer='piano') {
    if (!soundfontBufferCache.has(sfKey)) return false;
    const cached = soundfontBufferCache.get(sfKey);
    soundfontBufferCache.delete(sfKey);
    soundfontBufferCache.set(sfKey, cached);
    setLayerBuffers(layer, cached, sfKey);
    return countBufferMap(getLayerBuffers(layer)) > 0;
}

function decodeAndStoreBuffers(pianoData, onProgress, onDone, sfKeyForCache, layer='piano') {
    const targetBuffers = {};
    const notes = Object.keys(pianoData || {});
    let decoded = 0;
    const total = notes.length;
    let finished = false;
    const finishOne = () => {
        if (finished) return;
        decoded++;
        if (onProgress) onProgress(decoded, total);
        if (decoded >= total) {
            finished = true;
            cacheSoundfontBuffers(sfKeyForCache, targetBuffers);
            setLayerBuffers(layer, targetBuffers, sfKeyForCache);
            if (onDone) onDone(countBufferMap(targetBuffers) > 0);
        }
    };
    if (total === 0) { if(onDone) onDone(false); return; }
    notes.forEach(note => {
        try {
            const dataUri = pianoData[note];
            const b64 = dataUri && dataUri.split(',')[1];
            if (!b64) { finishOne(); return; }
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            audioCtx.decodeAudioData(bytes.buffer.slice(0),
                buf => { targetBuffers[note] = buf; finishOne(); },
                () => { finishOne(); }
            );
        } catch(e) { finishOne(); }
    });
}

function loadSoundfont(sfKey, url, callback, layer='piano') {
    loadSoundfontWithProgress(sfKey, url, null, ok => { if(callback) callback(ok); }, layer);
}

function loadSoundfontWithProgress(sfKey, url, onProgress, onDone, layer='piano') {
    const isReady = () => getLoadedKey(layer) === sfKey && countBufferMap(getLayerBuffers(layer)) > 0;
    if (isReady()) { if(onDone) onDone(true); return; }
    if (useCachedSoundfont(sfKey, layer)) {
        const total = countBufferMap(getLayerBuffers(layer));
        if (onProgress) onProgress(total, total);
        if (onDone) onDone(total > 0);
        return;
    }

    const seq = ++soundfontLoadSeq[layer];
    let settled = false;
    const done = ok => {
        if (settled || seq !== soundfontLoadSeq[layer]) return;
        settled = true;
        clearTimeout(timeoutId);
        if (onDone) onDone(!!ok && isReady());
    };

    const oldScript = document.getElementById('sf-script-' + layer);
    if (oldScript) oldScript.remove();
    if (!window.MIDI) window.MIDI = {};
    window.MIDI.Soundfont = {};

    const script = document.createElement('script');
    script.id = 'sf-script-' + layer;
    script.src = url;

    const timeoutId = setTimeout(() => {
        try { script.remove(); } catch(e) {}
        done(false);
    }, SOUNDFONT_LOAD_TIMEOUT_MS);

    script.onload = () => {
        if (seq !== soundfontLoadSeq[layer]) return;
        const sfData = window.MIDI && window.MIDI.Soundfont;
        const key = sfData && Object.keys(sfData)[0];
        if (key && sfData[key]) {
            decodeAndStoreBuffers(sfData[key], onProgress, ok => done(ok), sfKey, layer);
            return;
        }
        done(false);
    };
    script.onerror = () => done(false);
    document.head.appendChild(script);
}

function playSfBuffer(soundMidi, vel, activeKey, layer='piano') {
    const buffers = getLayerBuffers(layer);
    const noteName = midiNoteToName(soundMidi);
    const buf = buffers[noteName];
    if (!buf) return false;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gainNode = audioCtx.createGain();
    const fx = layer === 'string' ? sfEffectSettings.sf2 : sfEffectSettings.sf1;
    const volume = layer === 'string' ? stringVolume : pianoVolume;
    const layerBoost = layer === 'string' ? 1.2 : 2.25;
    const now = audioCtx.currentTime;
    const peak = (vel || 0.8) * layerBoost * volume;
    // Tiny attack ramp instead of an instant jump — a hard step on the first
    // sample is an audible click/crackle, especially on fast repeated notes.
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + 0.006);
    src.connect(gainNode);
    gainNode.connect(masterGain);
    if ((fx.reverb || 0) > 0) {
        if (!reverbNode) buildReverb();
        if (reverbNode) {
            const sendGain = audioCtx.createGain();
            sendGain.gain.value = Math.min(0.85, Math.max(0, fx.reverb * 0.85));
            gainNode.connect(sendGain);
            sendGain.connect(reverbNode);
        }
    }
    const key = activeKey ?? soundMidi;
    const voice = {
        key,
        layer,
        sustain: layer === 'string' ? 0 : (fx.sustain || 0),
        fadeSec: layer === 'string' ? (fx.fadeSec || STRING_FADE_DEFAULT) : 0,
        masterGain: gainNode,
        oscillators: [],
        released: false,
        sfSrc: src,
        startedAt: now,
        ended: false
    };
    src.onended = () => cleanupVoiceRef(voice);
    src.start();
    activeNotes.set(key, voice);
    activeVoices.push(voice);
    enforceVoiceLimit();
    return true;
}

let activeVoices = [];
// Strings double the voice count (piano + string per key) and their tails ring
// for the whole fade, so 42 was reclaimed constantly during normal play. 64
// gives string tails room to finish; buffer-source voices live on the audio
// thread so this does not touch main-thread FPS.
const MAX_ACTIVE_VOICES = 64;
const MAX_RELEASE_SECONDS = 18.00;
const PIANO_MIN_RELEASE_TC = 0.22;
const PIANO_MIN_RELEASE_DELAY = 0.65;
// Shared so local playback and remote (RTDB) playback use identical values.
const STRING_VEL_SCALE = 0.82;   // strings sit slightly under the piano
const STRING_FADE_DEFAULT = 2.0; // layer fade acts like the layer's sustain/release
// When the cap forces us to reclaim a voice, fade it out smoothly instead of
// slamming it in 14ms — the slam was the audible string cutoff.
const VOICE_STEAL_TC = 0.05;
const VOICE_STEAL_DELAY = 0.16;
function _isStringVoice(v){ return v && (v.layer === 'string' || v.layer === 'remoteString'); }

function cleanupVoiceRef(voice){
    if (!voice) return;
    voice.ended = true;
    const current = activeNotes.get(voice.key);
    if (current === voice) activeNotes.delete(voice.key);
}
function releaseVoice(voice, releaseTC, stopDelay) {
    if (!voice || voice.released) return;
    voice.released = true;
    const now = audioCtx.currentTime;
    const tc = Math.max(0.012, releaseTC ?? 0.08);
    const delay = Math.max(0.05, Math.min(stopDelay ?? 0.3, MAX_RELEASE_SECONDS));
    if (voice.masterGain) {
        try {
            voice.masterGain.gain.cancelScheduledValues(now);
            const currentGain = voice.masterGain.gain.value;
            voice.masterGain.gain.setValueAtTime(currentGain, now);
            voice.masterGain.gain.setTargetAtTime(0.0001, now, tc);
        } catch(e) {}
    }
    if (voice.sfSrc) {
        try { voice.sfSrc.stop(now + delay); } catch(e) { setTimeout(() => cleanupVoiceRef(voice), Math.ceil(delay * 1000) + 120); }
    } else if (voice.oscillators && voice.oscillators.length > 0) {
        voice.oscillators.forEach(osc => { try { osc.stop(now + delay); } catch(e) {} });
        setTimeout(() => cleanupVoiceRef(voice), Math.ceil(delay * 1000) + 120);
    }
}

function enforceVoiceLimit() {
    let w = 0;
    for (let i = 0; i < activeVoices.length; i++) {
        const v = activeVoices[i];
        if (v && !v.ended) activeVoices[w++] = v;
    }
    activeVoices.length = w;
    const sustainActive = (manualSustainEnabled || midiSustainPedalDown) && getActivePianoSustain() > 0.01;
    const burstLimit = (!sustainActive && typeof getBurstLevel === 'function' && getBurstLevel() > 11) ? Math.max(34, MAX_ACTIVE_VOICES - 4) : MAX_ACTIVE_VOICES;
    if (activeVoices.length <= burstLimit) return;

    const needKill = activeVoices.length - burstLimit;
    let killed = 0;
    // Victim priority, oldest-first within each tier:
    //   pass 0: already-released voices (fading out anyway)
    //   pass 1: still-held piano voices
    //   pass 2: still-held string voices (protected last — these are the tails
    //           whose abrupt removal was the audible cutoff)
    for (let pass = 0; pass < 3 && killed < needKill; pass++) {
        let victimIndex = -1;
        let victimAge = Infinity;
        for (let i = 0; i < activeVoices.length; i++) {
            const v = activeVoices[i];
            if (!v || v.ended) continue;
            if (pass === 0 && !v.released) continue;
            if (pass === 1 && (v.released || _isStringVoice(v))) continue;
            if (pass === 2 && v.released) continue;
            const age = v.startedAt || 0;
            if (age < victimAge) { victimAge = age; victimIndex = i; }
        }
        if (victimIndex < 0) continue;
        releaseVoice(activeVoices[victimIndex], VOICE_STEAL_TC, VOICE_STEAL_DELAY);
        activeVoices[victimIndex].ended = true;
        killed++;
        pass = -1;
    }
    w = 0;
    for (let i = 0; i < activeVoices.length; i++) {
        const v = activeVoices[i];
        if (v && !v.ended) activeVoices[w++] = v;
    }
    activeVoices.length = w;
}

function getReleaseProfile(isFastGliss=false, sustainPct=sustainLevel) {
    if (isFastGliss) return { tc: 0.018, delay: 0.075 };
    const raw = Math.max(0, Math.min(1, sustainPct || 0));
    const pct = Math.pow(raw, 0.78);
    if (pct <= 0.0005) return { tc: PIANO_MIN_RELEASE_TC, delay: PIANO_MIN_RELEASE_DELAY };
    const tc = Math.min(PIANO_MIN_RELEASE_TC + pct * 3.03, 3.25);
    const delay = Math.min(PIANO_MIN_RELEASE_DELAY + pct * 13.95, 14.60);
    return { tc, delay };
}
function getStringFadeProfile(fadeSec, isFast=false) {
    if (isFast) return { tc: 0.014, delay: 0.055 };
    const sec = Math.max(0.1, Math.min(10.0, Number(fadeSec) || STRING_FADE_DEFAULT));
    return { tc: Math.max(0.018, Math.min(1.15, sec / 5.2)), delay: sec };
}

function fastReleaseActiveKey(key){
    const voice = activeNotes.get(key);
    if (!voice) return;
    releaseVoice(voice, 0.010, 0.045);
    activeNotes.delete(key);
}
function hasLayerBuffers(layer){
    const loadedKey = layer === 'string' ? stringLoadedSfKey : loadedSfKey;
    const buffers = layer === 'string' ? stringBuffers : sfBuffers;
    return !!loadedKey && !!buffers && Object.keys(buffers).length > 0;
}
function playNote(midi, transposeVal, velocity) {
    const vel = velocity !== undefined ? velocity : 0.8;
    const soundMidi = midi + (transposeVal || 0);
    fastReleaseActiveKey(midi);
    if (hasLayerBuffers('piano')) playSfBuffer(soundMidi, vel, midi, 'piano');
    if (stringEnabled && isMidiInStringRange(midi) && hasLayerBuffers('string')) {
        fastReleaseActiveKey('str:' + midi);
        playSfBuffer(soundMidi, vel * STRING_VEL_SCALE, 'str:' + midi, 'string');
    }
}

function stopNote(midi, fast=false) {
    const keys = [midi, 'str:' + midi];
    keys.forEach(key => {
        const voice = activeNotes.get(key);
        if (!voice) return;
        let profile;
        if (voice.layer === 'string') {
            profile = getStringFadeProfile(voice.fadeSec, !!fast);
            // The layer follows ONLY a real MIDI sustain pedal (it then holds as
            // long as the sustained piano tail). The manual / default sustain
            // (mobile / keyboard) does NOT drag the layer along — the layer is
            // managed by its own fade so main and layer keep independent triggers.
            if (!fast && midiSustainPedalDown) {
                const ps = getReleaseProfile(false, getActivePianoSustain());
                profile = { tc: Math.max(profile.tc, ps.tc), delay: Math.max(profile.delay, ps.delay) };
            }
        } else {
            profile = getReleaseProfile(!!fast, getActivePianoSustain());
        }
        releaseVoice(voice, profile.tc, profile.delay);
        activeNotes.delete(key);
    });
}

function stopAllNotes() {
    activeNotes.forEach(voice => releaseVoice(voice, 0.018, 0.08));
    activeNotes.clear();
    activeVoices.forEach(voice => releaseVoice(voice, 0.018, 0.08));
    activeVoices = [];
    pressStartTimes.clear();

    for(let i=0;i<falling.length;i++){ if(falling[i]) falling[i].growing = false; }
    fallingByMidi.clear();
    if(typeof neonDustEmitters !== 'undefined') neonDustEmitters.clear();
    if(typeof saberLine !== 'undefined' && saberLine) saberLine.classList.remove('saber-hit');
}

function setSfOverlayProgress(pct, done=false) {
    const sfBar = document.getElementById('sfProgressBar');
    const sfPct = document.getElementById('sfProgressPct');
    if (sfBar) {
        sfBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
        if (done) sfBar.style.background = 'linear-gradient(90deg,#00ff88,#00e5ff)';
    }
    if (sfPct) sfPct.textContent = Math.round(Math.max(0, Math.min(100, pct))) + '%';
}

function setStringLayerEnabled(on, skipConfirm=false) {
    stringEnabled = !!on;
    if (!stringEnabled) {
        activeNotes.forEach((voice, key) => {
            if (voice && voice.layer === 'string') {
                releaseVoice(voice, 0.014, 0.055);
                activeNotes.delete(key);
            }
        });
    }
    const layerTrack = document.getElementById('layerTrack');
    const settingsTrack = document.getElementById('settingsStringTrack');
    if (layerTrack) layerTrack.classList.toggle('active', stringEnabled);
    if (settingsTrack) settingsTrack.classList.toggle('active', stringEnabled);
    updateSoundfontPickerUI();
    if (stringEnabled && currentStringSf !== stringLoadedSfKey && SF_URLS[currentStringSf]) {
        const overlay = document.getElementById('sfLoadingOverlay');
        const nameEl = document.getElementById('sfLoadingName');
        const alreadyCached = soundfontBufferCache.has(currentStringSf) && useCachedSoundfont(currentStringSf, 'string');
        const syncBtns = () => {
            if (onBtn) onBtn.classList.toggle('active', stringEnabled);
            if (offBtn) offBtn.classList.toggle('active', !stringEnabled);
            if (settingsTrack) settingsTrack.classList.toggle('active', stringEnabled);
        };
        if (alreadyCached) {
            syncBtns();
            updateStringRangeUI();
            syncInstrumentStateIfReady();
            return;
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (nameEl) nameEl.textContent = getSoundfontName(currentStringSf);
        document.querySelectorAll('.floating-panel').forEach(x=>x.style.display='none');
        if (overlay) { overlay.style.display='flex'; overlay.classList.add('show'); }
        setSfOverlayProgress(0, false);
        loadSoundfontWithProgress(currentStringSf, SF_URLS[currentStringSf],
            (decoded, total) => {
                const pct = total > 0 ? (decoded / total) * 100 : 0;
                setSfOverlayProgress(pct, false);
            },
            ok => {
                if (ok) {
                    setSfOverlayProgress(100, true);
                    setTimeout(() => { if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; } }, 220);
                } else {
                    if (stringEnabled) stringEnabled = false;
                    setSfOverlayProgress(100, false);
                    if (nameEl) nameEl.textContent = 'Load failed. String layer off.';
                    setTimeout(() => { if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; } }, 900);
                }
                syncBtns();
                updateStringRangeUI();
            }, 'string');
    }
    updateStringRangeUI();
    syncInstrumentStateIfReady();
}

function selectSf(sfKey, url, el, name, layer='piano') {
    const prevKey = layer === 'string' ? currentStringSf : currentSf;
    const prevLoadedKey = getLoadedKey(layer);
    const prevActive = document.querySelector(`.sf-option[data-layer="${layer}"].active`);
    const overlay = document.getElementById('sfLoadingOverlay');
    const nameEl = document.getElementById('sfLoadingName');
    if (nameEl) nameEl.textContent = name || 'SoundFont';
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const applySuccess = () => {
        if (layer === 'string') currentStringSf = sfKey;
        else currentSf = sfKey;
        document.querySelectorAll(`.sf-option[data-layer="${layer}"]`).forEach(btn => btn.classList.toggle('active', btn.dataset.sfKey === sfKey));
        if (el) el.classList.add('active');
        stopAllNotes();
        updateSoundfontPickerUI();
        updateSfEffectUI();
        syncInstrumentStateIfReady();
    };

    if (getLoadedKey(layer) === sfKey && countBufferMap(getLayerBuffers(layer)) > 0) {
        applySuccess();
        if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; }
        return;
    }
    if (soundfontBufferCache.has(sfKey) && useCachedSoundfont(sfKey, layer)) {
        applySuccess();
        if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; }
        return;
    }

    document.querySelectorAll('.floating-panel').forEach(x=>x.style.display='none');
    if (overlay) { overlay.style.display='flex'; overlay.classList.add('show'); }
    setSfOverlayProgress(0, false);

    loadSoundfontWithProgress(sfKey, url,
        (decoded, total) => {
            const pct = total > 0 ? (decoded / total) * 100 : 0;
            setSfOverlayProgress(pct, false);
        },
        ok => {
            if (ok) {
                applySuccess();
                setSfOverlayProgress(100, true);
                setTimeout(() => { if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; } }, 220);
            } else {
                if (layer === 'string') currentStringSf = prevKey;
                else currentSf = prevKey;
                if (prevLoadedKey && getLoadedKey(layer) !== prevLoadedKey && soundfontBufferCache.has(prevLoadedKey)) useCachedSoundfont(prevLoadedKey, layer);
                document.querySelectorAll(`.sf-option[data-layer="${layer}"]`).forEach(btn => btn.classList.remove('active'));
                if (prevActive) prevActive.classList.add('active');
                updateSoundfontPickerUI();
                setSfOverlayProgress(100, false);
                if (nameEl) nameEl.textContent = 'Load failed. Keeping current sound.';
                setTimeout(() => { if (overlay) { overlay.classList.remove('show'); overlay.style.display='none'; } }, 900);
            }
        },
        layer
    );
}

document.querySelectorAll('.sf-option[data-layer][data-sf-key]').forEach(btn => {
    btn.addEventListener('click', () => {
        const sfKey = btn.dataset.sfKey;
        const layer = btn.dataset.layer === 'string' ? 'string' : 'piano';
        if (SF_URLS[sfKey]) selectSf(sfKey, SF_URLS[sfKey], btn, getSoundfontName(sfKey), layer);
    });
});
const layerTrack = document.getElementById('layerTrack');
if(layerTrack) layerTrack.onclick = () => setStringLayerEnabled(!stringEnabled);
const settingsStringTrack = document.getElementById('settingsStringTrack');
if(settingsStringTrack) settingsStringTrack.onclick = () => setStringLayerEnabled(!stringEnabled);
bindStringRangeSliders();
setStringLayerEnabled(stringEnabled, true);
updateStringRangeUI();
updateSoundfontPickerUI();

const pianoEl = document.getElementById('piano');
const activeKeyLayer = document.getElementById('activeKeyLayer');
const canvas = document.getElementById('fx');
const ctx2d = canvas.getContext('2d', { alpha: true });
ctx2d.imageSmoothingEnabled = true;
ctx2d.imageSmoothingQuality = 'high';
ctx2d.globalCompositeOperation = 'source-over';
let canvasCssW = 0, canvasCssH = 0, currentDPR = 1;
let perfGovScale = 1.0;
const PERF_DPR_FLOOR = 1.0;
function getRenderDPR(){
    const native = Math.max(1, window.devicePixelRatio || 1);
    let cap; let isDefaultTier = false;
    try {
        const q = typeof getEffectiveGraphicQuality === 'function' ? getEffectiveGraphicQuality() : graphicQuality;
        isDefaultTier = (q === 'default');
        if(q === 'potato') cap = 1;
        else if(q === 'medium') cap = Math.min(native, 1.5);
        else if(isDefaultTier) cap = isMobileTargetMemo() ? Math.min(native, 2.0) : native; // mobile caps DPR; desktop keeps full native sharpness
        else cap = Math.min(native, 2.0); // high / Medium tier
    } catch(e){ cap = Math.min(native, 2.0); }
    // Desktop Default keeps full native sharpness with no governor. Mobile Default
    // and the other tiers let the governor trim DPR (and the cheap stuff) under load.
    const scaled = (isDefaultTier && !isMobileTargetMemo()) ? cap : cap * (perfGovScale > 0 ? perfGovScale : 1);
    return scaled < PERF_DPR_FLOOR ? PERF_DPR_FLOOR : scaled;
}

let _perfEmaMs = 1000 / 60;
let _perfGovLastChange = 0;
let _perfSlowStreak = 0;
let _perfFastStreak = 0;
const PERF_BUDGET_MS = 20.5;
const PERF_HEADROOM_MS = 13.6;
const PERF_GOV_COOLDOWN = 850;
const PERF_SCALE_MIN = 0.6;
const PERF_SCALE_MAX = 1.0;
function perfGovernorTick(frameMs, now){
    // Desktop Default = NO limits: the governor never runs, so particle count,
    // key overlay and DPR are never throttled. Mobile Default auto-adapts (and the
    // mobile tiers always do) to hold 60fps under load.
    if(getEffectiveGraphicQuality() === 'default' && !isMobileTargetMemo()){ if(perfGovScale !== 1) perfGovScale = 1; return; }
    if(!(frameMs > 0) || frameMs > 240) return;
    _perfEmaMs += (frameMs - _perfEmaMs) * 0.12;
    if(_perfEmaMs > PERF_BUDGET_MS){ _perfSlowStreak++; _perfFastStreak = 0; }
    else if(_perfEmaMs < PERF_HEADROOM_MS){ _perfFastStreak++; _perfSlowStreak = 0; }
    else { if(_perfSlowStreak) _perfSlowStreak--; if(_perfFastStreak) _perfFastStreak--; }
    if(now - _perfGovLastChange < PERF_GOV_COOLDOWN) return;
    if(_perfSlowStreak >= 3 && perfGovScale > PERF_SCALE_MIN){
        perfGovScale = Math.max(PERF_SCALE_MIN, perfGovScale - 0.16);
        _applyPerfGovScale(now);
    } else if(_perfFastStreak >= 50 && perfGovScale < PERF_SCALE_MAX){
        perfGovScale = Math.min(PERF_SCALE_MAX, perfGovScale + 0.08);
        _applyPerfGovScale(now);
    }
}
function _applyPerfGovScale(now){
    _perfGovLastChange = now;
    _perfSlowStreak = 0; _perfFastStreak = 0;
    if(document.body) document.body.classList.toggle('perf-lite', perfGovScale < 0.78);
    try { if(typeof markStageGeomDirty === 'function') markStageGeomDirty(); syncCanvasSize(true); } catch(e){}
}
let transpose=0, falling=[], isAnimOn=true, isSus=true, animStyle='default', animShape='rounded', animSize=18, animRoundness=100, noteOpacity=100, noteSpeed=75, wCount=52, lastFrameTime=0, viewOffset=0, whiteKeyWidth=0;
const RISE_SPEED=200, MAX_NOTE_HEIGHT=400;
function getAnimRiseSpeed(){
    const speed = sliderRatio(noteSpeed, 100);
    return RISE_SPEED * (0.12 + speed * 0.88);
}
const DT_MAX = 0.042;
let cachedAnimColor = '#ffffff';
const _solidRgbCache = new Map();
let rainbowV2Seq = 0, renderNow = 0;
let animDoubleLeftColor = '#ffffff';
let animDoubleRightColor = '#ffffff';
let animDoubleSplitTuts = 44;
function refreshAnimColor(){ cachedAnimColor = getComputedStyle(document.documentElement).getPropertyValue('--anim-color').trim() || '#ffffff'; }
function getAnimBaseColorForMidi(midi){
    if(animStyle === 'double') return midiToTuts(midi) < animDoubleSplitTuts ? animDoubleLeftColor : animDoubleRightColor;
    return cachedAnimColor || '#ffffff';
}
// Resolve the requested anim style against the active graphics profile: heavy
// fill styles collapse to plain 'solid' when heavy FX are off (Potato tier), so
// new notes and resynced in-flight notes stay consistent and cheap there.
function resolveAnimStyle(style){
    const raw = style === 'double' ? 'default' : style;
    if(typeof getGraphicProfile === 'function' && !getGraphicProfile().heavyFx){
        return raw === 'rainbow' ? 'rainbow' : 'default';
    }
    return raw;
}
function syncFallingNoteVisualState(){
    if(Array.isArray(falling)) falling.forEach(f => {
        if(f.remote){
            f.style = 'default';
            f.styleResolved = 'default';
            if(f.colorOverride) f.base = f.colorOverride;
            return;
        }
        f.style = animStyle;
        f.styleResolved = resolveAnimStyle(animStyle);
        f.base = getAnimBaseColorForMidi(f.midi);
    });
    if(typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
    if(typeof ensureAnimLoop === 'function' && Array.isArray(falling) && falling.length > 0) ensureAnimLoop();
}
document.documentElement.style.setProperty('--anim-color','#ffffff');
refreshAnimColor();
const pressStartTimes = new Map();
const NOTE_NAME_DISPLAY = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

function isBlack(m) { return [1,3,6,8,10].includes(m%12); }
const ALL_WHITE = []; for(let m=21; m<=108; m++) if(!isBlack(m)) ALL_WHITE.push(m);
const C4_IDX = ALL_WHITE.indexOf(60); viewOffset = C4_IDX;
const BLACK_META = [];
ALL_WHITE.forEach((n, i) => {
    const nextMidi = n + 1;
    if (isBlack(nextMidi) && i < ALL_WHITE.length - 1) BLACK_META.push({ midi: nextMidi, whiteIndex: i });
});
const whiteIndexMap = new Map();
ALL_WHITE.forEach((midi, i) => whiteIndexMap.set(midi, i));
let whiteKeyEls = [];
let blackKeyEls = [];
let pianoSeparatorLayer = null;
const noteElementMap = new Map();
const activeKeyOverlayMap = new Map();
const activeOverlayNotes = new Set();
let keyHitCache = { wrapLeft: 0, wrapTop: 0, wrapBottom: 0, wrapHeight: 0, totalWidth: 0, blackBottom: 0, blackByBoundary: [], whiteEls: [] };

const QWERTY_LABEL_MAP = {"21":"C+1","22":"C+2","23":"C+3","24":"C+4","25":"C+5","26":"C+6","27":"C+7","28":"C+8","29":"C+9","30":"C+0","31":"C+Q","32":"C+W","33":"C+E","34":"C+R","35":"C+T","36":"1","37":"S+1","38":"2","39":"S+2","40":"3","41":"4","42":"S+4","43":"5","44":"S+5","45":"6","46":"S+6","47":"7","48":"8","49":"S+8","50":"9","51":"S+9","52":"0","53":"q","54":"S+Q","55":"w","56":"S+W","57":"e","58":"S+E","59":"r","60":"t","61":"S+T","62":"y","63":"S+Y","64":"u","65":"i","66":"S+I","67":"o","68":"S+O","69":"p","70":"S+P","71":"a","72":"s","73":"S+S","74":"d","75":"S+D","76":"f","77":"g","78":"S+G","79":"h","80":"S+H","81":"j","82":"S+J","83":"k","84":"l","85":"S+L","86":"z","87":"S+Z","88":"x","89":"c","90":"S+C","91":"v","92":"S+V","93":"b","94":"S+B","95":"n","96":"m","97":"C+Y","98":"C+U","99":"C+I","100":"C+O","101":"C+P","102":"C+A","103":"C+S","104":"C+D","105":"C+F","106":"C+G","107":"C+H","108":"C+J"};

function formatQwertyLabel(raw) {
    if (!raw) return '';
    const v = String(raw);
    const shifted = { '1':'!', '2':'@', '3':'#', '4':'$', '5':'%', '6':'^', '7':'&', '8':'*', '9':'(', '0':')' };
    if (v.startsWith('S+')) {
        const key = v.slice(2).toUpperCase();
        return shifted[key] || key;
    }
    if (v.startsWith('C+')) {
        const key = v.slice(2).toUpperCase();
        return '<span class="qwerty-ctrl-label"><span class="ctrl-mark">⌃</span><span class="ctrl-key">' + key + '</span></span>';
    }
    return v.toLowerCase();
}

function getNoteLabel(midi, mode) {
    if (mode === 'off') return '';
    if (mode === 'qwerty') return formatQwertyLabel(QWERTY_LABEL_MAP[midi]);
    if (mode === 'note') {
        const pc = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTE_NAME_DISPLAY[pc];
        if (isBlack(midi)) return name;
        return name + octave;
    }
    return '';
}

function updateKeyLabelStyle(labelEl, mode, blackKey) {
    if (!labelEl) return;
    const opacity = mode === 'off' ? '0' : '1';
    const fontFamily = mode === 'qwerty'
        ? "'JetBrains Mono','SF Mono','Consolas',monospace"
        : "'Quicksand',sans-serif";
    let letterSpacing, fontWeight, textTransform, textDecorationLine,
        textDecorationThickness, textUnderlineOffset, fontSizePx,
        bottom, color, textShadow;
    if (mode === 'qwerty') {
        letterSpacing = blackKey ? '0.025em' : '0.015em';
        fontWeight = blackKey ? '900' : '800';
        textTransform = 'none';
        textDecorationLine = 'none';
        textDecorationThickness = 'auto';
        textUnderlineOffset = 'auto';
        fontSizePx = (blackKey
            ? Math.max(11, Math.min(getBlackKeyWidthPx() * 0.46, 18))
            : Math.max(13, Math.min(whiteKeyWidth * 0.43, 21)));
        bottom = blackKey ? '12%' : '6%';
        color = blackKey ? 'rgba(255,255,255,0.98)' : 'rgba(82,86,92,0.82)';
        textShadow = blackKey
            ? '0 1px 0 rgba(0,0,0,0.95), 0 0 5px rgba(255,255,255,0.22)'
            : '0 1px 0 rgba(255,255,255,0.78)';
    } else {
        letterSpacing = '0';
        fontWeight = '700';
        textTransform = 'none';
        textDecorationLine = 'none';
        textDecorationThickness = 'auto';
        textUnderlineOffset = 'auto';
        fontSizePx = (blackKey
            ? Math.max(5, Math.min(getBlackKeyWidthPx() * 0.30, 13))
            : Math.max(7, Math.min(whiteKeyWidth * 0.28, 18)));
        bottom = blackKey ? '7%' : '6%';
        color = '';
        textShadow = '';
    }
    labelEl.style.cssText =
        'opacity:' + opacity +
        ';font-family:' + fontFamily +
        ';letter-spacing:' + letterSpacing +
        ';font-weight:' + fontWeight +
        ';text-transform:' + textTransform +
        ';text-decoration-line:' + textDecorationLine +
        ';text-decoration-thickness:' + textDecorationThickness +
        ';text-underline-offset:' + textUnderlineOffset +
        ';font-size:' + fontSizePx + 'px' +
        ';bottom:' + bottom +
        (mode === 'qwerty' ? ';white-space:normal;overflow:visible;line-height:0.9' : '') +
        (color ? ';color:' + color : '') +
        (textShadow ? ';text-shadow:' + textShadow : '');
}

let labelMode = 'off';
let pianoTheme = 'default';
let blackKeyWidthPercent = 120;
let blackKeyHeightPercent = 60;
let pianoVisibilityPercent = 100;

function getEffectiveVisibleWhiteCount(){
    return Math.max(1, Math.min(ALL_WHITE.length, Math.round(Number(wCount) || 52)));
}
function getSwipeMaxOffset(){
    return Math.max(0, ALL_WHITE.length - getEffectiveVisibleWhiteCount());
}
function clampOffset(){ viewOffset=Math.max(0, Math.min(getSwipeMaxOffset(), viewOffset)); }
function clampPianoCustomPercent(value, fallback, min, max){
    const parsed = Math.round(Number(value));
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, safe));
}
function getBlackKeyWidthRatio(){
    return Math.max(0.7, Math.min(1.3, blackKeyWidthPercent / 100));
}
function formatLayoutPx(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '0px';
    // 1e5 precision keeps device-pixel-snapped values (multiples of 1/3, 1/1.5 ...)
    // intact; coarser rounding would knock them off the device-pixel grid.
    const v = Math.abs(n) < 0.000005 ? 0 : Math.round(n * 100000) / 100000;
    return v + 'px';
}
function getLayoutDpr(){
    return Math.max(1, Math.min(4, window.devicePixelRatio || 1));
}
function getDevicePixelCssSize(){
    return 1 / getLayoutDpr();
}
function snapLayoutValue(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return 0;
    const dpr = getLayoutDpr();
    return Math.round(n * dpr) / dpr;
}
function getBlackKeyBaseRatio(){
    const width = Math.max(1, whiteKeyWidth || 1);
    if(width < 15) return 0.52;
    if(width < 20) return 0.56;
    if(width < 28) return 0.60;
    return 0.64;
}
function getPianoViewportWidth(){
    const vp = document.getElementById('pianoViewport');
    if(!vp) return 0;
    const r = vp.getBoundingClientRect();
    const rectW = r && Number.isFinite(r.width) ? r.width : 0;
    const layoutW = vp.clientWidth || vp.offsetWidth || 0;
    return Math.max(0, rectW || layoutW);
}
const whiteKeyEdges = [];
const whiteKeyWidths = [];
function syncWhiteKeyGeometry(viewportWidth){
    const rawWidth = Number(viewportWidth) || getPianoViewportWidth() || window.innerWidth || 1;
    const measuredWidth = Math.max(1, rawWidth);
    const visibleWhiteCount = getEffectiveVisibleWhiteCount();
    const nominalWhiteWidth = measuredWidth / visibleWhiteCount;
    const total = ALL_WHITE.length;
    whiteKeyWidth = nominalWhiteWidth;
    whiteKeyEdges.length = total + 1;
    whiteKeyWidths.length = total;
    whiteKeyEdges[0] = 0;
    for(let i=1; i<=total; i++){
        whiteKeyEdges[i] = snapLayoutValue(i * nominalWhiteWidth);
    }
    for(let i=0; i<total; i++){
        whiteKeyWidths[i] = Math.max(getDevicePixelCssSize(), whiteKeyEdges[i + 1] - whiteKeyEdges[i]);
    }
}
function getWhiteKeyLeftPx(whiteIndex){
    const idx = Math.max(0, Math.min(ALL_WHITE.length, Math.round(Number(whiteIndex) || 0)));
    return whiteKeyEdges[idx] ?? (idx * whiteKeyWidth);
}
function getWhiteKeyWidthPx(whiteIndex){
    const idx = Math.max(0, Math.min(ALL_WHITE.length - 1, Math.round(Number(whiteIndex) || 0)));
    return whiteKeyWidths[idx] || Math.max(1, whiteKeyWidth);
}
function getViewOffsetPx(offset){
    const raw = Number(offset);
    const idx = Math.round(raw);
    if(Number.isFinite(idx) && Math.abs(idx - raw) < 0.0001) return getWhiteKeyLeftPx(idx);
    return Math.max(0, raw || 0) * whiteKeyWidth;
}
function findWhiteIndexAtPianoX(x){
    if(!whiteKeyEdges.length) return Math.floor(x / whiteKeyWidth);
    let lo = 0;
    let hi = ALL_WHITE.length - 1;
    while(lo <= hi){
        const mid = (lo + hi) >> 1;
        if(x < getWhiteKeyLeftPx(mid)) hi = mid - 1;
        else if(x >= getWhiteKeyLeftPx(mid + 1)) lo = mid + 1;
        else return mid;
    }
    return Math.max(0, Math.min(ALL_WHITE.length - 1, lo));
}
function getBlackKeyWidthPx(){
    const rawWidth = whiteKeyWidth * getBlackKeyBaseRatio() * getBlackKeyWidthRatio();
    return Math.max(getDevicePixelCssSize(), snapLayoutValue(rawWidth));
}
function getBlackKeyCenterPx(whiteIndex){
    return getWhiteKeyLeftPx((Math.round(Number(whiteIndex) || 0)) + 1);
}
function getBlackKeyLeftPx(whiteIndex){
    return snapLayoutValue(getBlackKeyCenterPx(whiteIndex) - (getBlackKeyWidthPx() / 2));
}
function getBlackKeyBoundsForWhiteIndex(whiteIndex){
    if(whiteIndex < 0 || whiteIndex >= ALL_WHITE.length - 1) return null;
    const midi = ALL_WHITE[whiteIndex] + 1;
    if(!isBlack(midi)) return null;
    const left = getBlackKeyLeftPx(whiteIndex);
    const width = getBlackKeyWidthPx();
    return { midi, left, right: left + width, center: left + width / 2, width };
}
function getPianoTotalWidthPx(){
    return whiteKeyEdges[ALL_WHITE.length] || (ALL_WHITE.length * whiteKeyWidth);
}
function renderPianoSeparators(){
    if(!pianoSeparatorLayer) return;
    const totalWidth = getPianoTotalWidthPx();
    const lineWidth = getDevicePixelCssSize();
    const frag = document.createDocumentFragment();
    pianoSeparatorLayer.style.width = formatLayoutPx(totalWidth);
    for(let i=1; i<ALL_WHITE.length; i++){
        const line = document.createElement('i');
        line.className = 'piano-separator';
        // Edges are device-pixel-snapped, so edge minus one device pixel stays on
        // the grid; centering on the boundary instead would tie-break between two
        // device pixels and rasterize inconsistently across boundaries.
        line.style.left = formatLayoutPx(getWhiteKeyLeftPx(i) - lineWidth);
        line.style.width = formatLayoutPx(lineWidth);
        frag.appendChild(line);
    }
    pianoSeparatorLayer.replaceChildren(frag);
}
function syncPianoCustomControl(rangeId, labelId, value){
    const range = document.getElementById(rangeId);
    const label = document.getElementById(labelId);
    if(range && range.value !== String(value)) range.value = String(value);
    if(label) label.textContent = value + '%';
}
function setBlackKeyWidthPercent(value){
    blackKeyWidthPercent = clampPianoCustomPercent(value, 120, 70, 130);
    syncPianoCustomControl('blackKeyWidthRange', 'blackKeyWidthVal', blackKeyWidthPercent);
    updateKeyLayout();
}
function setPianoScalePercent(){
    clampOffset();
    updateKeyLayout();
    if(typeof updateKeyHitCache === 'function') updateKeyHitCache();
    if(typeof updateNoteXCache === 'function') requestAnimationFrame(updateNoteXCache);
}
function setBlackKeyHeightPercent(value){
    blackKeyHeightPercent = clampPianoCustomPercent(value, 60, 45, 75);
    document.documentElement.style.setProperty('--black-key-height', blackKeyHeightPercent + '%');
    syncPianoCustomControl('blackKeyHeightRange', 'blackKeyHeightVal', blackKeyHeightPercent);
}
function setPianoVisibilityPercent(value){
    pianoVisibilityPercent = clampPianoCustomPercent(value, 100, 0, 100);
    document.documentElement.style.setProperty('--piano-visibility', (pianoVisibilityPercent / 100).toFixed(2));
    syncPianoCustomControl('pianoVisibilityRange', 'pianoVisibilityVal', pianoVisibilityPercent);
}

function syncActiveKeyLayerTransform(px){
    if(activeKeyLayer) activeKeyLayer.style.transform = `translate3d(-${px}px,0,0)`;
}
// Overlay piece pool: reuse hidden <div>s instead of create+append on press and
// remove on release. The create/remove churn was the dominant per-press reflow
// cost during glissando / broken-chord spam; pooling keeps the exact same look
// with no DOM allocation or insertion/removal after warm-up.
const _overlayFreePool = [];
function _acquireOverlayPiece(){
    let el = _overlayFreePool.pop();
    if(!el){
        el = document.createElement('div');
        if(activeKeyLayer) activeKeyLayer.appendChild(el);
    }
    return el;
}
function _releaseOverlayPiece(el){
    if(!el) return;
    el.style.cssText = 'display:none';
    _overlayFreePool.push(el);
}
function clearActiveKeyOverlay(midi){
    const pieces = activeKeyOverlayMap.get(midi);
    if(!pieces) return;
    for(let i=0;i<pieces.length;i++) _releaseOverlayPiece(pieces[i]);
    activeKeyOverlayMap.delete(midi);
}
function shouldUseLightKeyVisual(){
    // Only drop the overlay when the perf governor is genuinely under pressure
    // AND many keys are held at once. Burst-/count-based flip-flopping here
    // caused the overlay to render on some keys and skip others mid-passage,
    // which read as inconsistent glow and jank. A single stable threshold keeps
    // the visual uniform; the real per-press savings come from emitting fewer
    // pieces per key (see renderActiveKeyOverlay), not from skipping keys.
    return getPerfPressureLevel() >= 3 && activeOverlayNotes.size >= 18;
}
function appendActiveKeyPiece(className, left, width, config){
    const piece = _acquireOverlayPiece();
    // Full reset: clears any prior taper custom-props / colour / display:none
    // from a previous use, and makes the reused element visible again.
    piece.style.cssText = '';
    piece.className = className;
    piece.style.left = formatLayoutPx(left);
    piece.style.width = formatLayoutPx(Math.max(1, width));
    if(config && config.whiteBottomTaper){
        const safeWidth = Math.max(1, Math.round(width));
        const leftCutPx = Math.max(0, Math.min(safeWidth * 0.32, config.leftCutPx || 0));
        const rightCutPx = Math.max(0, Math.min(safeWidth * 0.32, config.rightCutPx || 0));
        const taperDepthPct = Math.max(12, Math.min(28, config.taperDepthPct || 18));
        piece.classList.add('active-key-white-bottom-tapered');
        piece.style.setProperty('--active-white-left-cut-pct', ((leftCutPx / safeWidth) * 100).toFixed(2) + '%');
        piece.style.setProperty('--active-white-right-cut-pct', ((rightCutPx / safeWidth) * 100).toFixed(2) + '%');
        piece.style.setProperty('--active-white-taper-depth-pct', taperDepthPct.toFixed(2) + '%');
    }
    // Already attached to activeKeyLayer (on first acquire); reused pieces stay
    // put, so there is no append/remove cost on the hot path.
    return piece;
}
function renderActiveKeyOverlay(midi, keyEl, color){
    if(!activeKeyLayer) return;
    clearActiveKeyOverlay(midi);
    if(!Number.isFinite(midi) || midi < 21 || midi > 108) return;
    const pieces = [];
    const black = keyEl ? keyEl.classList.contains('black') : isBlack(midi);
    const bw = getBlackKeyWidthPx();
    // The `.active-key-light` and `.active-key-glow-shell` pieces are opacity:0
    // unless `key-glow-on` is active, so when the Light effect is off (the
    // default) they are invisible DOM that still costs a create/layout/remove
    // on every press. Skipping them roughly halves overlay DOM churn — the
    // dominant per-press cost during glissandos and chord spam — with zero
    // visual change.
    const wantGlowPieces = (typeof keyGlowEnabled !== 'undefined') && keyGlowEnabled;
    if(black){
        const wIdx = whiteIndexMap.get(midi - 1);
        if(wIdx === undefined) return;
        const left = getBlackKeyLeftPx(wIdx);
        pieces.push(appendActiveKeyPiece('active-key-piece active-key-black', left, bw));
        if(wantGlowPieces){
            const lightPad = Math.max(3, bw * 0.34);
            pieces.push(appendActiveKeyPiece('active-key-light active-key-black-light', left - lightPad, bw + lightPad * 2));
        }
    } else {
        const wIdx = whiteIndexMap.get(midi);
        if(wIdx === undefined) return;
        const left = getWhiteKeyLeftPx(wIdx);
        const width = getWhiteKeyWidthPx(wIdx);
        const right = left + width;
        const leftBlack = getBlackKeyBoundsForWhiteIndex(wIdx - 1);
        const rightBlack = getBlackKeyBoundsForWhiteIndex(wIdx);
        const topLeft = leftBlack ? Math.max(left, leftBlack.right) : left;
        const topRight = rightBlack ? Math.min(right, rightBlack.left) : right;
        const topWidth = Math.max(0, topRight - topLeft);
        const leftCut = Math.max(0, topLeft - left);
        const rightCut = Math.max(0, right - topRight);
        const taperLeft = leftCut > 0 ? leftCut * 0.78 : 0;
        const taperRight = rightCut > 0 ? rightCut * 0.78 : 0;
        const taperDepthPct = (taperLeft || taperRight) ? 18 : 0;
        if(topWidth > 0) pieces.push(appendActiveKeyPiece('active-key-piece active-key-white-top', topLeft, topWidth));
        if(topWidth > 0 && wantGlowPieces) pieces.push(appendActiveKeyPiece('active-key-light active-key-white-light', topLeft, topWidth));
        if(wantGlowPieces) pieces.push(appendActiveKeyPiece('active-key-glow-shell active-key-white-bottom-glow', left, width));
        pieces.push(appendActiveKeyPiece('active-key-piece active-key-white-bottom', left, width, {
            whiteBottomTaper: taperLeft > 0 || taperRight > 0,
            leftCutPx: taperLeft,
            rightCutPx: taperRight,
            taperDepthPct
        }));
    }
    // Apply per-player color override to overlay pieces
    if(color){
        pieces.forEach(piece => {
            piece.style.setProperty('--accent-white', color);
            piece.style.setProperty('--accent-black', color);
        });
    }
    activeKeyOverlayMap.set(midi, pieces);
}
function setActiveKeyOverlay(keyEl, active, color){
    if(!keyEl) return;
    const midi = Number(keyEl.dataset.note);
    if(!Number.isFinite(midi)) return;
    if(active){
        if(shouldUseLightKeyVisual()){
            activeOverlayNotes.delete(midi);
            clearActiveKeyOverlay(midi);
            return;
        }
        activeOverlayNotes.add(midi);
        renderActiveKeyOverlay(midi, keyEl, color);
    } else {
        activeOverlayNotes.delete(midi);
        clearActiveKeyOverlay(midi);
    }
}
function refreshActiveKeyLayerGeometry(){
    if(!activeKeyLayer) return;
    const totalWhiteWidth = getPianoTotalWidthPx();
    activeKeyLayer.style.width = formatLayoutPx(totalWhiteWidth);
    syncActiveKeyLayerTransform(currentPianoTransformPx || 0);
    const notes = Array.from(activeOverlayNotes);
    activeKeyLayer.innerHTML = '';
    activeKeyOverlayMap.clear();
    // innerHTML wipe also detached every pooled piece — drop the stale pool so
    // acquire rebuilds fresh, attached elements.
    _overlayFreePool.length = 0;
    notes.forEach(midi => {
        const color = _resolveKeyColor(midi);
        renderActiveKeyOverlay(midi, noteElementMap.get(midi), color);
    });
}

function buildDOM() {
    const vpW = getPianoViewportWidth();
    if(vpW === 0) { setTimeout(buildDOM, 50); return; }
    syncWhiteKeyGeometry(vpW);
    clampOffset();

    const frag = document.createDocumentFragment();
    whiteKeyEls = [];
    blackKeyEls = [];
    noteElementMap.clear();

    const totalWhiteWidth = getPianoTotalWidthPx();
    const bw = getBlackKeyWidthPx();

    ALL_WHITE.forEach((n,i) => {
        const k = document.createElement('div'); k.className='white note-tone-' + (n % 12); k.dataset.note=n;
        const wPx = getWhiteKeyWidthPx(i);
        k.style.cssText = `left:${formatLayoutPx(getWhiteKeyLeftPx(i))};width:${formatLayoutPx(wPx)};`;
        const lbl = document.createElement('div'); lbl.className='key-label';
        lbl.innerHTML = getNoteLabel(n, labelMode);
        updateKeyLabelStyle(lbl, labelMode, false);
        k.appendChild(lbl);
        whiteKeyEls.push(k);
        noteElementMap.set(n, k);
        frag.appendChild(k);
    });

    pianoSeparatorLayer = document.createElement('div');
    pianoSeparatorLayer.id = 'pianoSeparatorLayer';
    frag.appendChild(pianoSeparatorLayer);
    renderPianoSeparators();

    ALL_WHITE.forEach((n,i) => {
        const nextMidi = n+1;
        if(isBlack(nextMidi) && i < ALL_WHITE.length-1){
            const b = document.createElement('div'); b.className='black note-tone-' + (nextMidi % 12); b.dataset.note=nextMidi;
            const left = getBlackKeyLeftPx(i);
            b.style.cssText = `width:${formatLayoutPx(bw)};left:${formatLayoutPx(left)};`;
            const bLbl = document.createElement('div'); bLbl.className='black-label';
            bLbl.innerHTML = getNoteLabel(nextMidi, labelMode);
            updateKeyLabelStyle(bLbl, labelMode, true);
            b.appendChild(bLbl);
            blackKeyEls.push(b);
            noteElementMap.set(nextMidi, b);
            frag.appendChild(b);
        }
    });

    pianoEl.style.width = formatLayoutPx(totalWhiteWidth);
    const offsetPx = getViewOffsetPx(viewOffset);
    pianoEl.style.transition = 'none';
    pianoEl.style.transform = `translate3d(-${offsetPx}px,0,0)`;
    currentPianoTransformPx = offsetPx;
    noteCacheTransformPx = offsetPx;
    syncActiveKeyLayerTransform(offsetPx);
    pianoEl.style.left = '0px';
    pianoEl.innerHTML = '';
    pianoEl.appendChild(frag);
    refreshActiveKeyLayerGeometry();

    refreshKeyPresetUI();
    refreshWideKeyModeClass();
    requestAnimationFrame(updateNoteXCache);
}

let layoutRaf = null;
function updateKeyLayout() {
    if(layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
        layoutRaf = null;
        clampOffset();
        const vpW = getPianoViewportWidth();
        if(vpW === 0) return;

        if(pianoEl.children.length === 0){ buildDOM(); return; }

        syncWhiteKeyGeometry(vpW);
        clampOffset();
        const totalWhiteWidth = getPianoTotalWidthPx();
        const bw = getBlackKeyWidthPx();

        pianoEl.style.width = formatLayoutPx(totalWhiteWidth);
        renderPianoSeparators();

        for(let i=0; i<whiteKeyEls.length; i++){
            const wPx = getWhiteKeyWidthPx(i);
            whiteKeyEls[i].style.left = formatLayoutPx(getWhiteKeyLeftPx(i));
            whiteKeyEls[i].style.width = formatLayoutPx(wPx);
            const lbl = whiteKeyEls[i].firstChild;
            if(lbl) updateKeyLabelStyle(lbl, labelMode, false);
        }
        for(let i=0; i<blackKeyEls.length; i++){
            const b = blackKeyEls[i];
            const midi = parseInt(b.dataset.note);
            const wIdx = whiteIndexMap.get(midi - 1);
            if(wIdx !== undefined){
                b.style.width = formatLayoutPx(bw);
                b.style.left = formatLayoutPx(getBlackKeyLeftPx(wIdx));
            }
            const lbl = b.firstChild;
            if(lbl) updateKeyLabelStyle(lbl, labelMode, true);
        }

        const offsetPx = getViewOffsetPx(viewOffset);
        pianoEl.style.transition = 'none';
        pianoEl.style.transform = `translate3d(-${offsetPx}px,0,0)`;
        currentPianoTransformPx = offsetPx;
        noteCacheTransformPx = offsetPx;
        syncActiveKeyLayerTransform(offsetPx);
        pianoEl.style.left = '0px';
        refreshActiveKeyLayerGeometry();

        refreshKeyPresetUI();
        refreshWideKeyModeClass();
        invalidateWrapRect();
        updateNoteXCache();
    });
}

function build() {
    clampOffset();
    const vpW = getPianoViewportWidth();
    if(vpW === 0) { setTimeout(build, 50); return; }
    buildDOM();
}

function setLabelMode(mode) {
    labelMode = mode;
    document.querySelectorAll('.label-option-vertical').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === mode);
    });
    if (whiteKeyEls && whiteKeyEls.length > 0) {
        for (let i = 0; i < whiteKeyEls.length; i++) {
            const k = whiteKeyEls[i];
            const lbl = k.firstChild;
            if (lbl) {
                lbl.innerHTML = getNoteLabel(parseInt(k.dataset.note), labelMode);
                updateKeyLabelStyle(lbl, labelMode, false);
            }
        }
        for (let i = 0; i < blackKeyEls.length; i++) {
            const k = blackKeyEls[i];
            const lbl = k.firstChild;
            if (lbl) {
                lbl.innerHTML = getNoteLabel(parseInt(k.dataset.note), labelMode);
                updateKeyLabelStyle(lbl, labelMode, true);
            }
        }
    }
}

document.querySelectorAll('.label-selector-vertical').forEach(selector => {
    selector.addEventListener('click', (ev) => {
        const opt = ev.target.closest('.label-option-vertical');
        if(opt && selector.contains(opt)) setLabelMode(opt.dataset.mode);
    });
});

function setPianoTheme(theme) {
    pianoTheme = (theme === 'child') ? 'child' : 'default';
    document.body.classList.toggle('theme-child', pianoTheme === 'child');
    const btnDefault = document.getElementById('themeDefault');
    const btnChild = document.getElementById('themeChild');
    if (btnDefault) btnDefault.classList.toggle('active', pianoTheme === 'default');
    if (btnChild) btnChild.classList.toggle('active', pianoTheme === 'child');
}
document.getElementById('themeDefault')?.addEventListener('click', () => setPianoTheme('default'));
document.getElementById('themeChild')?.addEventListener('click', () => setPianoTheme('child'));

function invalidateWrapRect() { cachedWrapRect = null; }

function updateKeyHitCache(){
    if(!whiteKeyWidth) return;
    const wrap = document.getElementById('pianoWrap');
    if(!wrap) return;
    if (!cachedWrapRect) cachedWrapRect = wrap.getBoundingClientRect();
    const r = cachedWrapRect;
    const blackW = getBlackKeyWidthPx();
    const blackBottom = (r.bottom - r.top) * (blackKeyHeightPercent / 100);
    const blackByBoundary = [];
    for(let i=0; i<BLACK_META.length; i++){
        const meta = BLACK_META[i];
        const boundary = meta.whiteIndex + 1;
        const left = getBlackKeyLeftPx(meta.whiteIndex);
        blackByBoundary[boundary] = { midi: meta.midi, left, right: left + blackW, bottom: blackBottom, el: noteElementMap.get(meta.midi) };
    }
    keyHitCache.wrapLeft = r.left;
    keyHitCache.wrapTop = r.top;
    keyHitCache.wrapBottom = r.bottom;
    keyHitCache.wrapHeight = r.bottom - r.top;
    keyHitCache.totalWidth = getPianoTotalWidthPx();
    keyHitCache.blackBottom = blackBottom;
    keyHitCache.blackByBoundary = blackByBoundary;
    keyHitCache.whiteEls = keyElFast && keyElFast.length ? keyElFast : [];
}
function updateNoteXCache(){
    if(!whiteKeyWidth) return;
    const newX = new Map();
    const newEl = new Map();
    const nextXFast = new Float32Array(128);
    nextXFast.fill(NaN);
    const nextElFast = new Array(128);
    for(let i=0; i<ALL_WHITE.length; i++){
        const midi = ALL_WHITE[i];
        const x = getWhiteKeyLeftPx(i) + getWhiteKeyWidthPx(i) / 2;
        newX.set(midi, x);
        nextXFast[midi] = x;
    }
    for(let i=0; i<BLACK_META.length; i++){
        const meta = BLACK_META[i];
        const x = getBlackKeyLeftPx(meta.whiteIndex) + getBlackKeyWidthPx() / 2;
        newX.set(meta.midi, x);
        nextXFast[meta.midi] = x;
    }
    for(let i=0; i<whiteKeyEls.length; i++){
        const n = parseInt(whiteKeyEls[i].dataset.note);
        if(!isNaN(n)){ newEl.set(n, whiteKeyEls[i]); nextElFast[n] = whiteKeyEls[i]; }
    }
    for(let i=0; i<blackKeyEls.length; i++){
        const n = parseInt(blackKeyEls[i].dataset.note);
        if(!isNaN(n)){ newEl.set(n, blackKeyEls[i]); nextElFast[n] = blackKeyEls[i]; }
    }
    noteXCache.clear(); for(const [k,v] of newX) noteXCache.set(k,v);
    keyElCache.clear(); for(const [k,v] of newEl) keyElCache.set(k,v);
    noteXFast.set(nextXFast);
    for(let i=0; i<nextElFast.length; i++) keyElFast[i] = nextElFast[i] || null;
    noteCacheTransformPx = 0;
    updateKeyHitCache();
}
const noteXCache=new Map();
const keyElCache=new Map();
const noteXFast = new Float32Array(128);
noteXFast.fill(NaN);
const keyElFast = new Array(128);
let currentPianoTransformPx = viewOffset * whiteKeyWidth;
let noteCacheTransformPx = viewOffset * whiteKeyWidth;
// No device sniffing: the default tier is always Default. Potato is a manual choice.
function _detectDefaultGraphicQuality(){ return 'default'; }
let graphicQuality = _detectDefaultGraphicQuality();
let performanceMode = 'manual';
function isMobileRenderTarget(){
    try {
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const ua = (navigator.userAgent || '').toLowerCase();
        return coarse || /android|iphone|ipad|ipod|mobile|webview/i.test(ua);
    } catch(e) { return false; }
}
// Memoised once — the form factor never changes within a session, and this is
// read on hot paths (governor, particle spawn, DPR). The Default tier auto-adapts
// to hold 60fps ONLY on mobile; on desktop it stays fully uncapped.
let _isMobileTargetCache = null;
function isMobileTargetMemo(){
    if(_isMobileTargetCache === null) _isMobileTargetCache = isMobileRenderTarget();
    return _isMobileTargetCache;
}
function getEffectiveGraphicQuality(){
    return graphicQuality;
}
function getPerfPressureLevel(){
    if(perfGovScale < 0.66) return 3;
    if(perfGovScale < 0.76) return 2;
    if(perfGovScale < 0.86) return 1;
    return 0;
}
function getPressureScale(){
    const pressure = getPerfPressureLevel();
    return pressure >= 3 ? 0.34 : pressure === 2 ? 0.56 : pressure === 1 ? 0.78 : 1;
}
const GRAPHIC_PROFILES = {
    potato: { dust:0, dustMax:0, fallingMax:260, heavyFx:false, fallingLabel:false, shadow:0, burstDust:false },
    medium: { dust:0.55, dustMax:800, fallingMax:520, heavyFx:true, fallingLabel:false, shadow:0.35, burstDust:false },
    high: { dust:1, dustMax:2000, fallingMax:900, heavyFx:true, fallingLabel:true, shadow:1, burstDust:true },
    // Default tier — no limits: caps lifted to the full buffer so particles, draw
    // counts and DPR are never throttled. (governor is disabled for 'default'.)
    default: { dust:1, dustMax:16000, fallingMax:100000, heavyFx:true, fallingLabel:true, shadow:1, burstDust:true }
};
const GRAPHIC_MODE_DEFAULTS = {
    // Potato and Default share IDENTICAL setting percentages so presets never shift
    // values between tiers; the only difference is Potato keeps heavy FX (dust) off.
    potato: { dust:false, particleCount:20, particleSize:20, particleOpacity:100, particleSpeed:40, particleTurbulence:46, particleSaturation:100, particleFade:20, saberAuraSize:62, saberBrightness:84, saberOpacity:100, saberSaturation:100 },
    medium: { dust:true, particleCount:20, particleSize:20, particleOpacity:100, particleSpeed:40, particleTurbulence:46, particleSaturation:100, particleFade:20, saberAuraSize:62, saberBrightness:84, saberOpacity:100, saberSaturation:100 },
    high: { dust:true, particleCount:20, particleSize:20, particleOpacity:100, particleSpeed:40, particleTurbulence:46, particleSaturation:100, particleFade:20, saberAuraSize:62, saberBrightness:84, saberOpacity:100, saberSaturation:100 },
    default: { dust:true, particleCount:20, particleSize:20, particleOpacity:100, particleSpeed:40, particleTurbulence:46, particleSaturation:100, particleFade:20, saberAuraSize:62, saberBrightness:84, saberOpacity:100, saberSaturation:100 }
};
const REMOTE_VISUAL_PROFILES = {
    potato: { level:'light' },
    medium: { level:'light' },
    high: { level:'full' },
    default: { level:'full' }
};
function getRemoteVisualLevel(){
    const q = getEffectiveGraphicQuality();
    const base = (REMOTE_VISUAL_PROFILES[q] || REMOTE_VISUAL_PROFILES.medium).level;
    const pressure = getPerfPressureLevel();
    if(base === 'full' && pressure >= 2) return 'light';
    return base === 'full' ? 'full' : 'light';
}
function remoteFallingOwnerId(playerId){ return `remote:${playerId || 'unknown'}`; }
function getGraphicProfile(){ const q=getEffectiveGraphicQuality(); return GRAPHIC_PROFILES[q] || GRAPHIC_PROFILES.high; }
function isLowGraphic(){ return getEffectiveGraphicQuality() === 'potato'; }
function isWideKeyMode(){ return wCount > 12; }
function refreshWideKeyModeClass(){
    document.body.classList.toggle('wide-key-mode', isWideKeyMode());
}
let inputBurstScore = 0;
let lastInputBurstAt = 0;
let inputBurstFrame = 0;
let inputBurstFrameCount = 0;
let inputBurstVisualTimer = null;
function updateInputBurstVisualMode(burst){
    const pressure = getPerfPressureLevel();
    if(pressure === 0 || (burst < 10 && inputBurstFrameCount < 7)) return;
    document.body.classList.add('input-burst-mode');
    if(inputBurstVisualTimer) clearTimeout(inputBurstVisualTimer);
    inputBurstVisualTimer = setTimeout(() => {
        inputBurstVisualTimer = null;
        document.body.classList.remove('input-burst-mode');
    }, 240);
}
function markInputBurst(){
    const now = performance.now();
    const frame = Math.floor(now / 16.7);
    inputBurstFrameCount = (frame === inputBurstFrame) ? Math.min(24, inputBurstFrameCount + 1) : 1;
    inputBurstFrame = frame;
    inputBurstScore = (now - lastInputBurstAt < 90) ? Math.min(18, inputBurstScore + 1 + (inputBurstFrameCount > 4 ? 1 : 0)) : 1;
    lastInputBurstAt = now;
    updateInputBurstVisualMode(inputBurstScore);
    return inputBurstScore;
}
function getBurstLevel(){
    const now = performance.now();
    if(now - lastInputBurstAt > 220) inputBurstScore = Math.max(0, inputBurstScore - 2);
    return inputBurstScore;
}
const fallingByMidi = new Map();
function registerFallingNote(f){
    let list = fallingByMidi.get(f.midi);
    if(!list){ list = []; fallingByMidi.set(f.midi, list); }
    list.push(f);
}
function markFallingReleased(midi, ownerId){
    const list = fallingByMidi.get(midi);
    if(!list || !list.length) return;
    const scoped = arguments.length > 1;
    const targetOwner = scoped ? String(ownerId || '') : '';
    let target = null;
    let targetIndex = -1;
    let w = 0;
    for(let i=0;i<list.length;i++){
        const f = list[i];
        if(!f || f.dead) continue;
        const fOwner = f.ownerId == null ? '' : String(f.ownerId);
        if(f.growing && fOwner === targetOwner){
            target = f;
            targetIndex = w;
        }
        list[w++] = f;
    }
    list.length = w;
    if(target) target.growing = false;
    if(targetIndex >= 0 && targetIndex < list.length){
        const item = list[targetIndex];
        list.splice(targetIndex, 1);
        list.push(item);
    }
    if(!list.length) fallingByMidi.delete(midi);
}
function unregisterDeadFalling(){
    if(!fallingByMidi.size) return;
    fallingByMidi.forEach((list, midi) => {
        let w = 0;
        for(let i=0;i<list.length;i++){
            const f = list[i];
            if(f && !f.dead) list[w++] = f;
        }
        list.length = w;
        if(!w) fallingByMidi.delete(midi);
    });
}
const _dustSpriteCache = new Map();
function _parseColorToRgb(color){
    color = (color || '').trim();
    if(color.startsWith('#')){
        try { return hexToRgb(color); } catch(e){ return [120, 220, 255]; }
    }
    const m = color.match(/rgba?\(([^)]+)\)/i);
    if(m){
        const parts = m[1].split(',').map(p => parseFloat(p.trim()));
        return [parts[0]|0, parts[1]|0, parts[2]|0];
    }
    return [120, 220, 255];
}
function getDustSprite(color){
    const dpr = currentDPR || 1;
    const cacheKey = color + '@' + (Math.round(dpr * 100) | 0);
    if(_dustSpriteCache.has(cacheKey)) return _dustSpriteCache.get(cacheKey);
    const SIZE = 192;
    const physSize = Math.max(1, Math.round(SIZE * dpr));
    const cv = document.createElement('canvas');
    cv.width = physSize; cv.height = physSize;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    if(dpr !== 1) c.scale(dpr, dpr);
    const cx = SIZE/2, cy = SIZE/2;
    const rgb = _parseColorToRgb(color);
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, SIZE/2);
    // A tiny FLAT dot in the dust colour — solid to ~0.6 radius then a 1px-ish
    // antialiased edge, so scaled down it reads as a small plain speck.
    grad.addColorStop(0,    `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.6,  `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.82, `rgba(${r},${g},${b},0.65)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, SIZE, SIZE);
    _dustSpriteCache.set(cacheKey, cv);
    return cv;
}


function refreshKeyDustColorCache(){
    const css = getComputedStyle(document.documentElement);
    cachedDustWhite = css.getPropertyValue('--accent-white').trim() || css.getPropertyValue('--piano-white-active-mid').trim() || '#70d8ff';
    cachedDustBlack = css.getPropertyValue('--accent-black').trim() || css.getPropertyValue('--piano-black-active-mid').trim() || '#ff7f66';
    _dustSpriteCache.clear();
}
// Chord detection is throttled on a wall-clock timer (leading + trailing edge)
// rather than coalesced into requestAnimationFrame. rAF coupling meant that at
// fast tempo / under heavy render load the frames stretch past 16ms and the
// chord readout visibly lagged the keys. A time throttle decouples detection
// from render load: it fires immediately on the first event, then at most once
// per CHORD_MIN_INTERVAL ms, with a trailing run so the final held set is
// always reflected. matchChords iterates ~100 cheap bitmask patterns, so ~36
// detections/sec is negligible even during glissandos.
const CHORD_MIN_INTERVAL = 28;
let _chordLastRun = 0;
let _chordTrailingTimer = 0;
function _runChordDetect(){
    _chordLastRun = performance.now();
    try { window.PapianoMultiplayer._detectChords(); } catch(_){}
}
function requestChordUpdate(){
    if(!(window.PapianoMultiplayer && typeof window.PapianoMultiplayer._detectChords === 'function')) return;
    // Back off chord matching during bursts: a glissando fires note events far
    // faster than a chord can change, so running matchChords every 28ms there is
    // wasted work. A longer interval while bursting keeps the heavy detection
    // off the hot path; normal playing stays responsive.
    const interval = (typeof getBurstLevel === 'function' && getBurstLevel() > 8) ? 90 : CHORD_MIN_INTERVAL;
    const since = performance.now() - _chordLastRun;
    if(since >= interval){
        if(_chordTrailingTimer){ clearTimeout(_chordTrailingTimer); _chordTrailingTimer = 0; }
        _runChordDetect();
    } else if(!_chordTrailingTimer){
        _chordTrailingTimer = setTimeout(() => {
            _chordTrailingTimer = 0;
            _runChordDetect();
        }, Math.max(1, interval - since));
    }
}

const pendingActiveRemoves = new Set();
const keyVisualDesired = new WeakMap();
let keyVisualRaf = null;

// === Per-player key color tracking (overlay only — does NOT affect activation logic) ===
const _KEY_SELF = '__self__';
const _keyColorMap = new Map(); // midi → Map<holderId, color>
let _mpSelfSeatColor = ''; // updated by initPapianoOnline when self seat is set

function _applyKeyColor(el, color){
    if(!el) return;
    if(color){
        el.style.setProperty('--accent-white', color);
        el.style.setProperty('--accent-black', color);
    } else {
        el.style.removeProperty('--accent-white');
        el.style.removeProperty('--accent-black');
    }
}

function _resolveKeyColor(midi){
    const holders = _keyColorMap.get(midi);
    if(!holders || holders.size === 0) return '';
    let color = '';
    holders.forEach(c => { if(c) color = c; });
    return color;
}

function _trackKeyColor(midi, holderId, color, el){
    // Offline / no custom color — nothing to track. Avoids per-press Map
    // allocation during heavy passages where _mpSelfSeatColor is empty.
    if(!color){
        const existing = _keyColorMap.get(midi);
        if(existing && existing.has(holderId)){
            existing.delete(holderId);
            if(existing.size === 0) _keyColorMap.delete(midi);
            if(el) _applyKeyColor(el, _resolveKeyColor(midi));
        }
        return;
    }
    let holders = _keyColorMap.get(midi);
    if(!holders){ holders = new Map(); _keyColorMap.set(midi, holders); }
    holders.set(holderId, color);
    if(el) _applyKeyColor(el, _resolveKeyColor(midi));
}

function _untrackKeyColor(midi, holderId, el){
    const holders = _keyColorMap.get(midi);
    if(!holders) return;
    holders.delete(holderId);
    if(holders.size === 0){
        _keyColorMap.delete(midi);
        if(el) _applyKeyColor(el, '');
    } else {
        if(el) _applyKeyColor(el, _resolveKeyColor(midi));
    }
}

function scheduleKeyVisual(el, active){
    if(!el || !el.classList) return;
    if(keyVisualDesired.get(el) === active) return;
    keyVisualDesired.set(el, active);
    if(active){
        // Apply press immediately — no rAF delay for key-down
        pendingActiveRemoves.delete(el);
        if(!el.classList.contains('active')) el.classList.add('active');
        const m = Number(el.dataset.note);
        const color = Number.isFinite(m) ? _resolveKeyColor(m) : '';
        _applyKeyColor(el, color);
        setActiveKeyOverlay(el, true, color);
        return;
    }
    pendingActiveRemoves.add(el);
    if(keyVisualRaf) return;
    keyVisualRaf = requestAnimationFrame(() => {
        keyVisualRaf = null;
        pendingActiveRemoves.forEach(x => {
            if(keyVisualDesired.get(x) === false){
                if(x.classList.contains('active')) x.classList.remove('active');
                _applyKeyColor(x, '');
                setActiveKeyOverlay(x, false);
            }
        });
        pendingActiveRemoves.clear();
    });
}
function playPressVisual(n,k,burst){
    if(Number.isFinite(n)) _trackKeyColor(n, _KEY_SELF, selfSeatKeyColor(), k);
    scheduleKeyVisual(k, true);
    startNeonDust(n, k);
    pressStartTimes.set(n,performance.now());
    if(isAnimOn) addAnim(n);
    requestChordUpdate();
}
function playReleaseVisual(n,k){
    scheduleKeyVisual(k, false);
    if(Number.isFinite(n)) _untrackKeyColor(n, _KEY_SELF, k);
    stopNeonDust(n);
    pressStartTimes.delete(n);
    markFallingReleased(n);
    requestChordUpdate();
}
function pressWithVelocity(n,k,vel){
    if(!isPianoInputAllowed()) return;
    if(window.__mpActivity) window.__mpActivity();
    const burst = markInputBurst();
    if(audioCtx.state==='suspended') audioCtx.resume();
    playNote(n,transpose,vel);
    playPressVisual(n,k,burst);
    if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendNoteOn === 'function') window.PapianoMultiplayer.sendNoteOn(n, vel);
}
function press(n,k){ pressWithVelocity(n,k,0.8); }
function release(n,k){
    if(!document.body.classList.contains('mp-room-active')) return;
    markInputBurst();
    stopNote(n);
    playReleaseVisual(n,k);
    if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendNoteOff === 'function') window.PapianoMultiplayer.sendNoteOff(n);
}
let keyDustIntensity = 3;
let cachedStageHeight = 0;
let _cachedStageEl = null;
let _cachedStageRect = null;
function invalidateStageGeom(){ _cachedStageEl = null; _cachedStageRect = null; }
function refreshStageHeight(){
    const s=document.querySelector('.stage');
    if(s){
        const r = s.getBoundingClientRect();
        cachedStageHeight = Math.max(1, Math.round(r.height || s.clientHeight || s.offsetHeight || canvasCssH || 1));
        _cachedStageEl = s;
        _cachedStageRect = r;
    } else if(canvasCssH) {
        cachedStageHeight = canvasCssH;
        _cachedStageEl = null;
        _cachedStageRect = null;
    }
}

// Default tier has no particle cap — give the shared pool real headroom so
// the Default ceiling never feels limited. Potato stays capped by profile.dustMax
// (800 / 2000), so this larger buffer never affects them.
const NEON_DUST_MAX = 16000;
// Mobile Default bounds the live pool: the WebGL draw is cheap regardless, but
// the per-grain physics + buffer upload still cost CPU, so cap the simulation.
const MOBILE_DUST_CAP = 3000;
// Even, hold-independent emission: same initial puff per press, same steady
// trickle while held. Density never escalates with hold time.
const DUST_PRESS_BURST = 20;
const DUST_EMIT_INTERVAL = 60; // ms between trickle spawns while held
const DUST_EMIT_COUNT = 6;     // particles per trickle
const neonDustX = new Float32Array(NEON_DUST_MAX);
const neonDustY = new Float32Array(NEON_DUST_MAX);
const neonDustVX = new Float32Array(NEON_DUST_MAX);
const neonDustVY = new Float32Array(NEON_DUST_MAX);
const neonDustR = new Float32Array(NEON_DUST_MAX);
const neonDustA = new Float32Array(NEON_DUST_MAX);
const neonDustLife = new Float32Array(NEON_DUST_MAX);
const neonDustAge = new Float32Array(NEON_DUST_MAX);
const neonDustSeedA = new Float32Array(NEON_DUST_MAX);
const neonDustSeedB = new Float32Array(NEON_DUST_MAX);
const neonDustSpin = new Float32Array(NEON_DUST_MAX);
const neonDustAnchorX = new Float32Array(NEON_DUST_MAX);
let neonDustCount = 0;
let dustBlendMode = 'glow';
let keyGlowEnabled = false;
let keyGlowIntensity = 50;
let _dustSprite = null, _dustSpriteKey = '';
const neonDustEmitters = new Map();

// ---------------------------------------------------------------------------
// WebGL particle layer
// ---------------------------------------------------------------------------
// Canvas-2D draws each dust grain with its own drawImage + globalAlpha write.
// Under a glissando that is ~1,350 serialized draw calls per frame — the single
// biggest cost on the Default tier. This renderer packs every live grain into
// one vertex buffer and draws them all as GL point-sprites in ONE draw call,
// with the dust colour as a uniform and a soft radial dot computed in the
// fragment shader (no texture, no overdraw waste). Falls back to the 2D path
// (below) when WebGL is unavailable, so there is no hard regression.
const glCanvas = document.getElementById('fxParticles');
let glParticles = null;            // renderer handle, or null if WebGL is unavailable
let _glColorR = 0, _glColorG = 0.9, _glColorB = 1; // cached normalized dust colour
function initGlParticles(){
    if(!glCanvas || typeof WebGLRenderingContext === 'undefined') return null;
    let gl = null;
    const opts = { alpha:true, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false };
    try { gl = glCanvas.getContext('webgl', opts) || glCanvas.getContext('experimental-webgl', opts); }
    catch(e){ gl = null; }
    if(!gl) return null;
    const vsSrc =
        'attribute vec2 aPos;' +          // position in CSS px (stage space)
        'attribute float aSize;' +        // diameter in CSS px
        'attribute float aAlpha;' +
        'uniform vec2 uStage;' +          // stage css width,height
        'uniform float uDpr;' +
        'varying float vAlpha;' +
        'void main(){' +
        '  vAlpha = aAlpha;' +
        '  float cx = (aPos.x / uStage.x) * 2.0 - 1.0;' +
        '  float cy = 1.0 - (aPos.y / uStage.y) * 2.0;' +
        '  gl_Position = vec4(cx, cy, 0.0, 1.0);' +
        '  gl_PointSize = max(1.0, aSize * uDpr);' +
        '}';
    const fsSrc =
        'precision mediump float;' +
        'uniform vec3 uColor;' +
        'varying float vAlpha;' +
        'void main(){' +
        '  vec2 d = gl_PointCoord - vec2(0.5);' +
        '  float dist = length(d) * 2.0;' +          // 0 at centre, 1 at edge
        '  float a = 1.0 - smoothstep(0.6, 1.0, dist);' + // flat dot, soft 1px edge
        '  float alpha = vAlpha * a;' +
        '  if(alpha <= 0.0) discard;' +
        '  gl_FragColor = vec4(uColor * alpha, alpha);' + // premultiplied output
        '}';
    function compile(type, src){
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ gl.deleteShader(s); return null; }
        return s;
    }
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if(!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ return null; }
    gl.useProgram(prog);
    const loc = {
        aPos:   gl.getAttribLocation(prog, 'aPos'),
        aSize:  gl.getAttribLocation(prog, 'aSize'),
        aAlpha: gl.getAttribLocation(prog, 'aAlpha'),
        uStage: gl.getUniformLocation(prog, 'uStage'),
        uDpr:   gl.getUniformLocation(prog, 'uDpr'),
        uColor: gl.getUniformLocation(prog, 'uColor')
    };
    const STRIDE = 4; // floats per particle: x, y, size, alpha
    const packed = new Float32Array(NEON_DUST_MAX * STRIDE);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, packed.byteLength, gl.DYNAMIC_DRAW);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Fragment outputs premultiplied colour, so accumulate premultiplied.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    return { gl, prog, loc, buf, packed, STRIDE };
}
function glResizeParticles(physW, physH){
    if(!glParticles || !glCanvas) return;
    if(glCanvas.width !== physW) glCanvas.width = physW;
    if(glCanvas.height !== physH) glCanvas.height = physH;
    glParticles.gl.viewport(0, 0, physW, physH);
}
// Recomputes per-grain alpha exactly like the 2D draw loop, packs the live
// grains and issues a single point-sprite draw. Called once per frame from the
// dust update after physics have advanced.
function renderGlParticles(){
    const r = glParticles;
    if(!r) return;
    const gl = r.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    const packed = r.packed, STRIDE = r.STRIDE;
    let n = 0;
    for(let i=0;i<neonDustCount;i++){
        const tLife = neonDustLife[i] > 0 ? neonDustAge[i] / neonDustLife[i] : 1;
        const t = tLife;
        const fade = t < 0.14 ? t / 0.14 : Math.max(0, 1 - Math.pow((t - 0.14) / 0.86, 1.9));
        const alpha = Math.min(1, neonDustA[i] * fade * 1.4);
        if(alpha <= 0.02) continue;
        const sz = Math.max(1.5, neonDustR[i] * 0.5);
        const o = n * STRIDE;
        packed[o] = neonDustX[i];
        packed[o + 1] = neonDustY[i];
        packed[o + 2] = sz;
        packed[o + 3] = alpha;
        n++;
    }
    if(n === 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, r.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed.subarray(0, n * STRIDE));
    const stride = STRIDE * 4;
    gl.enableVertexAttribArray(r.loc.aPos);
    gl.vertexAttribPointer(r.loc.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(r.loc.aSize);
    gl.vertexAttribPointer(r.loc.aSize, 1, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(r.loc.aAlpha);
    gl.vertexAttribPointer(r.loc.aAlpha, 1, gl.FLOAT, false, stride, 12);
    gl.uniform2f(r.loc.uStage, canvasCssW || 1, canvasCssH || 1);
    gl.uniform1f(r.loc.uDpr, currentDPR || 1);
    gl.uniform3f(r.loc.uColor, _glColorR, _glColorG, _glColorB);
    gl.drawArrays(gl.POINTS, 0, n);
}
function clearGlParticles(){
    if(glParticles) glParticles.gl.clear(glParticles.gl.COLOR_BUFFER_BIT);
}
try { glParticles = initGlParticles(); } catch(e){ glParticles = null; }

function getKeyStageGeom(midi){

    if(midi == null || !whiteKeyWidth) return null;
    const centerX = noteXFast[midi];
    if(!Number.isFinite(centerX)) return null;
    const black = isBlack(midi);
    const wIdx = black ? -1 : whiteIndexMap.get(midi);
    const w = black ? getBlackKeyWidthPx() : getWhiteKeyWidthPx(wIdx);
    return {
        x: centerX - currentPianoTransformPx - w * 0.5,
        w: w,
        isBlack: black
    };
}
function spawnNeonDust(geom, count){
    if(!saberDustEnabled || !geom || !canvas) return;
    const profile = getGraphicProfile();
    const _defaultTier = getEffectiveGraphicQuality() === 'default';
    const _autoAdapt = _defaultTier && isMobileTargetMemo();
    // Desktop Default = no particle limit: the governor never trims count or scale,
    // so raising the slider always adds more and density never collapses under load.
    // Mobile Default auto-adapts: count scales down under pressure and the alive
    // pool is bounded so the per-frame simulation/upload cost stays cheap.
    const loadScale = (_defaultTier && !_autoAdapt) ? 1 : getPressureScale();
    let maxDust = Math.max(0, Math.min(Math.round(NEON_DUST_MAX * loadScale), Number(profile.dustMax) || 0));
    if(_autoAdapt) maxDust = Math.min(maxDust, MOBILE_DUST_CAP);
    const dustScale = Math.max(0, Math.min(1, (Number(profile.dust) || 0) * loadScale));
    if(dustScale <= 0 || neonDustCount >= maxDust) return;
    const stageH = cachedStageHeight || knownStageH || canvasCssH || window.innerHeight * 0.6;
    const countLevel = sliderCurve(particleCount, 1.04);
    const sizeLevel = sliderCurve(particleSize, 1.08);
    const opacityLevel = sliderCurve(particleOpacity, 1.08);
    const speedLevel = sliderRatio(particleSpeed);
    const turbulenceLevel = sliderCurve(particleTurbulence, 1.05);
    if(countLevel <= 0.005 || opacityLevel <= 0.005 || sizeLevel <= 0.005) return;
    // The Default tier renders denser per unit than the (particle-less) Potato fallback.
    const countMul = countLevel * (_defaultTier ? 6 : 12) * dustScale;
    const sizeMul = 0.08 + sizeLevel * (_defaultTier ? 0.78 : 1.56);
    const speedMul = 0.18 + speedLevel * 2.12;
    // Turbulence +100%: doubled influence at max.
    const turbEase = turbulenceLevel * 2;
    const fadeLevel = sliderCurve(particleFade, 1.02);
    const fadeMul = 0.25 + fadeLevel * 2.25;
    const n = Math.min(Math.round(count * countMul), maxDust - neonDustCount);
    if(n <= 0) return;
    const bx = geom.x + geom.w * 0.5;
    const by = stageH - 1;
    // Wider emission base so the column reads as a soft cloud, not a thin line.
    const spread = Math.max(2.0, Math.min(8.0, geom.w * 0.10));
    for(let i=0;i<n;i++){
        const idx = neonDustCount++;
        const localX = bx + (Math.random() - 0.5) * spread;
        const direction = Math.random() < 0.5 ? -1 : 1;
        neonDustX[idx] = localX;
        neonDustY[idx] = by + Math.random() * 2;
        neonDustSeedA[idx] = Math.random() * Math.PI * 2;
        neonDustSeedB[idx] = Math.random() * Math.PI * 2;
        neonDustSpin[idx] = direction;
        neonDustAnchorX[idx] = localX;
        // Gentle lateral start + a soft buoyant rise. The rise decelerates and
        // the puff spreads & expands with age (see draw loop) so it behaves like
        // real smoke rather than a straight jet.
        neonDustVX[idx] = turbEase > 0 ? ((Math.random() - 0.5) * 0.010) * turbEase : 0;
        neonDustVY[idx] = -(0.030 + Math.random() * 0.060) * speedMul;
        neonDustR[idx] = (2.2 + Math.random() * 4.6) * sizeMul;
        neonDustA[idx] = opacityLevel * (0.46 + Math.random() * 0.20);
        neonDustLife[idx] = ((1500 + Math.random() * 1150) / (speedMul * (0.5 + speedLevel * 1.25))) * fadeMul;
        neonDustAge[idx] = 0;
    }
}
function startNeonDust(midi, key){
    if(isLowGraphic() || !saberDustEnabled || midi == null) return;
    const geom = getKeyStageGeom(midi);
    if(!geom) return;

    neonDustEmitters.set(midi, { geom, midi, start: performance.now(), last: 0 });
    // During fast passages (glissando / broken-chord spam) a full 20-particle
    // burst per note floods the field — hundreds of sprites spawned in a beat,
    // all drawn every frame. Shrink the per-press burst when input is bursty so
    // dense playing stays smooth; single/slow notes keep the full puff.
    const burstCount = ((getEffectiveGraphicQuality() !== 'default' || isMobileTargetMemo()) && typeof getBurstLevel === 'function' && getBurstLevel() > 8)
        ? Math.max(4, DUST_PRESS_BURST >> 2)
        : DUST_PRESS_BURST;
    spawnNeonDust(geom, burstCount);
    if(saberLine) saberLine.classList.add('saber-hit');
    ensureAnimLoop();
}
function stopNeonDust(midi){
    neonDustEmitters.delete(midi);
    if(!neonDustEmitters.size && saberLine) saberLine.classList.remove('saber-hit');
}
function updateDrawNeonDust(dt, now){
    // Emergency trim under sustained pressure. Runs for the mobile tiers AND for
    // the Default tier on mobile (auto-adapt); desktop Default is never capped.
    if(perfGovScale < 0.62 && neonDustCount > 120 && (getEffectiveGraphicQuality() !== 'default' || isMobileTargetMemo())){
        neonDustCount = 120;
    }
    if(isLowGraphic() || !saberDustEnabled){
        neonDustCount = 0;
        neonDustEmitters.clear();
        clearGlParticles();
        return false;
    }
    // Holding a key only MAINTAINS the stream — it does NOT thicken it. Every
    // held note emits at the same steady rate/amount, so density is even across
    // all presses and no single long-held note hogs the particle budget.
    neonDustEmitters.forEach(em => {
        if(em.midi != null){
            const g = getKeyStageGeom(em.midi);
            if(g) em.geom = g;
        }
        if(now - em.last >= DUST_EMIT_INTERVAL){
            em.last = now;
            spawnNeonDust(em.geom, DUST_EMIT_COUNT);
        }
    });

    if(!neonDustCount){ clearGlParticles(); return neonDustEmitters.size > 0; }

    const _dustColorKey = (dustColor || saberColor || '#00e5ff') + '|' + particleSaturation;
    if(_dustColorKey !== _dustSpriteKey){
        _dustSpriteKey = _dustColorKey;
        const _resolved = applySaberSaturation(dustColor || saberColor || '#00e5ff', particleSaturation);
        _dustSprite = getDustSprite(_resolved);
        const _rgb = _parseColorToRgb(_resolved);
        _glColorR = _rgb[0] / 255; _glColorG = _rgb[1] / 255; _glColorB = _rgb[2] / 255;
    }
    const sprite = _dustSprite;
    const speedLevel = sliderRatio(particleSpeed);
    const turbulenceLevel = sliderCurve(particleTurbulence, 1.05);
    const moveDt = dt * 1000 * (0.18 + speedLevel * 1.85);
    const turbEase = turbulenceLevel * 2; // Turbulence +100%
    // Dust drifts as discrete points.
    const wind = 0.000011 * turbEase;
    const biasWind = 0.000003 * turbEase;
    const maxVX = 0.003 + 0.015 * turbEase;
    // When the WebGL layer is live the 2D context is left untouched — physics run
    // here, the single GL draw happens after the loop.
    const useGl = !!glParticles;
    if(!useGl){
        ctx2d.save();
        // 'source-over' keeps each dust grain a discrete point.
        ctx2d.globalCompositeOperation = 'source-over';
    }
    let alive = 0;
    for(let i=0;i<neonDustCount;i++){
        neonDustAge[i] += dt * 1000;
        const tLife = neonDustLife[i] > 0 ? neonDustAge[i] / neonDustLife[i] : 1;
        if(turbEase > 0){
            const age = neonDustAge[i];
            const phaseA = age * (0.0014 + neonDustSeedB[i] * 0.00012) + neonDustSeedA[i];
            const phaseB = age * 0.0026 + neonDustSeedB[i] * 1.7;
            const wander = Math.sin(phaseA) * 0.66 + Math.sin(phaseB) * 0.34;
            const bias = neonDustSpin[i] * (0.30 + Math.sin(age * 0.0009 + neonDustSeedB[i]) * 0.22);
            // Dust barely spreads as it ages (stays a drifting point).
            const ageScale = 0.25 + Math.min(1, tLife) * 0.35;
            neonDustVX[i] += (wander * wind + bias * biasWind) * ageScale * moveDt;
            if(neonDustVX[i] > maxVX) neonDustVX[i] = maxVX;
            else if(neonDustVX[i] < -maxVX) neonDustVX[i] = -maxVX;
            neonDustX[i] += neonDustVX[i] * moveDt;
            neonDustVX[i] *= 0.986;
        } else {
            neonDustVX[i] = 0;
            neonDustX[i] = neonDustAnchorX[i];
        }
        neonDustY[i] += neonDustVY[i] * moveDt;
        // Drag decelerates the rise (smoke slows & lingers) with a faint residual
        // buoyancy, instead of the old constant upward acceleration.
        neonDustVY[i] *= 0.993;
        neonDustVY[i] -= 0.0000034 * moveDt;

        if(neonDustAge[i] < neonDustLife[i] && neonDustY[i] > -40){
            if(!useGl){
                const t = tLife;
                const fade = t < 0.14 ? t / 0.14 : Math.max(0, 1 - Math.pow((t - 0.14) / 0.86, 1.9));
                const alpha = Math.min(1, neonDustA[i] * fade * 1.4);
                if(alpha > 0.02){
                    const sz = Math.max(1.5, neonDustR[i] * 0.5);
                    ctx2d.globalAlpha = alpha;
                    ctx2d.drawImage(sprite, neonDustX[i] - sz * 0.5, neonDustY[i] - sz * 0.5, sz, sz);
                }
            }
            if(alive !== i){
                neonDustX[alive]=neonDustX[i]; neonDustY[alive]=neonDustY[i];
                neonDustVX[alive]=neonDustVX[i]; neonDustVY[alive]=neonDustVY[i];
                neonDustR[alive]=neonDustR[i]; neonDustA[alive]=neonDustA[i];
                neonDustLife[alive]=neonDustLife[i]; neonDustAge[alive]=neonDustAge[i];
                neonDustSeedA[alive]=neonDustSeedA[i]; neonDustSeedB[alive]=neonDustSeedB[i]; neonDustSpin[alive]=neonDustSpin[i];
                neonDustAnchorX[alive]=neonDustAnchorX[i];
            }
            alive++;
        }
    }
    neonDustCount = alive;
    if(useGl){
        renderGlParticles();
    } else {
        ctx2d.restore();
        ctx2d.globalAlpha = 1;
        ctx2d.globalCompositeOperation = 'source-over';
    }
    return neonDustCount > 0 || neonDustEmitters.size > 0;
}

function normalizeFallingOverrideColor(value){
    const raw = String(value || '').trim();
    if(/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if(/^#[0-9a-fA-F]{3}$/.test(raw)) return '#' + raw.slice(1).split('').map(ch => ch + ch).join('').toLowerCase();
    return '';
}
function addFallingNote(n, options = {}){
    n = Number(n);
    if(!Number.isFinite(n) || n < 21 || n > 108) return;
    // Release any existing growing notes with same midi+owner to prevent stuck notes at fast tempos
    const ownerId = options.ownerId || null;
    const ownerStr = ownerId == null ? '' : String(ownerId);
    const existing = fallingByMidi.get(n);
    if(existing){
        for(let i=0;i<existing.length;i++){
            const e = existing[i];
            if(e && e.growing && (e.ownerId == null ? '' : String(e.ownerId)) === ownerStr){
                e.growing = false;
            }
        }
    }
    const remote = !!options.remote;
    const remoteLevel = options.remoteLevel === 'full' ? 'full' : 'light';
    ensureStageCanvasFresh();
    if(!cachedStageHeight) refreshStageHeight();
    const rawBottomY = canvasCssH || cachedStageHeight || knownStageH || window.innerHeight * 0.6;
    const bottomY = canvasCssH > 0 ? Math.min(rawBottomY, canvasCssH) : rawBottomY;
    if(bottomY <= 6) return;

    const noteHue = (rainbowV2Seq * 37 + n * 11) % 360;
    rainbowV2Seq = (rainbowV2Seq + 1) % 3600;
    // anim() already compacts dead notes; doing it here too made addFallingNote
    // O(n) per press, turning a 100-note glissando into 10k array ops.
    const resolvedStyle = resolveAnimStyle(animStyle);
    const colorOverride = normalizeFallingOverrideColor(options.color);
    // seatColor tints a LOCAL styled note with the player's identity colour
    // without forcing it to plain solid (unlike colorOverride, which remote
    // notes use to render flat).
    const seatTint = (!remote && !colorOverride) ? normalizeFallingOverrideColor(options.seatColor) : '';
    const style = colorOverride ? 'default' : (remote ? 'default' : animStyle);
    const styleResolved = colorOverride ? 'default' : (remote ? 'default' : resolvedStyle);
    const opacity = remote ? Math.min(noteOpacity, remoteLevel === 'light' ? 88 : 96) : noteOpacity;
    const base = colorOverride || seatTint || getAnimBaseColorForMidi(n);

    const f = {midi:n, bottomY:bottomY, y:bottomY-6, height:6, style, styleResolved, shape:animShape, roundness:animRoundness, opacity, base, colorOverride, rainbowHue:noteHue, growing:true, ownerId:options.ownerId || null, remote};

    falling.push(f);
    registerFallingNote(f);
    ensureAnimLoop();
}
function addAnim(n){
    addFallingNote(n, selfSeatNoteOpts());
}
function addRemoteAnim(n, playerId, level, color){
    if(!isAnimOn) return;
    addFallingNote(n, { remote:true, remoteLevel:level, ownerId:remoteFallingOwnerId(playerId), color });
}
function hexToRgb(hex){ hex=hex.trim().replace('#',''); if(hex.length===3) hex=hex.split('').map(c=>c+c).join(''); const n=parseInt(hex,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
let animFrameId = null;
let _lastAnimTs = -1;
function ensureAnimLoop(){
    if(!animFrameId){
        lastFrameTime=0;
        if(document.body.classList.contains('idle-no-notes')){
            document.body.classList.remove('idle-no-notes');
        }
        animFrameId=requestAnimationFrame(anim);
    }
}
if(document && document.body) document.body.classList.add('idle-no-notes');
else document.addEventListener('DOMContentLoaded', () => document.body.classList.add('idle-no-notes'), { once:true });
refreshStageHeight();


const _spriteCache = new Map();
const _SPRITE_CACHE_MAX = 96;
function clearEffectSpriteCache(){
    if(_spriteCache && _spriteCache.clear) _spriteCache.clear();
}
function _qBucket(n, step){ return Math.max(step, Math.round(n / step) * step); }
function _colorBucket(rgb){
    return ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4);
}
function _isNearWhiteRgb(rgb){
    return !!rgb && rgb[0] >= 235 && rgb[1] >= 235 && rgb[2] >= 235;
}
function _spriteRoundPath(sctx, w, h, r){
    r = Math.max(0, Math.min(r || 0, w * 0.5, h * 0.5));
    sctx.beginPath();
    if(r <= 0){ sctx.rect(0, 0, w, h); return; }
    if(sctx.roundRect){ sctx.roundRect(0, 0, w, h, r); return; }
    sctx.moveTo(r, 0);
    sctx.lineTo(w - r, 0);
    sctx.quadraticCurveTo(w, 0, w, r);
    sctx.lineTo(w, h - r);
    sctx.quadraticCurveTo(w, h, w - r, h);
    sctx.lineTo(r, h);
    sctx.quadraticCurveTo(0, h, 0, h - r);
    sctx.lineTo(0, r);
    sctx.quadraticCurveTo(0, 0, r, 0);
    sctx.closePath();
}

function getEffectSprite(style, rgb, w, h, isRounded, hue, roundnessPct){
    const wB = _qBucket(w, 2);
    const hB = _qBucket(h, 24);
    const cB = style === 'rainbow' ? ((hue|0) >> 2)
             : style === 'solid' ? ((rgb[0]|0) * 65536 + (rgb[1]|0) * 256 + (rgb[2]|0))
             : _colorBucket(rgb);
    const roundPct = isRounded ? Math.max(0, Math.min(100, Math.round(Number(roundnessPct ?? 100)))) : 0;
    const sB = roundPct > 0 ? ('r' + roundPct) : 's';
    const rB = roundPct > 0 ? (Math.min(8, wB * 0.45, hB * 0.35) * (roundPct / 100)) | 0 : 0;
    const dpr = currentDPR || 1;
    const dprB = Math.round(dpr * 100) | 0;
    const key = `${style}_${cB}_${wB}_${hB}_${sB}_${rB}_${dprB}`;
    let sprite = _spriteCache.get(key);
    if(sprite) return sprite;
    if(_spriteCache.size >= _SPRITE_CACHE_MAX){
        const firstKey = _spriteCache.keys().next().value;
        _spriteCache.delete(firstKey);
    }
    sprite = document.createElement('canvas');
    const wPhys = Math.max(1, Math.round(wB * dpr));
    const hPhys = Math.max(1, Math.round(hB * dpr));
    sprite.width = wPhys;
    sprite.height = hPhys;
    const sctx = sprite.getContext('2d', { alpha: true });
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    const sxBake = wPhys / wB;
    const syBake = hPhys / hB;
    if(sxBake !== 1 || syBake !== 1) sctx.scale(sxBake, syBake);
    const r = isRounded ? Math.min(8, wB * 0.45, hB * 0.35) : 0;

    if(style === 'solid'){
        sctx.fillStyle = `rgb(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0})`;
        _spriteRoundPath(sctx, wB, hB, r);
        sctx.fill();
    } else if(style === 'rainbow'){
        const sat = 88, light = 58;
        const g = sctx.createLinearGradient(0, 0, 0, hB);
        g.addColorStop(0, `hsl(${hue|0},${sat}%,${Math.min(75, light + 12)}%)`);
        g.addColorStop(1, `hsl(${hue|0},${sat}%,${Math.max(20, light - 14)}%)`);
        sctx.fillStyle = g;
        _spriteRoundPath(sctx, wB, hB, r);
        sctx.fill();
    } else {
        const R = rgb[0]|0, G = rgb[1]|0, B = rgb[2]|0;
        const lite = (m) => `rgb(${Math.round(R+(255-R)*m)},${Math.round(G+(255-G)*m)},${Math.round(B+(255-B)*m)})`;
        const dark = (m) => `rgb(${Math.round(R*m)},${Math.round(G*m)},${Math.round(B*m)})`;
        if(style === 'gradient'){
            // Clean vertical gradient: light at the top, full colour at the bottom.
            const g = sctx.createLinearGradient(0, 0, 0, hB);
            g.addColorStop(0, lite(0.55));
            g.addColorStop(0.5, `rgb(${R},${G},${B})`);
            g.addColorStop(1, dark(0.78));
            sctx.fillStyle = g; _spriteRoundPath(sctx, wB, hB, r); sctx.fill();
        } else if(style === 'midnight'){
            // Deep, moody column: near-black base glowing up into the colour.
            const g = sctx.createLinearGradient(0, 0, 0, hB);
            g.addColorStop(0, lite(0.25));
            g.addColorStop(0.32, `rgb(${R},${G},${B})`);
            g.addColorStop(0.72, dark(0.42));
            g.addColorStop(1, dark(0.14));
            sctx.fillStyle = g; _spriteRoundPath(sctx, wB, hB, r); sctx.fill();
        } else if(style === 'glass'){
            // Frosted glass: translucent body, bright top sheen, glassy edges.
            sctx.save(); _spriteRoundPath(sctx, wB, hB, r); sctx.clip();
            const body = sctx.createLinearGradient(0, 0, 0, hB);
            body.addColorStop(0, `rgba(${R},${G},${B},0.34)`);
            body.addColorStop(1, `rgba(${R},${G},${B},0.18)`);
            sctx.fillStyle = body; sctx.fillRect(0, 0, wB, hB);
            const sheen = sctx.createLinearGradient(0, 0, 0, hB);
            sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
            sheen.addColorStop(0.28, 'rgba(255,255,255,0.08)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            sctx.fillStyle = sheen; sctx.fillRect(0, 0, wB, hB);
            const edge = sctx.createLinearGradient(0, 0, wB, 0);
            edge.addColorStop(0, 'rgba(255,255,255,0.40)');
            edge.addColorStop(0.18, 'rgba(255,255,255,0)');
            edge.addColorStop(0.82, 'rgba(255,255,255,0)');
            edge.addColorStop(1, `rgba(${R},${G},${B},0.45)`);
            sctx.fillStyle = edge; sctx.fillRect(0, 0, wB, hB);
            sctx.restore();
            // crisp bright rim
            sctx.lineWidth = Math.max(1, wB * 0.06);
            sctx.strokeStyle = `rgba(${Math.min(255,R+60)},${Math.min(255,G+60)},${Math.min(255,B+60)},0.7)`;
            _spriteRoundPath(sctx, wB, hB, r); sctx.stroke();
        } else if(style === 'neon' || style === 'glow'){
            // Deprecated styles — fall back to a clean gradient if ever requested.
            const g = sctx.createLinearGradient(0, 0, 0, hB);
            g.addColorStop(0, lite(0.55));
            g.addColorStop(0.5, `rgb(${R},${G},${B})`);
            g.addColorStop(1, dark(0.78));
            sctx.fillStyle = g; _spriteRoundPath(sctx, wB, hB, r); sctx.fill();
        } else {
            // unknown style -> solid fallback
            sctx.fillStyle = `rgb(${R},${G},${B})`;
            _spriteRoundPath(sctx, wB, hB, r); sctx.fill();
        }
    }

    _spriteCache.set(key, sprite);
    return sprite;
}

function clampPercentValue(value, fallback=0){
    const raw = Number(value);
    const safe = Number.isFinite(raw) ? raw : fallback;
    return Math.max(0, Math.min(100, Math.round(safe)));
}
function sliderRatio(value, fallback=0){
    return clampPercentValue(value, fallback) / 100;
}
function sliderCurve(value, power=1, fallback=0){
    // Linear mapping: a slider at X% applies exactly X% of the effect, so the
    // response feels accurate across the whole range (no front/back loading).
    return sliderRatio(value, fallback);
}
const _tunedRgbScratch = new Uint8Array(3);
let _tunedCacheR = -1, _tunedCacheG = -1, _tunedCacheB = -1;
let _tunedCacheSat = -1, _tunedCacheBright = -1;
let _tunedCacheOutR = 0, _tunedCacheOutG = 0, _tunedCacheOutB = 0;
function tuneRgbForFalling(rgb){
    const r0 = rgb[0]|0, g0 = rgb[1]|0, b0 = rgb[2]|0;
    const sat = 1.18, bright = 1.16;
    if(r0 === _tunedCacheR && g0 === _tunedCacheG && b0 === _tunedCacheB
       && sat === _tunedCacheSat && bright === _tunedCacheBright){
        _tunedRgbScratch[0] = _tunedCacheOutR;
        _tunedRgbScratch[1] = _tunedCacheOutG;
        _tunedRgbScratch[2] = _tunedCacheOutB;
        return _tunedRgbScratch;
    }
    const luma = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;
    let or = (luma + (r0 - luma) * sat) * bright;
    let og = (luma + (g0 - luma) * sat) * bright;
    let ob = (luma + (b0 - luma) * sat) * bright;
    or = or < 0 ? 0 : or > 255 ? 255 : (or + 0.5) | 0;
    og = og < 0 ? 0 : og > 255 ? 255 : (og + 0.5) | 0;
    ob = ob < 0 ? 0 : ob > 255 ? 255 : (ob + 0.5) | 0;
    _tunedCacheR = r0; _tunedCacheG = g0; _tunedCacheB = b0;
    _tunedCacheSat = sat; _tunedCacheBright = bright;
    _tunedCacheOutR = or; _tunedCacheOutG = og; _tunedCacheOutB = ob;
    _tunedRgbScratch[0] = or;
    _tunedRgbScratch[1] = og;
    _tunedRgbScratch[2] = ob;
    return _tunedRgbScratch;
}
function drawFallingNote(f){
    const fastX = noteXFast[f.midi];
    const cachedX = Number.isFinite(fastX) ? fastX : noteXCache.get(f.midi);
    if(cachedX===undefined || !Number.isFinite(cachedX)) return;
    const x = cachedX - currentPianoTransformPx;

    const _kw = whiteKeyWidth > 0 ? whiteKeyWidth : animSize;
    const _effSize = Math.min(animSize, Math.max(4, _kw * 0.9));
    const baseW = isBlack(f.midi) ? _effSize * 0.7 : _effSize;
    const shape = f.shape || 'rounded';
    const roundPct = Math.max(0, Math.min(100, Number(f.roundness ?? animRoundness ?? 100)));
    const noteAlpha = Math.max(0.1, Math.min(1, Number(f.opacity ?? noteOpacity ?? 100) / 100));
    const w = baseW;
    const h = Math.max(6, f.height);
    const x0 = x - w*0.5;
    const y = f.y;
    if(y > canvasCssH || y + h < 0) return;
    if(x0 > canvasCssW || x0 + w < 0) return;

    const isRounded = shape === 'rounded' && roundPct > 0;
    const rv = isRounded ? Math.min(8, w*0.45, h*0.35) * (roundPct / 100) : 0;
    const drawStyleRaw = f.styleResolved || f.style;
    const drawStyle = (drawStyleRaw === 'rainbowV2' || drawStyleRaw === 'crystal3d') ? 'rainbow' : drawStyleRaw;

    ctx2d.globalAlpha = noteAlpha;
    ctx2d.globalCompositeOperation = 'source-over';

    if(drawStyle === 'rainbow'){
        const hue = Number.isFinite(f.rainbowHue) ? f.rainbowHue : 0;
        ctx2d.fillStyle = `hsl(${hue|0},88%,58%)`;
        if(isRounded && rv > 0){
            ctx2d.beginPath();
            if(ctx2d.roundRect) ctx2d.roundRect(x0, y, w, h, rv);
            else ctx2d.rect(x0, y, w, h);
            ctx2d.fill();
        } else {
            ctx2d.fillRect(x0, y, w, h);
        }
    } else {

        const baseHex = f.base || cachedAnimColor || '#ffffff';
        let rgb = _solidRgbCache.get(baseHex);
        if(rgb === undefined){
            const rgb0 = safeHex(baseHex, '#78dcff');
            rgb = _isNearWhiteRgb(rgb0) ? [240,248,255] : tuneRgbForFalling(rgb0).slice();
            if(_solidRgbCache.size > 64) _solidRgbCache.clear();
            _solidRgbCache.set(baseHex, rgb);
        }
        if(drawStyle === 'outline'){
            // Transparent center, coloured rounded border.
            const lw = Math.max(1.5, Math.min(w * 0.16, 4));
            ctx2d.lineWidth = lw;
            ctx2d.strokeStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            const ix = x0 + lw / 2, iy = y + lw / 2, iw = Math.max(1, w - lw), ih = Math.max(1, h - lw);
            ctx2d.beginPath();
            if(isRounded && rv > 0 && ctx2d.roundRect) ctx2d.roundRect(ix, iy, iw, ih, Math.max(0, rv - lw / 2));
            else ctx2d.rect(ix, iy, iw, ih);
            ctx2d.stroke();
        } else if(drawStyle === 'solid' || drawStyle === 'default'){
            // 'default' (Single/Double/remote) renders as a plain solid fill.
            // Route it through the exact-colour 'solid' sprite key — NOT the
            // generic branch, whose coarse 4-bit colour bucket would collide
            // two nearby seat/custom colours onto one cached sprite.
            if(isRounded && rv > 0){
                const sprite = getEffectSprite('solid', rgb, w, h, isRounded, 0, roundPct);
                ctx2d.drawImage(sprite, x0, y, w, h);
            } else {
                ctx2d.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
                ctx2d.fillRect(x0, y, w, h);
            }
        } else {
            // glass / midnight / gradient — baked, cached sprites.
            const sprite = getEffectSprite(drawStyle, rgb, w, h, isRounded, 0, roundPct);
            ctx2d.drawImage(sprite, x0, y, w, h);
        }
    }

    ctx2d.globalAlpha = 1;
}

function safeHex(hex, fallback){
    try { return hexToRgb(hex || fallback); }
    catch(e){ return hexToRgb(fallback); }
}
function anim(now){

    if(_lastAnimTs >= 0 && (now - _lastAnimTs) >= 0 && (now - _lastAnimTs) < 6 && animFrameId){
        animFrameId = requestAnimationFrame(anim);
        return;
    }
    _lastAnimTs = now;
    renderNow = now;
    if(!lastFrameTime) lastFrameTime=now;
    const rawDt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    let dt = rawDt;
    if(!(dt > 0)) dt = 1 / 60;
    else if(dt > DT_MAX) dt = DT_MAX;
    perfGovernorTick(rawDt * 1000, now);

    ctx2d.setTransform(1,0,0,1,0,0);
    ctx2d.globalAlpha = 1;
    ctx2d.globalCompositeOperation = 'source-over';
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    if(currentDPR !== 1) ctx2d.setTransform(currentDPR, 0, 0, currentDPR, 0, 0);

    let hasLive = false;
    // Particle layer: V1 ('glow') draws dust BEHIND the falling notes, V2
    // ('solid') draws it IN FRONT. Same particles either way — only the
    // compositing order differs. The dust pass also advances particle physics,
    // so it must run exactly once per frame.
    const dustInFront = dustBlendMode === 'solid';
    if(!dustInFront){ if(updateDrawNeonDust(dt, now)) hasLive = true; }

    const riseSpeed = getAnimRiseSpeed() * dt;
    // Default tier: a held note keeps growing to fill the screen instead of capping
    // at 400px — held notes stay drawing for as long as the key is held. Mobile
    // keeps the shorter fixed cap.
    const maxNoteH = (graphicQuality === 'default')
        ? Math.max(MAX_NOTE_HEIGHT, (canvasCssH || MAX_NOTE_HEIGHT))
        : MAX_NOTE_HEIGHT;
    for(let i=0;i<falling.length;i++){
        const f=falling[i];
        if(f.dead) continue;
        if(f.growing){
            if(f.height<maxNoteH){
                f.height=Math.min(f.height+riseSpeed, maxNoteH);
                f.y=f.bottomY-f.height;
            } else {
                f.growing = false;
            }
        } else {
            f.y -= riseSpeed;
            if(f.bottomY !== undefined) f.bottomY -= riseSpeed;
        }
        if(f.y+f.height<0){ f.dead=true; continue; }
        drawFallingNote(f);
        hasLive = true;
    }
    if(dustInFront){ if(updateDrawNeonDust(dt, now)) hasLive = true; }

    if(falling.length > 40){
        let w=0, removed=false;
        for(let i=0;i<falling.length;i++){
            if(!falling[i].dead) falling[w++]=falling[i];
            else removed=true;
        }
        falling.length=w;
        if(removed) unregisterDeadFalling();
    }

    if(hasLive) animFrameId=requestAnimationFrame(anim);
    else {
        animFrameId=null; lastFrameTime=0; _lastAnimTs=-1; falling.length=0; fallingByMidi.clear();
        if(pressStartTimes.size === 0 && document.body && !document.body.classList.contains('idle-no-notes')){
            document.body.classList.add('idle-no-notes');
        }
    }
}
let resizeRaf = null;
let heightResizeRaf = null;
let uiLayoutLockUntil = 0;
function lockUiLayout(ms=500){
    uiLayoutLockUntil = performance.now() + ms;
}
function isUiLayoutLocked(){
    return performance.now() < uiLayoutLockUntil || document.body.classList.contains('mp-chat-keyboard');
}
let cachedStageW = 0, cachedStageH = 0;
let stageGeomDirty = true;
let lastStageFreshCheckAt = 0;

let knownStageH = 0;
function markStageGeomDirty(){
    stageGeomDirty = true;
    invalidateStageGeom();
}
function computeStageSize(){
    const stage = document.querySelector('.stage');
    if(stage){
        const r = stage.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width || stage.clientWidth || stage.offsetWidth || window.innerWidth || 1));
        const h = Math.max(1, Math.round(r.height || stage.clientHeight || stage.offsetHeight || canvasCssH || 1));
        _cachedStageEl = stage;
        _cachedStageRect = r;
        return { w, h };
    }
    return {
        w: Math.max(1, Math.round(window.innerWidth || canvasCssW || 1)),
        h: Math.max(1, Math.round(canvasCssH || knownStageH || window.innerHeight * 0.6 || 1))
    };
}
function syncCanvasSize(forceReadStage){
    const mustRead = forceReadStage || stageGeomDirty || knownStageH === 0 || cachedStageW === 0;
    const size = mustRead ? computeStageSize() : { w: cachedStageW, h: knownStageH };
    const nextW = Math.max(1, Math.floor(size.w));
    const nextH = Math.max(1, Math.floor(size.h));
    if(knownStageH !== nextH) knownStageH = nextH;
    cachedStageW = nextW;
    cachedStageH = nextH;
    stageGeomDirty = false;
    const dpr = getRenderDPR();
    const physW = Math.max(1, Math.round(nextW * dpr));
    const physH = Math.max(1, Math.round(nextH * dpr));
    canvasCssW = nextW;
    canvasCssH = nextH;
    currentDPR = dpr;
    if(canvas.width !== physW) canvas.width = physW;
    if(canvas.height !== physH) canvas.height = physH;
    const cssW = nextW + 'px', cssH = nextH + 'px';
    if(canvas.style.width !== cssW) canvas.style.width = cssW;
    if(canvas.style.height !== cssH) canvas.style.height = cssH;
    // Keep the WebGL particle layer pixel-locked to the 2D canvas.
    if(glCanvas){
        if(glCanvas.style.width !== cssW) glCanvas.style.width = cssW;
        if(glCanvas.style.height !== cssH) glCanvas.style.height = cssH;
        glResizeParticles(physW, physH);
    }
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.imageSmoothingQuality = 'high';
    ctx2d.globalAlpha = 1;
    ctx2d.globalCompositeOperation = 'source-over';
    cachedStageHeight = nextH;
    _cachedStageRect = null;
}
function ensureStageCanvasFresh(force=false){

    if(stageGeomDirty || !canvasCssH || !cachedStageHeight){
        syncCanvasSize(true);
        lastStageFreshCheckAt = performance.now();
        return;
    }
    if(force){
        lastStageFreshCheckAt = performance.now();
        reconcileStageCanvasSize();
    }
}
function reconcileStageCanvasSize(){
    if(isUiLayoutLocked()) return;
    const stage = document.querySelector('.stage');
    if(!stage) return;
    const r = stage.getBoundingClientRect();
    const realW = Math.max(1, Math.round(r.width || stage.clientWidth || stage.offsetWidth || 1));
    const realH = Math.max(1, Math.round(r.height || stage.clientHeight || stage.offsetHeight || 1));
    if(Math.abs(realH - canvasCssH) > 2 || Math.abs(realW - canvasCssW) > 2){
        markStageGeomDirty();
        syncCanvasSize(true);
    }
}
let _stageFreshWatcherId = null;
function startStageFreshWatcher(){
    if(_stageFreshWatcherId) return;

    _stageFreshWatcherId = setInterval(() => {
        if(stageGeomDirty || !canvasCssH) return;
        if(!animFrameId) return;
        if(getBurstLevel() >= 4) return;
        reconcileStageCanvasSize();
    }, 500);
}
function syncViewportGeometryNow(){
    if(isUiLayoutLocked()) return;
    markStageGeomDirty();
    updateKeyLayout();
    syncCanvasSize(true);
    updateKeyHitCache();
    if(falling.length>0) ensureAnimLoop();
}
function scheduleViewportGeometrySync(){
    syncViewportGeometryNow();
    [80, 200, 450, 800].forEach(d => setTimeout(syncViewportGeometryNow, d));
}
function resize(){
    if(isUiLayoutLocked()) return;
    if(resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        invalidateWrapRect();
        syncCanvasSize(true);
        updateKeyLayout();
        if(falling.length>0) ensureAnimLoop();
    });
}
function schedulePianoHeightResize(){
    if(heightResizeRaf) cancelAnimationFrame(heightResizeRaf);
    heightResizeRaf = requestAnimationFrame(() => {
        heightResizeRaf = null;
        invalidateWrapRect();
        syncCanvasSize(false);
        updateKeyLayout();
        updateKeyHitCache();
        if(falling.length>0) ensureAnimLoop();
    });
}
const hRange = document.getElementById('hRange');
const hVal = document.getElementById('hVal');
function getPianoMaxHeightPx(){
    const vv = window.visualViewport;
    const vh = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    return Math.max(1, Math.floor(vh * 0.50));
}
function normalizePianoHeightPercent(value){
    const raw = Number(value);
    if(!Number.isFinite(raw)) return 0;
    if(raw > 100){
        const maxPx = getPianoMaxHeightPx();
        return Math.round((Math.max(0, Math.min(maxPx, raw)) / maxPx) * 100);
    }
    return Math.max(0, Math.min(100, Math.round(raw)));
}
function pianoHeightPercentToPx(percent){
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const maxPx = getPianoMaxHeightPx();
    return Math.round(maxPx * pct / 100);
}
let currentPianoHeightPx = '';
let currentPianoHeightPercent = 50;
let heightCssRaf = null;
let heightFinalizeTimer = null;
let heightFinalizeRaf = null;
function updateHeightUI(percent){
    const pct = normalizePianoHeightPercent(percent);
    if(hRange && hRange.value !== String(pct)) hRange.value = String(pct);
    if(hVal) hVal.textContent = pct + '%';
}
function finalizePianoHeightLayout(){
    if(heightFinalizeTimer) { clearTimeout(heightFinalizeTimer); heightFinalizeTimer = null; }
    if(heightFinalizeRaf) cancelAnimationFrame(heightFinalizeRaf);
    heightFinalizeRaf = requestAnimationFrame(() => {
        heightFinalizeRaf = null;
        document.body.classList.remove('layout-changing', 'piano-height-dragging');
        invalidateWrapRect();
        syncCanvasSize(false);
        updateKeyLayout();
        updateKeyHitCache();
        if(falling.length>0) ensureAnimLoop();
    });
}

function ensurePianoBootVisible(){
    const wrap = document.getElementById('pianoWrap');
    const piano = document.getElementById('piano');
    if(!wrap || !piano) return;
    const h = wrap.getBoundingClientRect().height;
    if(!h || h < 24){
        currentPianoHeightPx = '';
        applyPianoHeight(getDefaultPianoHeightPercent(), true);
    }
    if(!piano.children.length && typeof build === 'function') build();
    else if(typeof updateKeyLayout === 'function') updateKeyLayout();
    if(typeof updateKeyHitCache === 'function') updateKeyHitCache();
    if(typeof syncCanvasSize === 'function') syncCanvasSize(true);
}

function applyPianoHeight(value, final=false){
    if(!hRange) return;
    const pct = normalizePianoHeightPercent(value);
    const next = pianoHeightPercentToPx(pct);
    pendingPianoHeight = String(pct);
    currentPianoHeightPercent = pct;
    updateHeightUI(pct);
    const nextPx = next + 'px';
    markStageGeomDirty();
    document.body.classList.add('layout-changing', 'piano-height-dragging');
    if(currentPianoHeightPx !== nextPx){
        currentPianoHeightPx = nextPx;
        if(heightCssRaf){ cancelAnimationFrame(heightCssRaf); heightCssRaf = null; }
        document.documentElement.style.setProperty('--piano-height', nextPx);
        schedulePianoHeightResize();
    }
    if(final){
        finalizePianoHeightLayout();
    } else {
        if(heightFinalizeTimer) clearTimeout(heightFinalizeTimer);
        heightFinalizeTimer = setTimeout(finalizePianoHeightLayout, 180);
    }
}
if(hRange){
    hRange.addEventListener('input', () => applyPianoHeight(hRange.value, false));
    hRange.addEventListener('change', () => applyPianoHeight(hRange.value, true));
    hRange.addEventListener('pointerup', () => applyPianoHeight(hRange.value, true));
    hRange.addEventListener('touchend', () => applyPianoHeight(hRange.value, true), {passive:true});
}
const keyPanelHRange = document.getElementById('keyPanelHRange');
const keyPanelHVal = document.getElementById('keyPanelHVal');
function syncKeyPanelHeight(pct){
    if(keyPanelHRange) keyPanelHRange.value = pct;
    if(keyPanelHVal) keyPanelHVal.textContent = pct + '%';
}
if(keyPanelHRange){
    keyPanelHRange.addEventListener('input', () => { applyPianoHeight(keyPanelHRange.value, false); syncKeyPanelHeight(normalizePianoHeightPercent(keyPanelHRange.value)); });
    keyPanelHRange.addEventListener('change', () => { applyPianoHeight(keyPanelHRange.value, true); syncKeyPanelHeight(normalizePianoHeightPercent(keyPanelHRange.value)); });
    keyPanelHRange.addEventListener('pointerup', () => { applyPianoHeight(keyPanelHRange.value, true); });
    keyPanelHRange.addEventListener('touchend', () => { applyPianoHeight(keyPanelHRange.value, true); }, {passive:true});
}
document.getElementById('blackKeyWidthRange')?.addEventListener('input', e => setBlackKeyWidthPercent(e.target.value));
document.getElementById('blackKeyHeightRange')?.addEventListener('input', e => setBlackKeyHeightPercent(e.target.value));
document.getElementById('pianoVisibilityRange')?.addEventListener('input', e => setPianoVisibilityPercent(e.target.value));
setPianoScalePercent();
setBlackKeyWidthPercent(blackKeyWidthPercent);
setBlackKeyHeightPercent(blackKeyHeightPercent);
setPianoVisibilityPercent(pianoVisibilityPercent);

const _origUpdateHeightUI = updateHeightUI;
updateHeightUI = function(percent){
    _origUpdateHeightUI(percent);
    const pct = normalizePianoHeightPercent(percent);
    syncKeyPanelHeight(pct);
};
window.addEventListener('resize', () => {
    if(isUiLayoutLocked()) return;
    markStageGeomDirty();
    resize();
    applyPianoHeight(currentPianoHeightPercent, true);
}, { passive:true }); resize();

function relayoutAfterOrientation(){
    if(isUiLayoutLocked()) return;
    markStageGeomDirty();
    resize();
    applyPianoHeight(currentPianoHeightPercent, true);
    scheduleViewportGeometrySync();
}
window.addEventListener('orientationchange', () => {
    relayoutAfterOrientation();
    [120, 280, 500, 800].forEach(d => setTimeout(relayoutAfterOrientation, d));
}, { passive:true });
if(window.visualViewport){
    let vvRaf = 0;
    window.visualViewport.addEventListener('resize', () => {
        if(isUiLayoutLocked()) return;
        if(vvRaf) cancelAnimationFrame(vvRaf);
        vvRaf = requestAnimationFrame(relayoutAfterOrientation);
        scheduleViewportGeometrySync();
    }, { passive:true });
}

function toggle(id){ let p=document.getElementById(id); let v=p.style.display==='flex'; document.querySelectorAll('.floating-panel').forEach(x=>x.style.display='none'); p.style.display=v?'none':'flex'; }
document.getElementById('setBtn').onclick=()=>{ setSettingsTab('performance'); toggle('settingsPanel'); };

function openLinkedPanel(panelId){
    document.querySelectorAll('.floating-panel').forEach(x => x.style.display = 'none');
    const panel = document.getElementById(panelId);
    if(panel) panel.style.display = 'flex';
}
function openSfPanelTab(tab){
    openLinkedPanel('sfPanel');
    if(typeof setSfPanelTab === 'function') setSfPanelTab(tab);
}
function setSettingsTab(tab){
    document.querySelectorAll('.settings-cat-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.settingsTab === tab));
    document.querySelectorAll('.settings-section').forEach(sec => sec.classList.toggle('active', sec.dataset.settingsSection === tab));
}
function setVisualPanelPage(page){
    const isHub = !page || page === 'hub';
    document.querySelectorAll('.visual-hub').forEach(hub => hub.classList.toggle('active', isHub));
    document.querySelectorAll('.visual-subpage').forEach(sub => sub.classList.toggle('active', !isHub && sub.dataset.visualSubpage === page));
}
document.querySelectorAll('[data-visual-open]').forEach(btn => {
    btn.addEventListener('click', () => setVisualPanelPage(btn.dataset.visualOpen));
});
document.querySelectorAll('[data-visual-back]').forEach(btn => {
    btn.addEventListener('click', () => setVisualPanelPage('hub'));
});
document.querySelectorAll('.settings-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab));
});
document.querySelectorAll('[data-close-panel]').forEach(btn => {
    btn.addEventListener('click', () => toggle(btn.dataset.closePanel));
});
document.getElementById('colBtn').onclick=()=>{ setVisualPanelPage('hub'); toggle('colorPanel'); };
document.getElementById('metroBtn').onclick=()=>toggle('metronomePanel');
document.getElementById('sfBtn').onclick=()=>openSfPanelTab('main');
const audioBtn = document.getElementById('audioBtn');
if(audioBtn) audioBtn.onclick=()=>toggle('audioPanel');
document.getElementById('keyBtn').onclick=()=>toggle('keyPanel');
document.getElementById('holdBtn').onclick=()=>toggleSustainHold();
document.getElementById('settingsSustainBtn')?.addEventListener('click', toggleSustainHold);
refreshSustainButton();
const logoToggle = document.getElementById('logoToggle');
if(logoToggle){
    logoToggle.addEventListener('click', () => {
        lockUiLayout(600);
        document.body.classList.toggle('hide-ui');
    });
}
const topPanelScroller = document.getElementById('panel');
if(topPanelScroller){
    topPanelScroller.addEventListener('wheel', e => {
        if(!e.deltaY) return;
        if(topPanelScroller.scrollWidth <= topPanelScroller.clientWidth) return;
        topPanelScroller.scrollLeft += e.deltaY;
        e.preventDefault();
    }, { passive:false });
}
const settingsFullscreenBtn = document.getElementById('settingsFullscreenBtn');
if(settingsFullscreenBtn) settingsFullscreenBtn.onclick = () => {
    const fs = document.getElementById('fsBtn');
    if(fs && typeof fs.onclick === 'function') fs.onclick();
};
const settingsMidiBtn = document.getElementById('settingsMidiBtn');
if(settingsMidiBtn) settingsMidiBtn.onclick = () => {
    const midi = document.getElementById('midiBtn');
    if(midi) midi.click();
};

function applyCurrentSfEffects(){
    const fx = sfEffectSettings.sf1 || {sustain:1.00,reverb:0};
    sustainLevel = Math.max(0, Math.min(1, fx.sustain || 0));
    if (!sfEffectSettings.sf2) sfEffectSettings.sf2 = {fadeSec:STRING_FADE_DEFAULT,reverb:0};
    if (sfEffectSettings.sf2.fadeSec === undefined) sfEffectSettings.sf2.fadeSec = STRING_FADE_DEFAULT;
    reverbLevel = Math.round(Math.max(sfEffectSettings.sf1.reverb || 0, sfEffectSettings.sf2.reverb || 0) * 100);
    isSus = sustainLevel > 0.01;
    reverbEnabled = reverbLevel > 0;
    if (reverbGain) reverbGain.gain.setTargetAtTime(0.65, audioCtx.currentTime, 0.05);
}
function updateSfEffectUI(){
    if (!sfEffectSettings.sf2) sfEffectSettings.sf2 = {fadeSec:STRING_FADE_DEFAULT,reverb:0};
    const pairs = [
        ['sf1','sustainSf1Range','sustainSf1Val','sustain'],
        ['sf1','reverbSf1Range','reverbSf1Val','reverb'],
        ['sf2','reverbSf2Range','reverbSf2Val','reverb']
    ];
    pairs.forEach(([group, rangeId, valId, prop]) => {
        const range = document.getElementById(rangeId);
        const val = document.getElementById(valId);
        const pct = Math.round((sfEffectSettings[group][prop] || 0) * 100);
        if (range) range.value = pct;
        if (val) val.textContent = pct + '%';
    });
    const stringFadeRange = document.getElementById('sustainSf2Range');
    const stringFadeVal = document.getElementById('sustainSf2Val');
    const fadeSec = Math.max(0.1, Math.min(10.0, Number(sfEffectSettings.sf2.fadeSec) || STRING_FADE_DEFAULT));
    if (stringFadeRange) stringFadeRange.value = fadeSec.toFixed(1);
    if (stringFadeVal) stringFadeVal.textContent = fadeSec.toFixed(1) + 's';
    const pianoRange = document.getElementById('pianoVolRange');
    const pianoVal = document.getElementById('pianoVolVal');
    const stringRange = document.getElementById('stringVolRange');
    const stringVal = document.getElementById('stringVolVal');
    const settingsPianoRange = document.getElementById('settingsPianoVolRange');
    const settingsPianoVal = document.getElementById('settingsPianoVolVal');
    const settingsStringRange = document.getElementById('settingsStringVolRange');
    const settingsStringVal = document.getElementById('settingsStringVolVal');
    const settingsSustainRange = document.getElementById('settingsSustainSf1Range');
    const settingsSustainVal = document.getElementById('settingsSustainSf1Val');
    const settingsFadeRange = document.getElementById('settingsSustainSf2Range');
    const settingsFadeVal = document.getElementById('settingsSustainSf2Val');
    const pv = Math.round(pianoVolume * 100);
    const sv = Math.round(stringVolume * 100);
    const sustainPct = Math.round((sfEffectSettings.sf1.sustain || 0) * 100);
    if (pianoRange) pianoRange.value = pv;
    if (pianoVal) pianoVal.textContent = pv + '%';
    if (stringRange) stringRange.value = sv;
    if (stringVal) stringVal.textContent = sv + '%';
    if (settingsPianoRange) settingsPianoRange.value = pv;
    if (settingsPianoVal) settingsPianoVal.textContent = pv + '%';
    if (settingsStringRange) settingsStringRange.value = sv;
    if (settingsStringVal) settingsStringVal.textContent = sv + '%';
    if (settingsSustainRange) settingsSustainRange.value = sustainPct;
    if (settingsSustainVal) settingsSustainVal.textContent = sustainPct + '%';
    if (settingsFadeRange) settingsFadeRange.value = fadeSec.toFixed(1);
    if (settingsFadeVal) settingsFadeVal.textContent = fadeSec.toFixed(1) + 's';
}
function setSfPanelTab(tab){
    const normalized = tab === 'sf1' ? 'main' : (tab === 'sf2' ? 'layer' : (tab === 'layer' ? 'layer' : 'main'));
    document.querySelectorAll('.sf-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === normalized));
    document.querySelectorAll('.sf-page').forEach(page => page.classList.remove('active'));
    const pageMap = { main:'sfPageMain', layer:'sfPageLayer' };
    const page = document.getElementById(pageMap[normalized] || 'sfPageMain');
    if (page) page.classList.add('active');
}
document.querySelectorAll('.sf-tab').forEach(btn => btn.onclick=()=>setSfPanelTab(btn.dataset.tab));
['sustainSf1Range','reverbSf1Range','sustainSf2Range','reverbSf2Range'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.oninput = e => {
        if (id === 'sustainSf2Range') {
            sfEffectSettings.sf2.fadeSec = Math.max(0.1, Math.min(10.0, parseFloat(e.target.value) || STRING_FADE_DEFAULT));
        } else {
            const val = parseInt(e.target.value,10) / 100;
            const isSf2 = id.includes('Sf2');
            const isReverb = id.startsWith('reverb');
            const group = isSf2 ? 'sf2' : 'sf1';
            sfEffectSettings[group][isReverb ? 'reverb' : 'sustain'] = val;
        }
        updateSfEffectUI();
        applyCurrentSfEffects();
    };
});
function setPianoVolumeValue(value){
    pianoVolume = Math.max(0, Math.min(1, parseInt(value,10) / 100));
    updateSfEffectUI();
}
function setStringVolumeValue(value){
    stringVolume = Math.max(0, Math.min(1, parseInt(value,10) / 100));
    updateSfEffectUI();
}
const pianoVolRange = document.getElementById('pianoVolRange');
const stringVolRange = document.getElementById('stringVolRange');
if(pianoVolRange) pianoVolRange.oninput=e=>setPianoVolumeValue(e.target.value);
if(stringVolRange) stringVolRange.oninput=e=>setStringVolumeValue(e.target.value);
const settingsPianoVolRange = document.getElementById('settingsPianoVolRange');
const settingsStringVolRange = document.getElementById('settingsStringVolRange');
const settingsSustainSf1Range = document.getElementById('settingsSustainSf1Range');
const settingsSustainSf2Range = document.getElementById('settingsSustainSf2Range');
if(settingsPianoVolRange) settingsPianoVolRange.oninput=e=>setPianoVolumeValue(e.target.value);
if(settingsStringVolRange) settingsStringVolRange.oninput=e=>setStringVolumeValue(e.target.value);
if(settingsSustainSf1Range) settingsSustainSf1Range.oninput=e=>{
    sfEffectSettings.sf1.sustain = parseInt(e.target.value,10) / 100;
    applyCurrentSfEffects();
    updateSfEffectUI();
};
if(settingsSustainSf2Range) settingsSustainSf2Range.oninput=e=>{
    sfEffectSettings.sf2.fadeSec = Math.max(0.1, Math.min(10.0, parseFloat(e.target.value) || 10.0));
    updateSfEffectUI();
};
updateSfEffectUI();
applyCurrentSfEffects();
let _keyPresetBtnsCache = null;
let pendingWCount = wCount;
function whiteCountToTuts(count, offset){
    const totalWhite = ALL_WHITE.length;
    const whiteCount = Math.max(1, Math.min(totalWhite, Math.round(Number(count) || wCount)));
    const start = Math.max(0, Math.min(totalWhite - whiteCount, Math.round(Number(offset ?? viewOffset) || 0)));
    const end = Math.min(totalWhite - 1, start + whiteCount - 1);
    return Math.max(1, ALL_WHITE[end] - ALL_WHITE[start] + 1);
}
function refreshKeyPresetUI(){
    if(!_keyPresetBtnsCache || !_keyPresetBtnsCache.length){
        _keyPresetBtnsCache = document.querySelectorAll('.key-preset-btn');
    }
    const btns = _keyPresetBtnsCache;
    for(let i=0; i<btns.length; i++){
        const btn = btns[i];
        const keyCount = parseInt(btn.dataset.keyCount,10);
        btn.classList.toggle('active', keyCount === pendingWCount);
        btn.textContent = whiteCountToTuts(keyCount);
    }
    const visibleTuts = whiteCountToTuts(pendingWCount);
    const wCEl = document.getElementById('wC');
    const settingsWCEl = document.getElementById('settingsWC');
    if(wCEl) wCEl.innerText = visibleTuts;
    if(settingsWCEl) settingsWCEl.innerText = visibleTuts;
    const dirty = pendingWCount !== wCount;
    document.querySelectorAll('.key-apply-btn').forEach(btn => {
        btn.classList.toggle('pending', dirty);
        btn.textContent = dirty ? ('Apply ' + visibleTuts + ' Tuts') : 'Tuts Applied';
    });
    refreshWideKeyModeClass();
}
function stageVisibleKeyCount(count){
    pendingWCount = Math.max(3, Math.min(52, parseInt(count,10) || pendingWCount || wCount));
    refreshKeyPresetUI();
}
function applyVisibleKeyCount(){
    const next = Math.max(3, Math.min(52, parseInt(pendingWCount,10) || wCount));
    if(next === wCount){ refreshKeyPresetUI(); return; }
    document.body.classList.add('layout-changing');
    pointerNoteMap.forEach((note) => release(note, noteElementMap.get(note)));
    pointerNoteMap.clear();
    wCount = next;
    clampOffset();
    if(!hasSwipeRange()){
        viewOffset = 0;
        swipeVisualOffset = 0;
        swipeVelocity = 0;
        swipeSetTransform(0);
    }
    updateKeyLayout();
    refreshKeyPresetUI();
    setTimeout(() => document.body.classList.remove('layout-changing'), 220);
}
document.querySelectorAll('.key-preset-btn').forEach(btn => btn.onclick=()=>stageVisibleKeyCount(btn.dataset.keyCount));
function stepVisibleKeyCount(delta){
    stageVisibleKeyCount(pendingWCount + delta);
}
document.getElementById('wU').onclick=()=>stepVisibleKeyCount(1);
document.getElementById('wD').onclick=()=>stepVisibleKeyCount(-1);
const settingsWU = document.getElementById('settingsWU');
const settingsWD = document.getElementById('settingsWD');
if(settingsWU) settingsWU.onclick=()=>stepVisibleKeyCount(1);
if(settingsWD) settingsWD.onclick=()=>stepVisibleKeyCount(-1);
const keyApplyBtn = document.getElementById('keyApply');
const settingsKeyApplyBtn = document.getElementById('settingsKeyApply');
if(keyApplyBtn) keyApplyBtn.onclick=applyVisibleKeyCount;
if(settingsKeyApplyBtn) settingsKeyApplyBtn.onclick=applyVisibleKeyCount;
refreshKeyPresetUI();
document.getElementById('tUp').onclick=()=>{ transpose++; document.getElementById('tVal').innerText=transpose; stopAllNotes(); build(); };
document.getElementById('tDown').onclick=()=>{ transpose--; document.getElementById('tVal').innerText=transpose; stopAllNotes(); build(); };
if(hRange){
    applyPianoHeight(hRange.value || 0);
}
function setAnimSizeValue(value){
    animSize = Math.max(5, Math.min(60, parseInt(value,10) || 18));
    const range = document.getElementById('sizeRange');
    const settingsRange = document.getElementById('settingsSizeRange');
    const sv = document.getElementById('animSizeVal');
    const settingsSv = document.getElementById('settingsAnimSizeVal');
    if(range) range.value = animSize;
    if(settingsRange) settingsRange.value = animSize;
    if(sv) sv.textContent = animSize;
    if(settingsSv) settingsSv.textContent = animSize;
}
document.getElementById('sizeRange').oninput=e=>setAnimSizeValue(e.target.value);
const settingsSizeRange = document.getElementById('settingsSizeRange');
if(settingsSizeRange) settingsSizeRange.oninput=e=>setAnimSizeValue(e.target.value);
function setKeyDustIntensity(value){
    keyDustIntensity = Math.max(1, Math.min(10, Math.round(Number(value) || 3)));
    const range = document.getElementById('keyDustRange');
    const label = document.getElementById('keyDustVal');
    const settingsRange = document.getElementById('settingsKeyDustRange');
    const settingsLabel = document.getElementById('settingsKeyDustVal');
    if(range) range.value = keyDustIntensity;
    if(label) label.textContent = keyDustIntensity + 'px';
    if(settingsRange) settingsRange.value = keyDustIntensity;
    if(settingsLabel) settingsLabel.textContent = keyDustIntensity + 'px';
    document.documentElement.style.setProperty('--saber-thickness', keyDustIntensity + 'px');
    updateSaberLine();
}
const keyDustRange = document.getElementById('keyDustRange');
if(keyDustRange) keyDustRange.addEventListener('input', () => setKeyDustIntensity(keyDustRange.value));
const settingsKeyDustRange = document.getElementById('settingsKeyDustRange');
if(settingsKeyDustRange) settingsKeyDustRange.addEventListener('input', () => setKeyDustIntensity(settingsKeyDustRange.value));
function setAnimationEnabled(value){
    isAnimOn = !!value;
    const track = document.getElementById('animTrack');
    if(track) track.classList.toggle('active', isAnimOn);
    const settingsTrack = document.getElementById('settingsAnimTrack');
    if(settingsTrack) settingsTrack.classList.toggle('active', isAnimOn);
}
const animTrack=document.getElementById('animTrack'); animTrack.onclick=()=>setAnimationEnabled(!isAnimOn);
const settingsAnimTrack = document.getElementById('settingsAnimTrack');
if(settingsAnimTrack) settingsAnimTrack.onclick=()=>setAnimationEnabled(!isAnimOn);
function setAnimRoundness(value){
    animRoundness = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    animShape = 'rounded';
    if(typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
    const range = document.getElementById('animRoundRange');
    const label = document.getElementById('animRoundVal');
    if(range) range.value = animRoundness;
    if(label) label.textContent = animRoundness + '%';
}
function setAnimShape(shape){
    animShape = 'rounded';
    setAnimRoundness(shape === 'rect' ? 0 : animRoundness);
}
function setNoteOpacity(value){
    noteOpacity = Math.max(10, Math.min(100, Math.round(Number(value) || 100)));
    const range = document.getElementById('noteOpacityRange');
    const label = document.getElementById('noteOpacityVal');
    if(range) range.value = noteOpacity;
    if(label) label.textContent = noteOpacity + '%';
    if(Array.isArray(falling)) falling.forEach(f => { f.opacity = noteOpacity; });
}
function setNoteSpeed(value){
    noteSpeed = clampPercentValue(value, 100);
    const range = document.getElementById('noteSpeedRange');
    const label = document.getElementById('noteSpeedVal');
    if(range) range.value = noteSpeed;
    if(label) label.textContent = noteSpeed + '%';
}
document.getElementById('animRoundRange')?.addEventListener('input', e => setAnimRoundness(e.target.value));
document.getElementById('noteOpacityRange')?.addEventListener('input', e => setNoteOpacity(e.target.value));
document.getElementById('noteSpeedRange')?.addEventListener('input', e => setNoteSpeed(e.target.value));
setAnimRoundness(animRoundness);
setNoteOpacity(noteOpacity);
setNoteSpeed(noteSpeed);
let saberColor = '#ffffff';
let dustColor = '#ffffff';
let saberEnabled = true;
let saberSmokeEnabled = true;
let saberDustEnabled = true;
let saberDustAmount = 50;
let saberAuraSize = 50;
let saberBrightness = 70;
let saberOpacity = 100;
let saberSaturation = 100;
let saberDustSize = 50;
let particleCount = 20;
let particleSize = 20;
let particleOpacity = 100;
let particleSpeed = 30;
let particleTurbulence = 30;
let particleSaturation = 100;
let particleFade = 20;

var saberMotion = 'static';
let motionSpeed = 50; // drives the strike aura's drift/billow speed
// "Motion Speed": 0..100 maps to a slow..fast aura billow duration. Higher = faster.
function setMotionSpeed(value){
    motionSpeed = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    // aura billow duration: speed 0 -> 7.2s (slow), speed 100 -> 1.6s (fast)
    const durSec = (7.2 - (motionSpeed / 100) * 5.6).toFixed(2);
    document.documentElement.style.setProperty('--saber-smoke-motion', durSec + 's');
    document.body.classList.toggle('saber-motion-off', motionSpeed <= 0);
    const range = document.getElementById('saberMotionRange');
    const label = document.getElementById('saberMotionVal');
    if(range && range.value !== String(motionSpeed)) range.value = String(motionSpeed);
    if(label) label.textContent = motionSpeed + '%';
}
setKeyDustIntensity(keyDustIntensity);
refreshKeyDustColorCache();

let perfHudEnabled = false;
let perfFps = 0;
let perfFrames = 0;
let perfLastTs = performance.now();
let perfRafId = null;
function updatePerfHudText(){
    const hud = document.getElementById('perfHud');
    if (!hud) return;
    const fpsEl = hud.querySelector('.perf-fps');
    if (fpsEl) fpsEl.textContent = `${Math.round(perfFps || 0)} FPS`;
}
function perfLoop(ts){
    if (!perfHudEnabled) { perfRafId = null; return; }
    perfFrames++;
    const elapsed = ts - perfLastTs;
    if (elapsed >= 700) {
        perfFps = perfFrames * 1000 / elapsed;
        perfFrames = 0;
        perfLastTs = ts;
        updatePerfHudText();
    }
    perfRafId = requestAnimationFrame(perfLoop);
}
function setPerformanceMonitor(on){
    perfHudEnabled = !!on;
    const hud = document.getElementById('perfHud');
    const track = document.getElementById('perfTrack');
    if (track) track.classList.toggle('active', perfHudEnabled);
    if (hud) hud.classList.toggle('show', perfHudEnabled);
    if (perfHudEnabled) {
        perfFrames = 0;
        perfLastTs = performance.now();
        updatePerfHudText();
        if (!perfRafId) perfRafId = requestAnimationFrame(perfLoop);
    }
}
const perfTrack = document.getElementById('perfTrack');
if (perfTrack) perfTrack.onclick = () => setPerformanceMonitor(!perfHudEnabled);
window.addEventListener('online', updatePerfHudText);
window.addEventListener('offline', updatePerfHudText);

const PRESET_STORAGE_KEY = 'papiano_memory_preset_v2';
const STORAGE_RESET_KEYS = ['papiano_memory_autosave_v2', 'papiano_memory_options_v2', 'papiano_settings'];
const STORAGE_SCHEMA_VERSION = 2;

const animModeBtns = { mDef:'default', mGlass:'glass', mOutline:'outline', mMidnight:'midnight', mGradient:'gradient', mRainbow:'rainbow', mDouble:'double' };
// Single-colour fill styles (use the chosen Note Color). Excludes rainbow
// (per-note hue) and double (split colours).
const SINGLE_COLOR_STYLES = ['default','glass','outline','midnight','gradient'];
const NO_COLOR="__none";
const colors=[NO_COLOR,"#ffffff","#00e5ff","#38bdf8","#2979ff","#651fff","#8b5cf6","#ff4081","#ff2d75","#ff1744","#ff6d00","#f7b733","#ffea00","#b2ff59","#00e676"];
function getDefaultPianoHeightPercent(){
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const vw = window.innerWidth;
    const isTouch = window.matchMedia('(pointer:coarse)').matches;
    // NOTE: this percentage is relative to getPianoMaxHeightPx() = 50% viewport,
    // so 48 means the piano is ~24% of screen height (Synthesia/See Music standard ~20-25%).
    if(!isTouch){
        const maxPx = Math.max(1, vh * 0.5);
        // 24% viewport, with a 220px floor so it isn't too short on small laptop screens
        return Math.min(60, Math.max(48, Math.round(220 / maxPx * 100)));
    }
    if(vw > vh) return 52; // landscape phone/tablet: ~26% viewport (selaras CSS boot 26vh)
    return Math.min(42, Math.max(32, Math.round(340 / vh * 100)));
}
function applyFactoryDefaults(clearSavedState){
    wCount = 52;
    pendingWCount = 52;
    viewOffset = 0;
    transpose = 0;
    document.getElementById('tVal').innerText = 0;
    currentPianoHeightPx = '';
    applyPianoHeight(getDefaultPianoHeightPercent());
    setPianoScalePercent();
    setBlackKeyWidthPercent(120);
    setBlackKeyHeightPercent(60);
    setPianoVisibilityPercent(100);
    document.getElementById('sizeRange').value = 18;
    animSize = 18;
    setAnimColor('#ffffff');
    setAnimDoubleLeftColor('#ffffff');
    setAnimDoubleRightColor('#ffffff');
    setAnimDoubleSplitTuts(44);
    setAnimModeById('mDef');
    if(typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
    setKeyDustIntensity(3);
    setSaberColor('#ffffff');
    setDustColor('#ffffff');
    setSaberMotion('static');
    setMotionSpeed(50);
    setDustBlendMode('glow');
    setSaberAuraSize(50);
    setSaberVisualSetting('brightness', 70);
    setSaberVisualSetting('opacity', 100);
    setSaberVisualSetting('saturation', 100);
    setParticleSetting('count', 20);
    setParticleSetting('size', 20);
    setParticleSetting('opacity', 100);
    setParticleSetting('speed', 30);
    setParticleSetting('turbulence', 30);
    setParticleSetting('saturation', 100);
    setParticleSetting('fade', 20);
    setSaberFx('saber', true);
    setSaberFx('dust', true);
    setAnimRoundness(100);
    setNoteOpacity(100);
    setNoteSpeed(75);
    setAnimShape('rounded');
    setWhiteKeyColor(NO_COLOR);
    setBlackKeyColor(NO_COLOR);
    setKeyGlowEnabled(false);
    setKeyGlowIntensity(50);
    sfEffectSettings.sf1 = {sustain:1.00, reverb:0.00};
    sfEffectSettings.sf2 = {fadeSec:2.00, reverb:0.00};
    currentSf = 'sf1';
    currentStringSf = 'stringSf1';
    pianoVolume = 1.00;
    stringVolume = 0.75;
    setManualSustain(false);
    setMidiSustainPedal(false);
    stringRangeLeft = 21;
    stringRangeRight = 108;
    stringEnabled = false;
    setStringLayerEnabled(false, true);
    updateSoundfontPickerUI();
    updateSfEffectUI();
    applyCurrentSfEffects();
    setLabelMode(isMobileRenderTarget() ? 'note' : 'qwerty');
    setPianoTheme('default');
    setChordDisplayColors(DEFAULT_CHORD_COLORS);
    if(typeof window.applyGraphicQuality === 'function') window.applyGraphicQuality('auto', true);
    if(clearSavedState) clearStoredSettings();
    setTimeout(() => { resize(); build(); refreshKeyPresetUI(); }, 50);
}

const colorPadInstances = new Map();
function clampColorPadValue(value, min, max){
    return Math.min(max, Math.max(min, value));
}
function colorPadToHex(value){
    return Math.round(clampColorPadValue(value, 0, 255)).toString(16).padStart(2, '0');
}
function colorPadHexToRgb(hex){
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function colorPadRgbToHex(rgb){
    return `#${colorPadToHex(rgb[0])}${colorPadToHex(rgb[1])}${colorPadToHex(rgb[2])}`;
}
function colorPadHslToRgb(hue, saturation, lightness){
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness - c / 2;
    let red = 0;
    let green = 0;
    let blue = 0;
    if(hue < 60){ red = c; green = x; }
    else if(hue < 120){ red = x; green = c; }
    else if(hue < 180){ green = c; blue = x; }
    else if(hue < 240){ green = x; blue = c; }
    else if(hue < 300){ red = x; blue = c; }
    else{ red = c; blue = x; }
    return [(red + m) * 255, (green + m) * 255, (blue + m) * 255];
}
function colorPadHsvToRgb(hue, sat, val){
    hue = ((hue % 360) + 360) % 360;
    sat = Math.max(0, Math.min(1, sat));
    val = Math.max(0, Math.min(1, val));
    const c = val * sat;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = val - c;
    let r = 0, g = 0, b = 0;
    if(hue < 60){ r = c; g = x; }
    else if(hue < 120){ r = x; g = c; }
    else if(hue < 180){ g = c; b = x; }
    else if(hue < 240){ g = x; b = c; }
    else if(hue < 300){ r = x; b = c; }
    else{ r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function colorPadRgbToHsv(rgb){
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const diff = max - min;
    let hue = 0;
    if(diff !== 0){
        if(max === r) hue = ((g - b) / diff) % 6;
        else if(max === g) hue = (b - r) / diff + 2;
        else hue = (r - g) / diff + 4;
        hue *= 60;
        if(hue < 0) hue += 360;
    }
    const sat = max === 0 ? 0 : diff / max;
    return { h: hue, s: sat, v: max };
}
function updateColorPadValue(id, color){
    const instance = colorPadInstances.get(id);
    if(!instance) return;
    const nextColor = normalizeHexColor(color) || '#ffffff';
    const hsv = colorPadRgbToHsv(colorPadHexToRgb(nextColor));
    if(typeof instance.applyHsv === 'function'){
        instance.applyHsv(hsv.h, hsv.s, hsv.v, false);
    }
}
function mountColorPad(id, label, initialColor, handler, resetColor){
    const host = document.getElementById(id);
    if(!host) return;
    const resetValue = normalizeHexColor(resetColor) || '#ffffff';
    const startColor = normalizeHexColor(initialColor) || resetValue;
    host.classList.add('color-pad-host');
    host.innerHTML = `
        <div class="color-pad-widget">
            <div class="color-pad-head"><span>${label}</span><span class="color-pad-value"></span></div>
            <div class="color-pad-sv" role="slider" aria-label="${label}" tabindex="0"><div class="color-pad-dot"></div></div>
            <div class="color-pad-hue" role="slider" aria-label="${label} hue" tabindex="0"><div class="color-pad-hue-dot"></div></div>
            <div class="color-pad-actions"><span class="color-pad-chip"></span><button class="color-pad-reset" type="button">Reset</button></div>
        </div>`;
    const pad = host.querySelector('.color-pad-sv');
    const dot = host.querySelector('.color-pad-dot');
    const hueBar = host.querySelector('.color-pad-hue');
    const hueDot = host.querySelector('.color-pad-hue-dot');
    const value = host.querySelector('.color-pad-value');
    const reset = host.querySelector('.color-pad-reset');
    const instance = { host, pad, dot, hueBar, hueDot, value, hue:0, sat:0, val:1, color:startColor, handler };
    colorPadInstances.set(id, instance);
    const renderSvBackground = () => {
        const hueHex = colorPadRgbToHex(colorPadHslToRgb(instance.hue, 1, 0.5));
        pad.style.background =
            `linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 100%),`+
            `linear-gradient(to right, #fff 0%, ${hueHex} 100%)`;
    };
    const composeColor = () => colorPadRgbToHex(colorPadHsvToRgb(instance.hue, instance.sat, instance.val));
    const syncUI = (emit) => {
        const color = composeColor();
        instance.color = color;
        host.style.setProperty('--pad-color', color);
        dot.style.left = `${instance.sat * 100}%`;
        dot.style.top = `${(1 - instance.val) * 100}%`;
        hueDot.style.left = `${(instance.hue / 360) * 100}%`;
        renderSvBackground();
        value.textContent = color;
        if(emit && typeof handler === 'function'){
            _activeColorPadIntent = 'user';
            try { handler(color); } finally { _activeColorPadIntent = null; }
        }
    };
    const applySV = (x, y, emit) => {
        instance.sat = clampColorPadValue(x, 0, 1);
        instance.val = 1 - clampColorPadValue(y, 0, 1);
        syncUI(emit);
    };
    const applyHue = (x, emit) => {
        instance.hue = clampColorPadValue(x, 0, 1) * 360;
        syncUI(emit);
    };
    instance.applyHsv = (h, s, v, emit) => {
        instance.hue = ((h % 360) + 360) % 360;
        instance.sat = clampColorPadValue(s, 0, 1);
        instance.val = clampColorPadValue(v, 0, 1);
        syncUI(emit);
    };
    // === Pointer-driven drag with global capture ===
    // Use a window-level listener while active so finger movement that leaves
    // the pad area (the most common "can't drag" case) is still tracked;
    // always preventDefault so the browser doesn't cancel it into a scroll.
    const makeDragger = (target, applyFromXY) => {
        let pid = -1;
        const onDown = event => {
            if(event.button !== undefined && event.button !== 0) return;
            pid = event.pointerId;
            try { target.setPointerCapture(pid); } catch(e){}
            event.preventDefault();
            applyFromXY(event.clientX, event.clientY);
            window.addEventListener('pointermove', onMove, { passive:false });
            window.addEventListener('pointerup', onUp, true);
            window.addEventListener('pointercancel', onUp, true);
        };
        const onMove = event => {
            if(event.pointerId !== pid) return;
            event.preventDefault();
            applyFromXY(event.clientX, event.clientY);
        };
        const onUp = event => {
            if(event.pointerId !== pid) return;
            try { target.releasePointerCapture(pid); } catch(e){}
            pid = -1;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp, true);
            window.removeEventListener('pointercancel', onUp, true);
        };
        target.addEventListener('pointerdown', onDown);
    };
    makeDragger(pad, (cx, cy) => {
        const rect = pad.getBoundingClientRect();
        applySV((cx - rect.left) / rect.width, (cy - rect.top) / rect.height, true);
    });
    makeDragger(hueBar, (cx) => {
        const rect = hueBar.getBoundingClientRect();
        applyHue((cx - rect.left) / rect.width, true);
    });
    pad.addEventListener('keydown', event => {
        const step = event.shiftKey ? 0.08 : 0.03;
        let s = instance.sat;
        let v = instance.val;
        if(event.key === 'ArrowLeft') s -= step;
        else if(event.key === 'ArrowRight') s += step;
        else if(event.key === 'ArrowUp') v += step;
        else if(event.key === 'ArrowDown') v -= step;
        else if(event.key === 'Home'){ s = 0; v = 1; }
        else if(event.key === 'End'){ s = 1; v = 0; }
        else return;
        event.preventDefault();
        instance.sat = clampColorPadValue(s, 0, 1);
        instance.val = clampColorPadValue(v, 0, 1);
        syncUI(true);
    });
    hueBar.addEventListener('keydown', event => {
        const step = event.shiftKey ? 18 : 6;
        let h = instance.hue;
        if(event.key === 'ArrowLeft') h -= step;
        else if(event.key === 'ArrowRight') h += step;
        else return;
        event.preventDefault();
        instance.hue = ((h % 360) + 360) % 360;
        syncUI(true);
    });
    reset.addEventListener('click', () => {
        updateColorPadValue(id, resetValue);
        if(typeof handler === 'function'){
            _activeColorPadIntent = 'reset';
            try { handler(resetValue); } finally { _activeColorPadIntent = null; }
        }
    });
    updateColorPadValue(id, startColor);
}
// Global intent indicator. null saat programmatic (load settings, defaults),
// 'user' saat user drag/click/keyboard di color pad, 'reset' saat user klik Reset.
var _activeColorPadIntent = null;

const DEFAULT_CHORD_COLORS = { primary:'#ffffff', secondary:'#ffffff' };
let chordDisplayColors = Object.assign({}, DEFAULT_CHORD_COLORS);
function setChordDisplayColors(colors){
    const source = colors || {};
    const primary = normalizeHexColor(source.primary) || DEFAULT_CHORD_COLORS.primary;
    const secondary = normalizeHexColor(source.secondary) || DEFAULT_CHORD_COLORS.secondary;
    chordDisplayColors = { primary, secondary };
    if(_activeColorPadIntent === 'user'){
        customChordColor = primary;
    } else if(_activeColorPadIntent === 'reset'){
        customChordColor = null;
    } else {
        // restore: treated as custom when it isn't the default white
        customChordColor = (primary.toLowerCase() !== '#ffffff' || secondary.toLowerCase() !== '#ffffff') ? primary : null;
    }
    document.documentElement.style.setProperty('--chord-primary', primary);
    document.documentElement.style.setProperty('--chord-secondary', secondary);
    document.documentElement.style.setProperty('--chord-glow', hexToRgbaString(primary, 0.36));
    updateColorPadValue('chordPrimaryColor', primary);
    updateColorPadValue('chordSecondaryColor', secondary);
    syncColorPadsToEffectiveColors();
}
function bindChordColorControls(){
    mountColorPad('chordPrimaryColor', 'Primary', chordDisplayColors.primary, color => setChordDisplayColors(Object.assign({}, chordDisplayColors, { primary: color })), DEFAULT_CHORD_COLORS.primary);
    mountColorPad('chordSecondaryColor', 'Secondary', chordDisplayColors.secondary, color => setChordDisplayColors(Object.assign({}, chordDisplayColors, { secondary: color })), DEFAULT_CHORD_COLORS.secondary);
    const reset = document.getElementById('chordColorReset');
    if(reset) reset.addEventListener('click', () => setChordDisplayColors(DEFAULT_CHORD_COLORS));
    setChordDisplayColors(chordDisplayColors);
}

function getCurrentSettings() {
    return {
        wCount,
        transpose,
        animSize,
        labelMode,
        sustainLevel,
        manualSustainEnabled,
        sfEffectSettings,
        pianoVolume,
        stringVolume,
        stringEnabled,
        stringRangeLeft,
        stringRangeRight,
        stringRangeSettingsVersion: STRING_RANGE_SETTINGS_VERSION,
        currentStringSf,
        reverbLevel: 0,
        reverbEnabled: false,
        isAnimOn,
        animStyle,
        animShape,
        animRoundness,
        noteOpacity,
        noteSpeed,
        keyDustIntensity,
        saberColor,
        dustColor,
        saberEnabled,
        saberDustEnabled,
        saberDustAmount,
        saberAuraSize,
        saberBrightness,
        saberOpacity,
        saberSaturation,
        saberDustSize,
        particleCount,
        particleSize,
        particleOpacity,
        particleSpeed,
        particleTurbulence,
        particleSaturation,
        particleFade,
        saberMotion,
        motionSpeed,
        dustBlendMode,
        currentGlassColor,
        pianoHeight: Math.max(6, Number(document.getElementById('hRange').value) || 50),
        blackKeyWidthPercent,
        blackKeyHeightPercent,
        pianoVisibilityPercent,
        accentWhite: getComputedStyle(document.documentElement).getPropertyValue('--accent-white').trim(),
        accentBlack: getComputedStyle(document.documentElement).getPropertyValue('--accent-black').trim(),
        animColor: getComputedStyle(document.documentElement).getPropertyValue('--anim-color').trim(),
        animDoubleLeftColor,
        animDoubleRightColor,
        animDoubleSplitTuts,
        currentSf,
        perfHudEnabled,
        performanceMode,
        graphicQuality,
        bgFitMode: typeof bgFitMode !== 'undefined' ? bgFitMode : 'cover',
        bgPositionMode: typeof bgPositionMode !== 'undefined' ? bgPositionMode : 'center',
        bgOpacity: Number(document.getElementById('bgOpacityRange')?.value ?? 100),
        bgDim: Number(document.getElementById('bgDimRange')?.value ?? 0),
        bgBlur: Number(document.getElementById('bgBlurRange')?.value ?? 0),
        chordDisplayColors: typeof chordDisplayColors !== 'undefined' ? chordDisplayColors : null,
        keyGlowEnabled,
        keyGlowIntensity,
        // Persist the explicit "user chose this colour" intent so a chosen
        // colour (even white) restores correctly instead of collapsing back to
        // the room seat colour on load.
        customAnimNote: typeof customAnimNote !== 'undefined' ? (customAnimNote || null) : null,
        customWhiteKey: typeof customWhiteKey !== 'undefined' ? (customWhiteKey || null) : null,
        customBlackKey: typeof customBlackKey !== 'undefined' ? (customBlackKey || null) : null,
        customChordColor: typeof customChordColor !== 'undefined' ? (customChordColor || null) : null,
        // Settings outside the Visual panel (top bar) so a preset is complete.
        metronome: (typeof window.getMetronomeState === 'function') ? window.getMetronomeState() : undefined,
        pianoTheme,
    };
}

const SF_URLS = {
    sf1: 'https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-mp3.js',
    sf2: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3.js',
    sf3: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js',
    sf4: 'https://gleitz.github.io/midi-js-soundfonts/FatBoy/bright_acoustic_piano-mp3.js',
    ep1: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_piano_1-mp3.js',
    ep2: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_piano_2-mp3.js',
    stringSf1: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3.js',
    stringSf2: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/string_ensemble_1-mp3.js',
    stringSf3: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/cello-mp3.js',
    stringSf4: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/viola-mp3.js',
    stringSf5: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/violin-mp3.js',
    stringSf6: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/pizzicato_strings-mp3.js',
    otherSf1: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3.js',
    otherSf2: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_steel-mp3.js',
    otherSf3: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_guitar_clean-mp3.js',
    otherSf4: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/overdriven_guitar-mp3.js',
    otherSf5: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_bass-mp3.js',
    otherSf6: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/electric_bass_finger-mp3.js',
    otherSf7: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/choir_aahs-mp3.js',
    otherSf8: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/flute-mp3.js',
    otherSf9: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/trumpet-mp3.js',
    otherSf10: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/marimba-mp3.js',
    otherSf11: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/vibraphone-mp3.js',
    otherSf12: 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/orchestral_harp-mp3.js',
};

function applySettings(s) {
    if (!s) return;
    try {
        const _wc = Number(s.wCount);
        wCount = (Number.isFinite(_wc) && _wc >= 3 && _wc <= 52) ? _wc : 52;
        pendingWCount = wCount;
        if (s.transpose !== undefined) { transpose = s.transpose; document.getElementById('tVal').innerText = transpose; }
        if (s.animSize !== undefined) { setAnimSizeValue(s.animSize); }
        if (s.labelMode !== undefined) {
            labelMode = ['off','note','qwerty'].includes(s.labelMode) ? s.labelMode : 'off';
            document.querySelectorAll('.label-option-vertical').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.mode === labelMode);
            });
        }
        if (s.sfEffectSettings) {
            if (s.sfEffectSettings.sf1) sfEffectSettings.sf1 = Object.assign(sfEffectSettings.sf1, s.sfEffectSettings.sf1);
            if (s.sfEffectSettings.sf2) {
                const loadedSf2 = Object.assign({}, s.sfEffectSettings.sf2);
                if (loadedSf2.fadeSec === undefined && loadedSf2.sustain !== undefined) loadedSf2.fadeSec = Math.max(0.1, Math.min(10.0, loadedSf2.sustain * 10.0));
                delete loadedSf2.sustain;
                sfEffectSettings.sf2 = Object.assign(sfEffectSettings.sf2, loadedSf2);
            }
        } else if (s.sustainLevel !== undefined) {
            sfEffectSettings.sf1.sustain = s.sustainLevel;
        }
        if (s.pianoVolume !== undefined) pianoVolume = Math.min(1, s.pianoVolume); else if (s.masterVolume !== undefined) pianoVolume = Math.min(1, s.masterVolume);
        if (s.stringVolume !== undefined) stringVolume = s.stringVolume;
        setManualSustain(!!s.manualSustainEnabled);
        if (Number(s.stringRangeSettingsVersion || 0) < STRING_RANGE_SETTINGS_VERSION) {
            stringRangeLeft = 21;
            stringRangeRight = 108;
        } else {
            if (s.stringRangeLeft !== undefined) stringRangeLeft = s.stringRangeLeft;
            if (s.stringRangeRight !== undefined) stringRangeRight = s.stringRangeRight;
        }
        updateStringRangeUI();
        stringEnabled = !!s.stringEnabled;
        updateSfEffectUI();
        applyCurrentSfEffects();
        if (s.isAnimOn !== undefined) { setAnimationEnabled(s.isAnimOn); }
        // Restore the note colour using the saved explicit intent when present
        // (new presets store customAnimNote): a saved colour — including white —
        // is re-applied as the user's choice, while "no custom" falls back to
        // the seat/default colour. Older presets keep the legacy value path.
        if (s.customAnimNote !== undefined) {
            _activeColorPadIntent = s.customAnimNote ? 'user' : 'reset';
            try { setAnimColor(s.customAnimNote || '#ffffff'); } finally { _activeColorPadIntent = null; }
        } else {
        setAnimColor(s.animColor !== undefined ? s.animColor : '#ffffff');
        }
        setAnimDoubleLeftColor(s.animDoubleLeftColor !== undefined ? s.animDoubleLeftColor : '#ffffff');
        setAnimDoubleRightColor(s.animDoubleRightColor !== undefined ? s.animDoubleRightColor : '#ffffff');
        setAnimDoubleSplitTuts(s.animDoubleSplitTuts !== undefined ? s.animDoubleSplitTuts : 44);
        if (typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
        if (s.animStyle !== undefined) {
            const LEGACY_STYLE = { single:'default', metalic:'default', crystal3d:'default', clean:'default', cleanNeon:'default', rainbow2:'rainbow', rainbowV2:'rainbow', glow:'gradient', neon:'gradient' };
            const styleMap = { default:'mDef', glass:'mGlass', outline:'mOutline', midnight:'mMidnight', gradient:'mGradient', rainbow:'mRainbow', double:'mDouble' };
            const resolved = LEGACY_STYLE[s.animStyle] || s.animStyle;
            setAnimModeById(styleMap[resolved] || 'mDef');
        }
        if (s.animShape !== undefined) setAnimShape(s.animShape);
        if (s.animRoundness !== undefined) setAnimRoundness(s.animRoundness); else setAnimRoundness(animRoundness);
        if (s.noteOpacity !== undefined) setNoteOpacity(s.noteOpacity); else setNoteOpacity(noteOpacity);
        if (s.noteSpeed !== undefined) setNoteSpeed(s.noteSpeed); else setNoteSpeed(noteSpeed);
        if (s.keyDustIntensity !== undefined) setKeyDustIntensity(s.keyDustIntensity); else setKeyDustIntensity(keyDustIntensity);
        if (s.saberColor !== undefined) setSaberColor(s.saberColor); else setSaberColor(saberColor);
        if (s.dustColor !== undefined) setDustColor(s.dustColor); else setDustColor(dustColor);
        if (s.saberEnabled !== undefined) saberEnabled = !!s.saberEnabled;
        if (s.saberDustEnabled !== undefined) saberDustEnabled = !!s.saberDustEnabled;
        if (s.saberAuraSize !== undefined) setSaberAuraSize(s.saberAuraSize); else setSaberAuraSize(saberAuraSize);
        setSaberVisualSetting('brightness', s.saberBrightness !== undefined ? s.saberBrightness : saberBrightness);
        setSaberVisualSetting('opacity', s.saberOpacity !== undefined ? s.saberOpacity : saberOpacity);
        setSaberVisualSetting('saturation', s.saberSaturation !== undefined ? s.saberSaturation : saberSaturation);
        if (s.saberDustSize !== undefined) setSaberDustSize(s.saberDustSize);
        else if (s.saberDustAmount !== undefined) setSaberDustSize(Number(s.saberDustAmount) <= 2 ? [25, 50, 100][Math.max(0, Math.min(2, Math.round(Number(s.saberDustAmount) || 0)))] : s.saberDustAmount);
        else setSaberDustSize(saberDustSize);
        setParticleSetting('count', s.particleCount !== undefined ? s.particleCount : particleCount);
        setParticleSetting('size', s.particleSize !== undefined ? s.particleSize : saberDustSize);
        setParticleSetting('opacity', s.particleOpacity !== undefined ? s.particleOpacity : particleOpacity);
        setParticleSetting('speed', s.particleSpeed !== undefined ? s.particleSpeed : particleSpeed);
        setParticleSetting('turbulence', s.particleTurbulence !== undefined ? s.particleTurbulence : particleTurbulence);
        setParticleSetting('saturation', s.particleSaturation !== undefined ? s.particleSaturation : particleSaturation);
        setParticleSetting('fade', s.particleFade !== undefined ? s.particleFade : particleFade);
        setDustBlendMode(s.dustBlendMode === 'solid' ? 'solid' : 'glow');
        setSaberMotion('static');
        setMotionSpeed(s.motionSpeed !== undefined ? s.motionSpeed : motionSpeed);
        syncSaberFxButtons();
        currentGlassColor = normalizeHexColor(s.currentGlassColor) || '#ffffff';
        const savedPianoHeight = Number(s.pianoHeight);
        if (Number.isFinite(savedPianoHeight) && savedPianoHeight > 5) { applyPianoHeight(savedPianoHeight); } else { applyPianoHeight(getDefaultPianoHeightPercent()); }
        setPianoScalePercent();
        setBlackKeyWidthPercent(s.blackKeyWidthPercent !== undefined ? s.blackKeyWidthPercent : 120);
        setBlackKeyHeightPercent(s.blackKeyHeightPercent !== undefined ? s.blackKeyHeightPercent : 60);
        setPianoVisibilityPercent(s.pianoVisibilityPercent !== undefined ? s.pianoVisibilityPercent : 100);
        if (s.customWhiteKey !== undefined) {
            _activeColorPadIntent = s.customWhiteKey ? 'user' : 'reset';
            try { setWhiteKeyColor(s.customWhiteKey || NO_COLOR); } finally { _activeColorPadIntent = null; }
        } else {
            setWhiteKeyColor(s.accentWhite !== undefined ? s.accentWhite : NO_COLOR);
        }
        if (s.customBlackKey !== undefined) {
            _activeColorPadIntent = s.customBlackKey ? 'user' : 'reset';
            try { setBlackKeyColor(s.customBlackKey || NO_COLOR); } finally { _activeColorPadIntent = null; }
        } else {
            setBlackKeyColor(s.accentBlack !== undefined ? s.accentBlack : NO_COLOR);
        }
        setKeyGlowEnabled(s.keyGlowEnabled !== undefined ? !!s.keyGlowEnabled : false);
        setKeyGlowIntensity(s.keyGlowIntensity !== undefined ? s.keyGlowIntensity : 50);
        if (s.customChordColor !== undefined) {
            _activeColorPadIntent = s.customChordColor ? 'user' : 'reset';
            try { setChordDisplayColors(s.chordDisplayColors || DEFAULT_CHORD_COLORS); } finally { _activeColorPadIntent = null; }
        } else if (s.chordDisplayColors) {
            setChordDisplayColors(s.chordDisplayColors);
        }
        if (s.metronome && typeof window.setMetronomeState === 'function') window.setMetronomeState(s.metronome);
        if (s.pianoTheme !== undefined) setPianoTheme(s.pianoTheme);
        if (s.perfHudEnabled !== undefined) setPerformanceMonitor(!!s.perfHudEnabled);
        // 'auto' retired: old presets that stored it fall back to smart detection.
        performanceMode = 'manual';
        // Only Potato and Default exist; old 'ultra' maps to Default, everything else (low/high/medium/mobile) to Potato.
        if (s.graphicQuality !== undefined) graphicQuality = (s.graphicQuality === 'default' || s.graphicQuality === 'ultra') ? 'default' : 'potato';
        setTimeout(() => {
            if (typeof setBgFitMode === 'function' && s.bgFitMode) setBgFitMode(s.bgFitMode);
            if (typeof setBgPositionMode === 'function' && s.bgPositionMode) setBgPositionMode(s.bgPositionMode);
            if (s.bgOpacity !== undefined && document.getElementById('bgOpacityRange')) document.getElementById('bgOpacityRange').value = s.bgOpacity;
            if (s.bgDim !== undefined && document.getElementById('bgDimRange')) document.getElementById('bgDimRange').value = s.bgDim;
            if (s.bgBlur !== undefined && document.getElementById('bgBlurRange')) document.getElementById('bgBlurRange').value = s.bgBlur;
            if (typeof applyBgImageSettings === 'function') applyBgImageSettings();
            if (typeof window.applyGraphicQuality === 'function') window.applyGraphicQuality(graphicQuality);
        }, 0);
        if (s.currentSf && SF_URLS[s.currentSf]) currentSf = s.currentSf;
        if (s.currentStringSf && SF_URLS[s.currentStringSf]) currentStringSf = s.currentStringSf;
        updateSoundfontPickerUI();
        if (currentSf !== loadedSfKey && SF_URLS[currentSf]) loadSoundfont(currentSf, SF_URLS[currentSf], null, 'piano');
        setStringLayerEnabled(stringEnabled, true);
        setTimeout(() => { resize(); build(); }, 50);
    } catch(e) {}
}

function clearStoredSettings(){
    STORAGE_RESET_KEYS.forEach(key => {
        try{ localStorage.removeItem(key); }catch(e){}
    });
}

function normalizeStoredPayload(payload){
    if(!payload || typeof payload !== 'object') return null;
    if(payload.version !== STORAGE_SCHEMA_VERSION || !payload.data || typeof payload.data !== 'object') return null;
    return payload.data;
}

function readStoredPayload(key){
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return normalizeStoredPayload(JSON.parse(raw));
}

function writeStoredPayload(key, data){
    localStorage.setItem(key, JSON.stringify({
        version: STORAGE_SCHEMA_VERSION,
        savedAt: Date.now(),
        data
    }));
}

function notifyPreset(message, type){
    showToast(message, { type: type || 'success', title: type === 'error' ? 'Preset' : 'Preset' });
}

function savePresetLocal(){
    writeStoredPayload(PRESET_STORAGE_KEY, getCurrentSettings());
}

function applyStoredSettings(settings){
    applySettings(settings);
}

function resetDefaultsFromMemory(){
    applyFactoryDefaults(true);
    notifyPreset('Defaults restored');
}

function saveMyPreset(){
    try{
        savePresetLocal();
        notifyPreset('Saved successfully');
    }catch(e){
        notifyPreset('Failed to save', 'error');
    }
}

function loadMyPreset(){
    try{
        const preset = readStoredPayload(PRESET_STORAGE_KEY);
        if(!preset){ notifyPreset('No saved preset', 'error'); return; }
        applyStoredSettings(preset);
        notifyPreset('Preset loaded');
    }catch(e){
        notifyPreset('Failed to load preset', 'error');
    }
}

function deleteMyPreset(){
    try{
        localStorage.removeItem(PRESET_STORAGE_KEY);
        notifyPreset('Preset deleted');
    }catch(e){
        notifyPreset('Storage is full', 'error');
    }
}

function bindMemoryControls(){
    document.getElementById('memoryResetDefaultsBtn')?.addEventListener('click', resetDefaultsFromMemory);
    document.getElementById('memorySavePresetBtn')?.addEventListener('click', saveMyPreset);
    document.getElementById('memoryLoadPresetBtn')?.addEventListener('click', loadMyPreset);
    document.getElementById('memoryDeletePresetBtn')?.addEventListener('click', deleteMyPreset);
    document.getElementById('resetBtn')?.addEventListener('click', resetDefaultsFromMemory);
    document.getElementById('saveBtn')?.addEventListener('click', saveMyPreset);
}

bindMemoryControls();
clearStoredSettings();
applyFactoryDefaults(false);
setTimeout(() => { if (document.body.classList.contains('mp-room-active') && typeof ensurePianoBootVisible === 'function') ensurePianoBootVisible(); }, 120);

bindChordColorControls();

function normalizeHexColor(hex){
    if(!hex) return null;
    let h=String(hex).trim();
    if(!h.startsWith('#')) return null;
    h=h.slice(1);
    if(h.length===3) h=h.split('').map(c=>c+c).join('');
    if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return '#'+h.toLowerCase();
}
function hexToRgbaString(hex, alpha){
    const c = normalizeHexColor(hex) || '#ffffff';
    const n = parseInt(c.slice(1),16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const a = Math.max(0, Math.min(1, Number(alpha) || 0));
    return `rgba(${r},${g},${b},${a})`;
}
function applySaberSaturation(hex, percent){
    const c = normalizeHexColor(hex) || '#ffffff';
    const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
    const n = parseInt(c.slice(1), 16);
    const r0 = (n >> 16) & 255, g0 = (n >> 8) & 255, b0 = n & 255;
    const gray = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;
    const sat = p * 1.38;
    const lift = p * 10;
    const r = Math.round(gray + (r0 - gray) * sat + lift);
    const g = Math.round(gray + (g0 - gray) * sat + lift);
    const b = Math.round(gray + (b0 - gray) * sat + lift);
    return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
}
function resetWhiteKeyBaseColor(){
    const root=document.documentElement.style;
    root.setProperty('--piano-white-top','#ffffff');
    root.setProperty('--piano-white-mid','#f7f8fa');
    root.setProperty('--piano-white-bottom','#e9ecef');
}
function resetBlackKeyBaseColor(){
    const root=document.documentElement.style;
    root.setProperty('--piano-black-top','#2d333d');
    root.setProperty('--piano-black-mid','#151a22');
    root.setProperty('--piano-black-bottom','#040506');
}
// === Custom user colour vs seat colour (multiplayer) =======================
// The seat colour is only the DEFAULT identity inside a room. Once the user
// picks their own colour in the Visual panel (INCLUDING WHITE), the user's
// choice WINS for their local view. Reset/preset returns to the seat colour.
// Other players still see this user's seat colour on their screens.
//
// Distinguish "default state" from "user explicitly chose a colour". White can
// also be chosen as custom. The only way back to the seat colour is the Reset
// button (which sets NO_COLOR).
var customWhiteKey = null;   // null = not custom yet (use seat) ; hex string = user-chosen colour
var customBlackKey = null;
var customAnimNote = null;
var customChordColor = null;
function selfSeatKeyColor(){
    if(customWhiteKey || customBlackKey) return ''; // user already customised → view follows global --accent-white
    return _mpSelfSeatColor || '';
}
function selfSeatNoteOpts(){
    // Apply the player's seat colour to all SINGLE-COLOUR styles (Single/Glass/
    // Outline/Midnight/Gradient), not just Single — so a styled note still
    // carries the player's identity colour in a room. Rainbow/Double bring
    // their own colours; a user-chosen custom Note Color also wins.
    if(customAnimNote) return {};
    if(typeof animStyle !== 'undefined' && !SINGLE_COLOR_STYLES.includes(animStyle)) return {};
    // Passed as seatColor (a base tint that keeps the chosen style) rather than
    // `color` (which would force the note to plain solid).
    return _mpSelfSeatColor ? { seatColor: _mpSelfSeatColor } : {};
}
function userCustomChordColor(){
    return customChordColor || '';
}
// Sync the color pad DISPLAY to the current effective colour:
// user custom if any, else the seat colour in the room, else the default.
// Display-only (updateColorPadValue doesn't call the handler), so it never
// changes the custom state.
function syncColorPadsToEffectiveColors(){
    try{
        const seat = _mpSelfSeatColor || '';
        updateColorPadValue('gridWhiteTuts', customWhiteKey || seat || '#ffffff');
        updateColorPadValue('gridBlackTuts', customBlackKey || seat || '#ffffff');
        if(typeof animStyle === 'undefined' || !animStyle || animStyle === 'default'){
            const cssAnim = getComputedStyle(document.documentElement).getPropertyValue('--anim-color').trim();
            updateColorPadValue('gridAnim', customAnimNote || seat || cssAnim || '#ffffff');
        }
        const chordBase = (typeof chordDisplayColors !== 'undefined' && chordDisplayColors) ? chordDisplayColors : { primary:'#ffffff', secondary:'#ffffff' };
        updateColorPadValue('chordPrimaryColor', customChordColor || seat || chordBase.primary || '#ffffff');
        updateColorPadValue('chordSecondaryColor', customChordColor ? chordBase.secondary : (seat || chordBase.secondary || '#ffffff'));
    }catch(e){}
}
function setWhiteKeyColor(color){
    const root=document.documentElement.style;
    resetWhiteKeyBaseColor();
    // Update the custom flag based on intent (call source):
    //   'user'  -> user picked a colour in the color pad (incl. white) -> custom
    //   'reset' -> clicked the Reset button                            -> back to seat
    //   null    -> load settings / factory defaults                    -> don't change
    if(_activeColorPadIntent === 'user'){
        customWhiteKey = (color === NO_COLOR || color === null) ? null : (normalizeHexColor(color) || null);
    } else if(_activeColorPadIntent === 'reset' || color === NO_COLOR || color === null){
        customWhiteKey = null;
    } else {
        // restore: hex != putih → custom; putih/null → bukan custom
        const n = (color === NO_COLOR || color === null) ? null : (normalizeHexColor(color) || null);
        customWhiteKey = (n && n.toLowerCase() !== '#ffffff') ? n : null;
    }
    if(color === NO_COLOR || color === null){
        root.setProperty('--accent-white','#ffffff');
        updateColorPadValue('gridWhiteTuts', '#ffffff');
        root.setProperty('--piano-white-active-top','#ffffff');
        root.setProperty('--piano-white-active-mid','#ffffff');
        root.setProperty('--piano-white-active-bottom','#ffffff');
        refreshKeyDustColorCache();
        syncColorPadsToEffectiveColors();
        return;
    }
    const c=normalizeHexColor(color) || '#ffffff';
    root.setProperty('--accent-white',c);
    updateColorPadValue('gridWhiteTuts', c);
    root.setProperty('--piano-white-active-top',c);
    root.setProperty('--piano-white-active-mid',c);
    root.setProperty('--piano-white-active-bottom',c);
    refreshKeyDustColorCache();
    syncColorPadsToEffectiveColors();
}
function setBlackKeyColor(color){
    const root=document.documentElement.style;
    resetBlackKeyBaseColor();
    if(_activeColorPadIntent === 'user'){
        customBlackKey = (color === NO_COLOR || color === null) ? null : (normalizeHexColor(color) || null);
    } else if(_activeColorPadIntent === 'reset' || color === NO_COLOR || color === null){
        customBlackKey = null;
    } else {
        const n = (color === NO_COLOR || color === null) ? null : (normalizeHexColor(color) || null);
        customBlackKey = (n && n.toLowerCase() !== '#ffffff') ? n : null;
    }
    if(color === NO_COLOR || color === null){
        root.setProperty('--accent-black','#ffffff');
        updateColorPadValue('gridBlackTuts', '#ffffff');
        root.setProperty('--piano-black-active-top','#ffffff');
        root.setProperty('--piano-black-active-mid','#ffffff');
        root.setProperty('--piano-black-active-bottom','#ffffff');
        refreshKeyDustColorCache();
        syncColorPadsToEffectiveColors();
        return;
    }
    const c=normalizeHexColor(color) || '#ffffff';
    root.setProperty('--accent-black',c);
    updateColorPadValue('gridBlackTuts', c);
    root.setProperty('--piano-black-active-top',c);
    root.setProperty('--piano-black-active-mid',c);
    root.setProperty('--piano-black-active-bottom',c);
    refreshKeyDustColorCache();
    syncColorPadsToEffectiveColors();
}
function populateGrid(id, handler){
    const labels = { gridWhiteTuts:'White Key Color', gridBlackTuts:'Black Key Color' };
    mountColorPad(id, labels[id] || 'Color', '#ffffff', color => handler(color), '#ffffff');
}
function getSaberAuraMetrics(){
    const level = sliderCurve(saberAuraSize, 1.04);
    // Aura height +50%: taller, softer aura at the same slider %.
    return {
        height: Math.round(33 * level),
        blur: Math.round(8 * level),
        shadowHeight: Math.round(12 * level),
        shadowBlur: Math.round(6 * level)
    };
}
function applySaberAuraHeight(){
    const m = getSaberAuraMetrics();
    document.documentElement.style.setProperty('--saber-aura-height', m.height + 'px');
    document.documentElement.style.setProperty('--saber-aura-blur', m.blur + 'px');
    document.documentElement.style.setProperty('--saber-shadow-height', m.shadowHeight + 'px');
    document.documentElement.style.setProperty('--saber-shadow-blur', m.shadowBlur + 'px');
}
function setSaberAuraSize(value){
    saberAuraSize = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    const range = document.getElementById('saberAuraRange');
    const label = document.getElementById('saberAuraVal');
    if(range) range.value = saberAuraSize;
    if(label) label.textContent = saberAuraSize + '%';
    applySaberAuraHeight();
    if(typeof updateSaberLine === 'function') updateSaberLine();
}
const saberAuraRange = document.getElementById('saberAuraRange');
if(saberAuraRange) saberAuraRange.addEventListener('input', () => setSaberAuraSize(saberAuraRange.value));
setSaberAuraSize(saberAuraSize);
function setSaberVisualSetting(name, value){
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    const map = {
        brightness: ['saberBrightness', 'saberBrightnessRange', 'saberBrightnessVal'],
        opacity: ['saberOpacity', 'saberOpacityRange', 'saberOpacityVal'],
        saturation: ['saberSaturation', 'saberSaturationRange', 'saberSaturationVal']
    };
    const meta = map[name];
    if(!meta) return;
    if(name === 'brightness') saberBrightness = v;
    else if(name === 'opacity') saberOpacity = v;
    else if(name === 'saturation') saberSaturation = v;
    const range = document.getElementById(meta[1]);
    const label = document.getElementById(meta[2]);
    if(range) range.value = v;
    if(label) label.textContent = v + '%';
    updateSaberLine();
}
function updateSaberLine(){
    window.updateSaberLine = updateSaberLine;
    const el = document.getElementById('saberLine');
    if(!el) return;
    const baseColor = normalizeHexColor(saberColor) || '#00e5ff';
    const saturatedColor = applySaberSaturation(baseColor, saberSaturation);
    const intensity = sliderRatio(saberBrightness) * 2; // Intensity +100%
    const opacityLevel = sliderRatio(saberOpacity);
    const auraLevel = sliderCurve(saberAuraSize, 1.04);
    const lineColor = saturatedColor;
    const rgb = hexToRgb(lineColor);
    const coreAlpha = Math.min(1, opacityLevel);
    const smokeAlphaA = opacityLevel * intensity * auraLevel * 0.54;
    const smokeAlphaB = opacityLevel * intensity * auraLevel * 0.34;
    const shadowAlphaA = opacityLevel * intensity * auraLevel * 0.40;
    const shadowAlphaB = opacityLevel * intensity * auraLevel * 0.22;
    const smokeA = hexToRgbaString(lineColor, Math.min(0.82, smokeAlphaA));
    const smokeB = hexToRgbaString(lineColor, Math.min(0.58, smokeAlphaB));
    const shadowA = hexToRgbaString(lineColor, Math.min(0.66, shadowAlphaA));
    const shadowB = hexToRgbaString(lineColor, Math.min(0.42, shadowAlphaB));
    const haloA = hexToRgbaString(lineColor, Math.min(1, opacityLevel * intensity * 0.94));
    const haloB = hexToRgbaString(lineColor, Math.min(0.88, opacityLevel * intensity * 0.72));
    const haloC = hexToRgbaString(lineColor, Math.min(0.66, opacityLevel * intensity * 0.52));
    const haloD = hexToRgbaString(lineColor, Math.min(0.44, opacityLevel * intensity * 0.34));
    const haloE = hexToRgbaString(lineColor, Math.min(0.28, opacityLevel * intensity * 0.21));
    const halo1px = Math.round(2 + intensity * 15);
    const halo2px = Math.round(4 + intensity * 32);
    const halo3px = Math.round(6 + intensity * 58);
    const halo4px = Math.round(8 + intensity * 94);
    const halo5px = Math.round(10 + intensity * 134);
    const px = Math.max(1, Math.min(10, Math.round(Number(keyDustIntensity) || 3)));

    document.documentElement.style.setProperty('--saber-color', lineColor);
    document.documentElement.style.setProperty('--saber-thickness', px + 'px');
    applySaberAuraHeight();
    // --saber-smoke-motion is owned by setMotionSpeed() (the Motion Speed slider).
    // The aura is now a soft billowing haze (transform animation), so the old
    // repeating wave-cell variables are no longer needed.
    document.body.classList.toggle('saber-off', !saberEnabled);
    document.body.classList.toggle('saber-smoke-off', !saberSmokeEnabled || auraLevel <= 0.001 || intensity <= 0.001 || opacityLevel <= 0.001);

    el.style.height = px + 'px';
    el.style.opacity = coreAlpha.toFixed(3);
    el.style.borderRadius = '999px';
    el.style.background = lineColor;
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundPosition = '50% 50%';
    const tightAlpha = Math.min(0.84, opacityLevel * (0.12 + intensity * 0.60));
    const tightColor = hexToRgbaString(lineColor, tightAlpha);
    el.style.boxShadow = [
        `0 0 2px ${tightColor}`,
        `0 0 ${halo1px}px ${haloA}`,
        `0 0 ${halo2px}px ${haloB}`,
        `0 0 ${halo3px}px ${haloC}`,
        `0 0 ${halo4px}px ${haloD}`,
        `0 0 ${halo5px}px ${haloE}`
    ].join(', ');
    el.style.filter = `saturate(${(1 + intensity * 0.55).toFixed(3)}) brightness(${(1 + intensity * 0.10).toFixed(3)})`;
    el.style.zIndex = '30';
    el.style.setProperty('--saber-r', rgb[0]);
    el.style.setProperty('--saber-g', rgb[1]);
    el.style.setProperty('--saber-b', rgb[2]);
    el.style.setProperty('--saber-smoke-a', smokeA);
    el.style.setProperty('--saber-smoke-b', smokeB);
    el.style.setProperty('--saber-shadow-a', shadowA);
    el.style.setProperty('--saber-shadow-b', shadowB);
}
function setSaberColor(color){
    saberColor = normalizeHexColor(color) || '#ffffff';
    updateColorPadValue('gridSaber', saberColor);
    updateSaberLine();
}
function setDustColor(color){
    dustColor = normalizeHexColor(color) || '#ffffff';
    updateColorPadValue('gridDust', dustColor);
    _dustSpriteCache.clear();
}
function syncSaberFxButtons(){
    const saberTrack = document.getElementById('saberEnabledTrack');
    const particleTrack = document.getElementById('particleEnabledTrack');
    const settingsSaberTrack = document.getElementById('settingsSaberTrack');
    const settingsDustTrack = document.getElementById('settingsDustTrack');
    const amountRange = document.getElementById('settingsDustAmountRange');
    const amountVal = document.getElementById('settingsDustAmountVal');
    if(saberTrack){ saberTrack.classList.toggle('active', saberEnabled); }
    if(settingsSaberTrack){ settingsSaberTrack.classList.toggle('active', saberEnabled); }
    if(settingsDustTrack){ settingsDustTrack.classList.toggle('active', saberDustEnabled); }
    if(particleTrack){ particleTrack.classList.toggle('active', saberDustEnabled); }
    const amountRangeMain = document.getElementById('dustAmountRange');
    const amountValMain = document.getElementById('dustAmountVal');
    if(amountRange) amountRange.value = particleCount;
    if(amountRangeMain) amountRangeMain.value = particleCount;
    const label = particleCount + '%';
    if(amountVal) amountVal.textContent = label;
    if(amountValMain) amountValMain.textContent = label;
}
function setSaberFx(part, value){
    if(part === 'saber') saberEnabled = !!value;
    else if(part === 'dust') saberDustEnabled = !!value;
    if(!saberDustEnabled){ neonDustCount = 0; neonDustEmitters.clear(); }
    syncSaberFxButtons();
    updateSaberLine();
}
function setParticleSetting(name, value){
    // Count & Size are capped at 50% (0-50 sliders); the rest stay 0-100.
    const maxV = (name === 'count' || name === 'size') ? 50 : 100;
    const v = Math.max(0, Math.min(maxV, Math.round(Number(value) || 0)));
    const map = {
        count: ['particleCount', 'particleCountRange', 'particleCountVal'],
        size: ['particleSize', 'particleSizeRange', 'particleSizeVal'],
        opacity: ['particleOpacity', 'particleOpacityRange', 'particleOpacityVal'],
        speed: ['particleSpeed', 'particleSpeedRange', 'particleSpeedVal'],
        turbulence: ['particleTurbulence', 'particleTurbulenceRange', 'particleTurbulenceVal'],
        saturation: ['particleSaturation', 'particleSaturationRange', 'particleSaturationVal'],
        fade: ['particleFade', 'particleFadeRange', 'particleFadeVal']
    };
    const meta = map[name];
    if(!meta) return;
    if(name === 'count') { particleCount = v; saberDustAmount = v; }
    else if(name === 'size') { particleSize = v; saberDustSize = v; _dustSpriteCache.clear(); }
    else if(name === 'opacity') { particleOpacity = v; }
    else if(name === 'speed') { particleSpeed = v; }
    else if(name === 'turbulence') { particleTurbulence = v; }
    else if(name === 'saturation') { particleSaturation = v; }
    else if(name === 'fade') { particleFade = v; }
    const range = document.getElementById(meta[1]);
    const label = document.getElementById(meta[2]);
    if(range) range.value = v;
    if(label) label.textContent = v + '%';
    syncSaberFxButtons();
}
function setSaberDustSize(value){
    setParticleSetting('size', value);
}
function setSaberDustAmount(value){
    setParticleSetting('count', value);
}
function setSaberMotion(mode){
    saberMotion = 'static';
    updateSaberLine();
}
function setDustBlendMode(mode){
    dustBlendMode = mode === 'glow' ? 'glow' : 'solid';
    const glowBtn = document.getElementById('dustBlendGlow');
    const solidBtn = document.getElementById('dustBlendSolid');
    if(glowBtn) glowBtn.classList.toggle('active', dustBlendMode === 'glow');
    if(solidBtn) solidBtn.classList.toggle('active', dustBlendMode === 'solid');
    // V2 'solid' draws dust IN FRONT of the falling notes — on the WebGL layer
    // that is a CSS z-index lift (the GL canvas is a separate layer).
    const _stageEl = document.querySelector('.stage');
    if(_stageEl) _stageEl.classList.toggle('dust-front', dustBlendMode === 'solid');
    if(typeof ensureAnimLoop === 'function' && falling.length > 0) ensureAnimLoop();
}
function setKeyGlowEnabled(on){
    keyGlowEnabled = !!on;
    document.body.classList.toggle('key-glow-on', keyGlowEnabled);
    const track = document.getElementById('keyGlowTrack');
    if(track){ track.classList.toggle('active', keyGlowEnabled); }
}
function setKeyGlowIntensity(v){
    const n = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    const boost = 1.75;
    const glowPower = n / 100 * boost;
    keyGlowIntensity = n;
    document.documentElement.style.setProperty('--key-glow-intensity', glowPower.toFixed(2));
    document.documentElement.style.setProperty('--key-glow-opacity', Math.min(1, glowPower).toFixed(2));
    document.documentElement.style.setProperty('--key-glow-spread', (n / 50 * boost).toFixed(2));
    const range = document.getElementById('keyGlowIntensityRange');
    const val = document.getElementById('keyGlowIntensityVal');
    if(range && range.value != n) range.value = n;
    if(val) val.textContent = n + '%';
}
function setAnimColor(color){
    const nextColor = normalizeHexColor(color) || '#ffffff';
    if(_activeColorPadIntent === 'user'){
        customAnimNote = nextColor;
    } else if(_activeColorPadIntent === 'reset'){
        customAnimNote = null;
    } else if(color === null || color === undefined){
        customAnimNote = null;
    } else {
        customAnimNote = (nextColor.toLowerCase() === '#ffffff') ? null : nextColor;
    }
    document.documentElement.style.setProperty('--anim-color', nextColor);
    refreshAnimColor();
    currentGlassColor = nextColor;
    syncFallingNoteVisualState();
    updateColorPadValue('gridAnim', nextColor);
    syncColorPadsToEffectiveColors();
}
function setAnimDoubleLeftColor(color){
    animDoubleLeftColor = normalizeHexColor(color) || '#ffffff';
    updateColorPadValue('gridAnimDoubleLeft', animDoubleLeftColor);
    if(animStyle === 'double') syncFallingNoteVisualState();
}
function setAnimDoubleRightColor(color){
    animDoubleRightColor = normalizeHexColor(color) || '#ffffff';
    updateColorPadValue('gridAnimDoubleRight', animDoubleRightColor);
    if(animStyle === 'double') syncFallingNoteVisualState();
}
function setAnimDoubleSplitTuts(value){
    animDoubleSplitTuts = clampStringTuts(value, animDoubleSplitTuts || 44);
    const range = document.getElementById('animDoubleSplitRange');
    if(range && range.value !== String(animDoubleSplitTuts)) range.value = animDoubleSplitTuts;
    if(animStyle === 'double') syncFallingNoteVisualState();
}
function updateAnimModeControls(){
    const showColor = SINGLE_COLOR_STYLES.includes(animStyle);
    const isDouble = animStyle === 'double';
    const rowAnimColor = document.getElementById('rowAnimColor');
    const rowAnimDoubleSplit = document.getElementById('rowAnimDoubleSplit');
    const rowAnimDoubleColors = document.getElementById('rowAnimDoubleColors');
    if(rowAnimColor) rowAnimColor.style.display = showColor ? '' : 'none';
    if(rowAnimDoubleSplit){
        rowAnimDoubleSplit.style.display = isDouble ? '' : 'none';
        rowAnimDoubleSplit.classList.toggle('active', isDouble);
    }
    if(rowAnimDoubleColors){
        rowAnimDoubleColors.style.display = isDouble ? '' : 'none';
        rowAnimDoubleColors.classList.toggle('active', isDouble);
    }
}
function populateAnimGrid(){
    mountColorPad('gridAnim', 'Note Color', '#ffffff', setAnimColor, '#ffffff');
}
function populateAnimDoubleGrids(){
    mountColorPad('gridAnimDoubleLeft', 'Left Color', animDoubleLeftColor, setAnimDoubleLeftColor, '#ffffff');
    mountColorPad('gridAnimDoubleRight', 'Right Color', animDoubleRightColor, setAnimDoubleRightColor, '#ffffff');
}
function populateSaberGrid(){
    mountColorPad('gridSaber', 'Strike Color', saberColor || '#ffffff', setSaberColor, '#ffffff');
}
function populateDustGrid(){
    mountColorPad('gridDust', 'Particle Color', dustColor || '#ffffff', setDustColor, '#ffffff');
}
populateGrid('gridWhiteTuts', setWhiteKeyColor); populateGrid('gridBlackTuts', setBlackKeyColor); populateAnimGrid(); populateAnimDoubleGrids(); populateSaberGrid(); populateDustGrid();
setAnimDoubleSplitTuts(animDoubleSplitTuts);
updateAnimModeControls();
document.getElementById('animDoubleSplitRange')?.addEventListener('input', e => setAnimDoubleSplitTuts(e.target.value));
document.getElementById('saberEnabledTrack')?.addEventListener('click', () => setSaberFx('saber', !saberEnabled));
document.getElementById('settingsSaberTrack')?.addEventListener('click', () => setSaberFx('saber', !saberEnabled));
document.getElementById('settingsDustTrack')?.addEventListener('click', () => setSaberFx('dust', !saberDustEnabled));
document.getElementById('particleEnabledTrack')?.addEventListener('click', () => setSaberFx('dust', !saberDustEnabled));
document.getElementById('dustBlendGlow')?.addEventListener('click', () => setDustBlendMode('glow'));
document.getElementById('dustBlendSolid')?.addEventListener('click', () => setDustBlendMode('solid'));
setDustBlendMode(dustBlendMode);
document.getElementById('keyGlowTrack')?.addEventListener('click', () => setKeyGlowEnabled(!keyGlowEnabled));
document.getElementById('keyGlowIntensityRange')?.addEventListener('input', e => setKeyGlowIntensity(e.target.value));
setKeyGlowEnabled(keyGlowEnabled);
setKeyGlowIntensity(keyGlowIntensity);
document.getElementById('settingsDustAmountRange')?.addEventListener('input', e => setSaberDustAmount(e.target.value));
document.getElementById('dustAmountRange')?.addEventListener('input', e => setSaberDustAmount(e.target.value));
document.getElementById('particleCountRange')?.addEventListener('input', e => setParticleSetting('count', e.target.value));
document.getElementById('particleSizeRange')?.addEventListener('input', e => setParticleSetting('size', e.target.value));
document.getElementById('particleOpacityRange')?.addEventListener('input', e => setParticleSetting('opacity', e.target.value));
document.getElementById('particleSpeedRange')?.addEventListener('input', e => setParticleSetting('speed', e.target.value));
document.getElementById('particleTurbulenceRange')?.addEventListener('input', e => setParticleSetting('turbulence', e.target.value));
document.getElementById('particleSaturationRange')?.addEventListener('input', e => setParticleSetting('saturation', e.target.value));
document.getElementById('particleFadeRange')?.addEventListener('input', e => setParticleSetting('fade', e.target.value));
document.getElementById('saberBrightnessRange')?.addEventListener('input', e => setSaberVisualSetting('brightness', e.target.value));
document.getElementById('saberOpacityRange')?.addEventListener('input', e => setSaberVisualSetting('opacity', e.target.value));
document.getElementById('saberSaturationRange')?.addEventListener('input', e => setSaberVisualSetting('saturation', e.target.value));
document.getElementById('saberMotionRange')?.addEventListener('input', e => setMotionSpeed(e.target.value));
setSaberVisualSetting('brightness', saberBrightness);
setSaberVisualSetting('opacity', saberOpacity);
setSaberVisualSetting('saturation', saberSaturation);
setMotionSpeed(motionSpeed);
setParticleSetting('count', particleCount);
setParticleSetting('size', particleSize);
setParticleSetting('opacity', particleOpacity);
setParticleSetting('speed', particleSpeed);
setParticleSetting('turbulence', particleTurbulence);
setParticleSetting('saturation', particleSaturation);
setParticleSetting('fade', particleFade);
syncSaberFxButtons();
updateSaberLine();

currentGlassColor = currentGlassColor || '#ffffff';
if(animStyle === 'crystal3d' || animStyle === 'cleanNeon' || animStyle === 'clean' || animStyle === 'rainbowV2') animStyle = animStyle === 'rainbowV2' ? 'rainbow' : 'default';
function updateAnimMode(id){
    Object.keys(animModeBtns).forEach(b=>{ const el=document.getElementById(b); if(el) el.classList.toggle('active',b===id); });
    document.querySelectorAll('.settings-anim-style').forEach(btn => btn.classList.toggle('active', btn.dataset.styleTarget === id));
    updateAnimModeControls();
}
function setAnimModeById(id){
    if(id === 'mRainbowV2') id = 'mRainbow';
    const mode = animModeBtns[id];
    if(!mode) return;
    refreshAnimColor();
    animStyle = mode;
    syncFallingNoteVisualState();
    _tunedCacheR = _tunedCacheG = _tunedCacheB = -1;
    _tunedCacheSat = _tunedCacheBright = -1;
    if(ctx2d){
        ctx2d.globalAlpha = 1;
        ctx2d.globalCompositeOperation = 'source-over';
    }
    renderNow = performance.now();
    updateAnimMode(id);
    if(typeof ensureAnimLoop === 'function') ensureAnimLoop();
}
Object.entries(animModeBtns).forEach(([id]) => {
    const el = document.getElementById(id);
    if (el) el.onclick = () => setAnimModeById(id);
});
document.querySelectorAll('.settings-anim-style').forEach(btn => {
    btn.onclick = () => setAnimModeById(btn.dataset.styleTarget);
});

const customBgLayer=document.getElementById('customBgLayer');
const customBgDimLayer=document.getElementById('customBgDimLayer');
const bgImgInput=document.getElementById('bgImgInput');
const bgImgRemove=document.getElementById('bgImgRemove');
const bgOpacityRange=document.getElementById('bgOpacityRange');
const bgOpacityVal=document.getElementById('bgOpacityVal');
const bgDimRange=document.getElementById('bgDimRange');
const bgDimVal=document.getElementById('bgDimVal');
const bgBlurRange=document.getElementById('bgBlurRange');
const bgBlurVal=document.getElementById('bgBlurVal');
let customBgUrl=null;
let bgFitMode='cover';
let bgPositionMode='center';
function setBgFitMode(mode){
    bgFitMode = ['cover','contain','stretch'].includes(mode) ? mode : 'cover';
    if(customBgLayer) customBgLayer.style.backgroundSize = bgFitMode === 'stretch' ? '100% 100%' : bgFitMode;
    document.querySelectorAll('.bg-fit-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.bgFit === bgFitMode));
}
function setBgPositionMode(mode){
    bgPositionMode = ['center','top','bottom'].includes(mode) ? mode : 'center';
    if(customBgLayer) customBgLayer.style.backgroundPosition = bgPositionMode === 'top' ? 'center top' : (bgPositionMode === 'bottom' ? 'center bottom' : 'center center');
    document.querySelectorAll('.bg-pos-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.bgPosition === bgPositionMode));
}
function applyBgImageSettings(){
    const opacity=Math.max(0,Math.min(100,Number(bgOpacityRange?.value ?? 100)));
    const dim=Math.max(0,Math.min(100,Number(bgDimRange?.value ?? 0)));
    const blur=Math.max(0,Math.min(20,Number(bgBlurRange?.value ?? 0)));
    document.documentElement.style.setProperty('--custom-bg-opacity', opacity/100);
    document.documentElement.style.setProperty('--custom-bg-dim', dim/100);
    document.documentElement.style.setProperty('--custom-bg-blur', blur+'px');
    document.documentElement.style.setProperty('--custom-bg-scale', blur>0 ? '1.04' : '1');
    if(bgOpacityVal) bgOpacityVal.textContent=opacity+'%';
    if(bgDimVal) bgDimVal.textContent=dim+'%';
    if(bgBlurVal) bgBlurVal.textContent=blur+'px';
    setBgFitMode(bgFitMode);
    setBgPositionMode(bgPositionMode);
}
bgImgInput?.addEventListener('change',(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    if(customBgUrl) URL.revokeObjectURL(customBgUrl);
    customBgUrl=URL.createObjectURL(file);
    customBgLayer.style.backgroundImage=`url('${customBgUrl}')`;
    customBgLayer.classList.add('active');
    if(bgImgRemove) bgImgRemove.style.display='';
    document.querySelector('.stage')?.classList.add('has-custom-bg');
    applyBgImageSettings();
    bgImgInput.value='';
});
bgImgRemove?.addEventListener('click',()=>{
    customBgLayer.style.backgroundImage='';
    customBgLayer.classList.remove('active');
    if(customBgUrl) URL.revokeObjectURL(customBgUrl);
    customBgUrl=null;
    if(bgImgRemove) bgImgRemove.style.display='none';
    document.querySelector('.stage')?.classList.remove('has-custom-bg');
});
[bgOpacityRange,bgDimRange,bgBlurRange].forEach(el=>el?.addEventListener('input',applyBgImageSettings));
document.querySelectorAll('.bg-fit-btn').forEach(btn => btn.addEventListener('click', () => setBgFitMode(btn.dataset.bgFit)));
document.querySelectorAll('.bg-pos-btn').forEach(btn => btn.addEventListener('click', () => setBgPositionMode(btn.dataset.bgPosition)));
applyBgImageSettings();

const QWERTY_INPUT_MAP = new Map(Object.entries(QWERTY_LABEL_MAP).map(([midi, raw]) => [raw, Number(midi)]));
const qwertyHeldByCode = new Map();
const qwertyIgnoreTargets = new Set(['INPUT','TEXTAREA','SELECT']);

function getKeyboardBaseKey(e) {
    if (!e || !e.code) return '';
    if (e.code.startsWith('Key')) return e.code.slice(3).toUpperCase();
    if (e.code.startsWith('Digit')) return e.code.slice(5);
    return '';
}

function getQwertyRawFromEvent(e) {
    const base = getKeyboardBaseKey(e);
    if (!base) return '';
    if (e.ctrlKey) return 'C+' + base;
    if (e.shiftKey) return 'S+' + base;
    return /^[A-Z]$/.test(base) ? base.toLowerCase() : base;
}

function shouldSkipQwertyInput(e) {
    const t = e.target;
    if (!t) return false;
    return qwertyIgnoreTargets.has(t.tagName) || t.isContentEditable;
}

window.addEventListener('keydown', e => {
    if (!isPianoInputAllowed() || shouldSkipQwertyInput(e) || e.repeat) return;
    const raw = getQwertyRawFromEvent(e);
    const midi = QWERTY_INPUT_MAP.get(raw);
    if (!midi) return;
    e.preventDefault();
    if (qwertyHeldByCode.has(e.code)) return;
    const el = noteElementMap.get(midi);
    qwertyHeldByCode.set(e.code, { midi, el });
    press(midi, el);
}, { passive: false, capture: false });

window.addEventListener('keyup', e => {
    const held = qwertyHeldByCode.get(e.code);
    if (!held) return;
    e.preventDefault();
    release(held.midi, held.el || noteElementMap.get(held.midi));
    qwertyHeldByCode.delete(e.code);
}, { passive: false, capture: false });

window.addEventListener('blur', () => {
    qwertyHeldByCode.forEach(({ midi, el }) => release(midi, el || noteElementMap.get(midi)));
    qwertyHeldByCode.clear();
}, { passive: true });

const pianoWrap = document.getElementById('pianoWrap');
const pointerNoteMap = new Map();

function hitTestPiano(clientX, clientY) {
    const localY = clientY - keyHitCache.wrapTop;
    if (localY < 0 || localY > keyHitCache.wrapHeight) return null;
    const pianoX = clientX - keyHitCache.wrapLeft + currentPianoTransformPx;
    if (pianoX < 0 || pianoX > keyHitCache.totalWidth) return null;

    const whiteIdx = findWhiteIndexAtPianoX(pianoX);

    if (localY < keyHitCache.blackBottom) {
        const checks = [whiteIdx, whiteIdx + 1, whiteIdx - 1];
        for(let i=0; i<checks.length; i++){
            const b = keyHitCache.blackByBoundary[checks[i]];
            if (b && pianoX >= b.left && pianoX < b.right) return b;
        }
    }

    if(whiteIdx >= 0 && whiteIdx < ALL_WHITE.length){
        const midi = ALL_WHITE[whiteIdx];
        return { midi, el: keyElFast[midi] || noteElementMap.get(midi) };
    }
    return null;
}

pianoWrap.addEventListener('pointerdown', e => {
    e.preventDefault();
    if(!isPianoInputAllowed()) return;
    if(!keyHitCache.wrapHeight) updateKeyHitCache();
    const hit = hitTestPiano(e.clientX, e.clientY);
    if (!hit) return;

    pointerNoteMap.set(e.pointerId, hit.midi);
    press(hit.midi, hit.el);
    try { pianoWrap.setPointerCapture(e.pointerId); } catch(_){}
}, { passive: false });

const _glissandoPendingPointers = new Map();
let _glissandoRafScheduled = false;
function _flushGlissandoPointerMoves(){
    _glissandoRafScheduled = false;
    _glissandoPendingPointers.forEach((pos, pid) => {
        if (!pointerNoteMap.has(pid)) return;
        const prevNote = pointerNoteMap.get(pid);
        const hit = hitTestPiano(pos.clientX, pos.clientY);
        if (!hit) {
            release(prevNote, keyElFast[prevNote] || noteElementMap.get(prevNote));
            pointerNoteMap.delete(pid);
            return;
        }
        if (hit.midi !== prevNote) {
            release(prevNote, keyElFast[prevNote] || noteElementMap.get(prevNote));
            pointerNoteMap.set(pid, hit.midi);
            press(hit.midi, hit.el);
        }
    });
    _glissandoPendingPointers.clear();
}

pianoWrap.addEventListener('pointermove', e => {
    if (!pointerNoteMap.has(e.pointerId)) return;
    e.preventDefault();
    _glissandoPendingPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (!_glissandoRafScheduled) {
        _glissandoRafScheduled = true;
        requestAnimationFrame(_flushGlissandoPointerMoves);
    }
}, { passive: false });

function pianoPointerEnd(e) {
    const note = pointerNoteMap.get(e.pointerId);
    if (note !== undefined) {
        release(note, keyElFast[note] || noteElementMap.get(note));
        pointerNoteMap.delete(e.pointerId);
    }
    _glissandoPendingPointers.delete(e.pointerId);
}
pianoWrap.addEventListener('pointerup', pianoPointerEnd, { passive: true });
pianoWrap.addEventListener('pointercancel', pianoPointerEnd, { passive: true });
const strip = document.getElementById('swipeStrip');

let swipeActive = false;
let swipeStartX = 0;
let swipeVelocity = 0;
let swipePrevX = 0;
let swipePrevTime = 0;
let swipeRafId = null;
let swipeVisualOffset = 0;
let swipeSnapRafId = null;

pianoEl.style.transition = 'none';

function hasSwipeRange() {
    return whiteKeyWidth > 0 && getSwipeMaxOffset() > 0.0001;
}

function swipeSetTransform(px) {
    if(!hasSwipeRange()) px = 0;
    currentPianoTransformPx = px;
    pianoEl.style.transform = `translate3d(-${px}px,0,0)`;
    syncActiveKeyLayerTransform(px);
    if(falling.length > 0) ensureAnimLoop();
}

function swipeGetBase() {
    return hasSwipeRange() ? getViewOffsetPx(viewOffset) : 0;
}

function swipeClampOffset(offset) {
    return Math.max(0, Math.min(getSwipeMaxOffset(), offset));
}

function swipeClampVisual(value) {
    if(!hasSwipeRange()) return 0;
    const maxOffset = getSwipeMaxOffset();
    const currentOffsetPx = getViewOffsetPx(viewOffset);
    const maxDragRight = currentOffsetPx;
    const maxDragLeft = getViewOffsetPx(maxOffset) - currentOffsetPx;
    if (value > maxDragRight) return maxDragRight + (value - maxDragRight) * 0.25;
    if (value < -maxDragLeft) return -maxDragLeft;
    return value;
}

function swipeSnapToNearest() {
    if(!hasSwipeRange()) {
        viewOffset = 0;
        swipeVisualOffset = 0;
        swipeVelocity = 0;
        swipeSetTransform(0);
        updateNoteXCache();
        return;
    }
    const draggedWhiteKeys = -swipeVisualOffset / whiteKeyWidth;
    const targetOffset = swipeClampOffset(Math.round(viewOffset + draggedWhiteKeys));
    const fromPx = currentPianoTransformPx;
    const toPx = getViewOffsetPx(targetOffset);
    viewOffset = targetOffset;
    swipeVisualOffset = 0;

    clearTimeout(swipeNoteXUpdateTimer);
    if (swipeSnapRafId) cancelAnimationFrame(swipeSnapRafId);
    pianoEl.style.transition = 'none';

    const startTime = performance.now();
    const duration = 120;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const px = fromPx + (toPx - fromPx) * easeOut(t);
        swipeSetTransform(px);
        if (t < 1) {
            swipeSnapRafId = requestAnimationFrame(step);
        } else {
            swipeSnapRafId = null;
            swipeSetTransform(toPx);
            updateNoteXCache();
        }
    }
    swipeSnapRafId = requestAnimationFrame(step);
}
function swipeMomentumScroll() {
    if(!hasSwipeRange()) { swipeVelocity = 0; swipeVisualOffset = 0; swipeSetTransform(0); return; }
    if (!swipeActive && Math.abs(swipeVelocity) > 0.5) {
        swipeVelocity *= 0.91;
        swipeVisualOffset = swipeClampVisual(swipeVisualOffset + swipeVelocity);
        swipeSetTransform(swipeGetBase() - swipeVisualOffset);

        if (Math.abs(swipeVelocity) < 0.9) {
            swipeVelocity = 0;
            swipeSnapToNearest();
            return;
        }
        swipeRafId = requestAnimationFrame(swipeMomentumScroll);
    }
}

strip.addEventListener('pointerdown', e => {
    if(!hasSwipeRange()) {
        e.preventDefault();
        e.stopPropagation();
        swipeActive = false;
        swipeVelocity = 0;
        swipeVisualOffset = 0;
        swipeSetTransform(0);
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    strip.setPointerCapture(e.pointerId);
    swipeActive = true;
    swipeStartX = e.clientX;
    swipePrevX = e.clientX;
    swipePrevTime = performance.now();
    swipeVelocity = 0;
    swipeVisualOffset = 0;
    if (swipeRafId) cancelAnimationFrame(swipeRafId);
    if (swipeSnapRafId) { cancelAnimationFrame(swipeSnapRafId); swipeSnapRafId = null; }
    pianoEl.style.transition = 'none';
}, { passive: false });

strip.addEventListener('pointermove', e => {
    if (!swipeActive) return;
    e.preventDefault();
    e.stopPropagation();

    const now = performance.now();
    const dt = now - swipePrevTime;
    const dx = e.clientX - swipePrevX;

    if (dt > 0) swipeVelocity = dx * (16 / dt);
    swipePrevX = e.clientX;
    swipePrevTime = now;

    const totalDrag = e.clientX - swipeStartX;
    swipeVisualOffset = swipeClampVisual(totalDrag);

    swipeSetTransform(swipeGetBase() - swipeVisualOffset);
}, { passive: false });

strip.addEventListener('pointerup', e => {
    if (!swipeActive) return;
    swipeActive = false;

    if (Math.abs(swipeVelocity) > 8) {
        swipeRafId = requestAnimationFrame(swipeMomentumScroll);
    } else {
        swipeSnapToNearest();
    }
});

strip.addEventListener('pointercancel', e => {
    if (!swipeActive) return;
    swipeActive = false;
    swipeVelocity = 0;
    swipeSnapToNearest();
});

const NOTE_NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']; const chordMode='crazy'; // mode tunggal: deteksi beta/crazy
const CHORD_DB=[
{s:[0,4,7,10,21],n:'13',m:'pro'},
{s:[0,3,7,10,21],n:'m13',m:'pro'},
{s:[0,4,7,11,21],n:'Maj13',m:'pro'},
{s:[0,4,7,10,14,17,21],n:'13',m:'pro'},
{s:[0,4,7,11,14,17,21],n:'Maj13',m:'pro'},
{s:[0,3,7,10,14,17,21],n:'m13',m:'pro'},
{s:[0,4,7,10,13,17,21],n:'13b9',m:'pro'},
{s:[0,4,7,10,15,17,21],n:'13#9',m:'pro'},
{s:[0,4,7,10,14,18,21],n:'13#11',m:'pro'},
{s:[0,4,7,10,13,18,21],n:'13b9#11',m:'pro'},
{s:[0,4,7,10,15,18,21],n:'13#9#11',m:'pro'},
{s:[0,4,7,11,14,18,21],n:'Maj13#11',m:'pro'},
{s:[0,4,7,10,18],n:'7#11',m:'pro'},
{s:[0,4,7,11,18],n:'Maj7#11',m:'pro'},
{s:[0,4,7,10,17],n:'7add11',m:'pro'},
{s:[0,3,7,10,17],n:'m7add11',m:'pro'},
{s:[0,4,7,10,14,17],n:'11',m:'pro'},
{s:[0,4,7,11,14,17],n:'Maj11',m:'pro'},
{s:[0,3,7,10,14,17],n:'m11',m:'pro'},
{s:[0,3,7,11,14,17],n:'m(Maj11)',m:'pro'},
{s:[0,4,7,10,14,18],n:'9#11',m:'pro'},
{s:[0,4,7,11,14,18],n:'Maj9#11',m:'pro'},
{s:[0,3,7,10,14,18],n:'m11b5',m:'pro'},
{s:[0,3,6,10,14],n:'m9b5',m:'pro'},
{s:[0,4,7,10,13,18],n:'7b9#11',m:'pro'},
{s:[0,4,7,10,15,18],n:'7#9#11',m:'pro'},
{s:[0,4,5,7],n:'add11',m:'medium'},
{s:[0,3,5,7],n:'madd11',m:'medium'},
{s:[0,4,7,9,14],n:'6/9',m:'pro'},
{s:[0,3,7,9,14],n:'m6/9',m:'pro'},
{s:[0,4,7,14],n:'add9',m:'medium'},
{s:[0,3,7,14],n:'madd9',m:'medium'},
{s:[0,4,7,11,14],n:'Maj9',m:'pro'},
{s:[0,3,7,10,14],n:'m9',m:'pro'},
{s:[0,3,7,11,14],n:'m(Maj9)',m:'pro'},
{s:[0,3,7,11,21],n:'m(Maj7)',m:'pro'},
{s:[0,4,7,10,14],n:'9',m:'medium'},
{s:[0,4,7,10,13],n:'7b9',m:'pro'},
{s:[0,4,7,10,15],n:'7#9',m:'pro'},
{s:[0,4,7,11,13],n:'Maj7b9',m:'pro'},
{s:[0,4,7,11,15],n:'Maj7#9',m:'pro'},
{s:[0,3,7,10,13],n:'m7b9',m:'pro'},
{s:[0,5,7,10,14],n:'9sus4',m:'pro'},
{s:[0,2,7,10,14],n:'9sus2',m:'pro'},
{s:[0,5,7,11,14],n:'Maj9sus4',m:'pro'},
{s:[0,4,6,10,14],n:'9b5',m:'pro'},
{s:[0,4,8,10,14],n:'9#5',m:'pro'},
{s:[0,4,8,10,13],n:'7#5b9',m:'pro'},
{s:[0,4,8,10,15],n:'7#5#9',m:'pro'},
{s:[0,4,6,10,15],n:'7b5#9',m:'pro'},
{s:[0,4,7,10,20],n:'7b13',m:'pro'},
{s:[0,4,8,10,20],n:'7#5b13',m:'pro'},
{s:[0,4,7,10,13,20],n:'7b9b13',m:'pro'},
{s:[0,4,7,10,15,20],n:'7#9b13',m:'pro'},
{s:[0,4,7,10,14,20],n:'9b13',m:'pro'},
{s:[0,4,7,10],n:'7',m:'medium'},
{s:[0,4,7,11],n:'Maj7',m:'medium'},
{s:[0,3,7,10],n:'m7',m:'medium'},
{s:[0,3,7,11],n:'m(Maj7)',m:'pro'},
{s:[0,3,6,9],n:'dim7',m:'medium'},
{s:[0,3,6,11],n:'dim(Maj7)',m:'pro'},
{s:[0,3,6,10],n:'m7b5',m:'medium'},
{s:[0,4,8,10],n:'7#5',m:'pro'},
{s:[0,4,6,10],n:'7b5',m:'pro'},
{s:[0,4,8,11],n:'Maj7#5',m:'pro'},
{s:[0,4,6,11],n:'Maj7b5',m:'pro'},
{s:[0,5,7,10],n:'7sus4',m:'medium'},
{s:[0,2,7,10],n:'7sus2',m:'pro'},
{s:[0,4,6,10,13],n:'7b9b5',m:'pro'},
{s:[0,4,7,9],n:'6',m:'medium'},
{s:[0,3,7,9],n:'m6',m:'medium'},
{s:[0,4,7],n:'Maj',m:'biasa'},
{s:[0,3,7],n:'m',m:'biasa'},
{s:[0,3,6],n:'dim',m:'biasa'},
{s:[0,4,8],n:'aug',m:'biasa'},
{s:[0,7],n:'5',m:'biasa'},
{s:[0,2,7],n:'sus2',m:'biasa'},
{s:[0,5,7],n:'sus4',m:'biasa'}
];
function modeLevel(m){ return { biasa:1, medium:2, pro:3, crazy:4 }[m]||0; }
CHORD_DB.forEach(cd => {
    cd._level = modeLevel(cd.m);
    cd._pcMask = cd.s.reduce((mask, iv) => mask | (1 << (iv % 12)), 0);
});
function pitchClassesFromMask(mask){
    const pcs=[];
    for(let i=0;i<12;i++) if(mask & (1 << i)) pcs.push(i);
    return pcs;
}
function rotatePcMask(mask, root){
    let out = 0;
    for(let i=0;i<12;i++) if(mask & (1 << i)) out |= 1 << ((root + i) % 12);
    return out;
}
function chordNoSuffix(suffix, missing){
    if(!missing||missing.length===0) return suffix;
    const clean=[...new Set(missing)].sort((a,b)=>a-b);
    if(clean.length===1 && clean[0]===5 && /^(7|Maj7|m7)$/.test(suffix)) return suffix;
    const noText=clean.map(n=>'no'+n).join(',');
    if(suffix==='m(Maj9)') return 'mMaj9('+noText+')';
    if(suffix==='m(Maj7)') return 'mMaj7('+noText+')';
    return suffix+'('+noText+')';
}
function chordSuffixClean(suffix){
    if(suffix==='7#5b13') return '7#5';
    if(suffix==='9#5b13') return '9#5';
    return suffix;
}
function chordComplexityPenalty(suffix){
    let p=0;
    p+=(suffix.match(/\//g)||[]).length*12;
    p+=(suffix.match(/\(/g)||[]).length*10;
    p+=(suffix.match(/no/g)||[]).length*16;
    p+=(suffix.match(/[b#]/g)||[]).length*4;
    if(suffix.length>8) p+=Math.floor((suffix.length-8)*1.5);
    return p;
}
function chordScore(match){
    let score=0;
    score+=match.patternLen*12;
    score+=match.source==='exact'?220:0;
    score+=match.source==='beta'?-74:0;
    score+=match.isInversion?-24:120;
    if(match.bassNote===match.root) score+=44;
    if(match.noList&&match.noList.includes(5)) score-=8;
    if(match.noList&&match.noList.includes(3)) score-=42;
    if(match.noList&&match.noList.includes(7)) score-=78;
    score-=chordComplexityPenalty(match.suffix);
    if(match.suffix==='Maj') score+=8;
    if(match.suffix==='add9'||match.suffix==='madd9') score+=16;
    if(match.suffix==='Maj9'||match.suffix==='m9'||match.suffix==='9') score+=14;
    if(match.suffix==='13'||match.suffix==='m13'||match.suffix==='Maj13') score+=22;
    if(match.suffix==='7#11'||match.suffix==='Maj7#11'||match.suffix==='9#11'||match.suffix==='Maj9#11') score+=26;
    if(match.suffix==='7add11') score+=14;
    if(match.suffix==='7b5'||match.suffix==='9b5') score+=8;
    if(match.suffix==='7b13'||match.suffix==='9b13') score+=34;
    if(match.suffix==='m(Maj7)' && match.patternLen>=5) score+=38;
    if(match.rawSuffix==='7#5b13') score-=30;
    return score;
}
function betaPush(results, root, suffix, rawSuffix, bassNote, patternLen, noList){
    results.push({root,suffix,rawSuffix,bassNote,isInversion:false,patternLen,source:'beta',noList:noList||[]});
}
function addBetaOmitCandidates(results, pcs, bassNote){
    if(chordMode!=='crazy'||pcs.length<4) return;
    for(let root=0;root<12;root++){
        const intervals=new Set(pcs.map(pc=>(pc-root+12)%12));
        const has=iv=>intervals.has(iv);
        if(!has(0)) continue;
        const hasMaj3=has(4), hasMin3=has(3), hasP5=has(7), hasb7=has(10), hasMaj7=has(11);
        const has9=has(2), has11=has(5), has13=has(9);

        if(hasP5 && hasb7 && !hasMaj3 && !hasMin3){
            if(has9 && has13) betaPush(results, root, '13(no3)', '13', bassNote, 6, [3]);
            else if(has13) betaPush(results, root, '13(no3)', '13', bassNote, 5, [3]);
            else if(has9) betaPush(results, root, '9(no3)', '9', bassNote, 5, [3]);
        }

        if(!hasP5 && (hasMaj3||hasMin3)){
            if(hasb7 && has9 && has13) betaPush(results, root, '13(no5)', '13', bassNote, 6, [5]);
            else if(hasb7 && has9) betaPush(results, root, '9(no5)', '9', bassNote, 5, [5]);
            else if(hasMaj7 && has9 && hasMaj3) betaPush(results, root, 'Maj9(no5)', 'Maj9', bassNote, 5, [5]);
            else if(hasMaj7 && has9 && hasMin3) betaPush(results, root, 'mMaj9(no5)', 'm(Maj9)', bassNote, 5, [5]);
            else if(hasb7 && has9 && hasMin3) betaPush(results, root, 'm9(no5)', 'm9', bassNote, 5, [5]);
        }

        if(hasP5 && (hasMaj3||hasMin3) && !hasb7 && !hasMaj7 && has9 && has11 && has13){
            betaPush(results, root, (hasMin3?'m13(no7)':'13(no7)'), (hasMin3?'m13':'13'), bassNote, 6, [7]);
        }
    }
}
function isStrongExactCandidate(match, pcs){
    if(!match || match.source!=='exact' || match.noList?.length) return false;
    if(match.isInversion) return false;
    if(match.patternLen < pcs.length) return false;
    if(chordComplexityPenalty(match.suffix)>18) return false;
    return true;
}
function isTritoneRoot(a,b){ return ((a-b+12)%12)===6; }
function isNoChord(match){ return !!(match&&match.noList&&match.noList.length); }
function isAlteredOrLydianDominant(suffix){ return /#11|b5|#5|b9|#9|b13/.test(suffix||''); }
function filterReadableChordResults(list, pcs){
    if(!list.length) return list;
    const primary=list[0];
    const primaryScore=chordScore(primary);
    const filtered=[primary];

    if(primary.source==='beta' || isNoChord(primary)) return filtered;

    for(let i=1;i<list.length;i++){
        const cand=list[i];
        const candScore=chordScore(cand);
        if(isNoChord(cand) && cand.root!==primary.root) continue;
        if(cand.source==='beta' && primary.source==='exact') continue;

        if(isTritoneRoot(cand.root, primary.root) && isAlteredOrLydianDominant(cand.suffix)) continue;
        if(isTritoneRoot(cand.root, primary.root) && isAlteredOrLydianDominant(primary.suffix)) continue;

        if(primary.source==='exact' && !primary.isInversion && cand.isInversion && candScore < primaryScore-34) continue;

        if(candScore < primaryScore-54) continue;
        filtered.push(cand);
        if(filtered.length>=2) break;
    }
    return filtered;
}
function matchChords(midiArr){
    if(midiArr.length<3) return [];
    let pcMask = 0;
    let bassMidi = midiArr[0];
    for(let i=0;i<midiArr.length;i++){
        const midi = midiArr[i];
        if(midi < bassMidi) bassMidi = midi;
        pcMask |= 1 << (((midi % 12) + 12) % 12);
    }
    const pcs = pitchClassesFromMask(pcMask);
    const bassNote = ((bassMidi % 12) + 12) % 12;
    const results=[];
    const isCrazy=chordMode==='crazy';
    const activeLevel = modeLevel(chordMode);
    for(let r=0;r<12;r++){
        const root=r;
        let intervalMask = 0;
        for(let i=0;i<midiArr.length;i++){
            const pc = ((midiArr[i] % 12) + 12) % 12;
            const base = (pc - root + 12) % 12;
            intervalMask |= 1 << base;
            const upper = base + 12;
            if(upper <= 22) intervalMask |= 1 << upper;
        }
        for(let ci=0;ci<CHORD_DB.length;ci++){
            const cd=CHORD_DB[ci];
            if(cd._level<=activeLevel){
                const missingNo=[];
                let match=true;
                for(let si=0;si<cd.s.length;si++){
                    const iv = cd.s[si];
                    if(intervalMask & (1 << iv)) continue;
                    if(isCrazy&&iv===7){ missingNo.push(5); continue; }
                    match=false;
                    break;
                }
                if(!match) continue;
                const patternMask = rotatePcMask(cd._pcMask, root);
                if((pcMask & ~patternMask) !== 0) continue;
                const rawSuffix=cd.n;
                const cleanSuffix=chordSuffixClean(rawSuffix);
                const noList=[...new Set(missingNo)].sort((a,b)=>a-b);
                const suffix=isCrazy&&noList.length ? chordNoSuffix(cleanSuffix, noList) : cleanSuffix;
                const source=noList.length?'beta':'exact';
                const suppressBetaSlash=source==='beta' && ((pcMask & (1 << root)) !== 0);
                const isInversion=bassNote!==root && !suppressBetaSlash;
                results.push({root,suffix,rawSuffix,bassNote,isInversion,patternLen:cd.s.length,source,noList});
            }
        }
    }

    const strongExact=results.some(r=>isStrongExactCandidate(r, pcs));
    if(!strongExact) addBetaOmitCandidates(results, pcs, bassNote);

    const modeSafeResults=chordMode==='crazy' ? results : results.filter(r=>r.source!=='beta' && !(r.noList&&r.noList.length) && !/\(no\d/.test(r.suffix));
    modeSafeResults.sort((a,b)=>{
        const scoreDiff=chordScore(b)-chordScore(a);
        if(scoreDiff) return scoreDiff;
        if(a.isInversion!==b.isInversion) return a.isInversion?1:-1;
        return b.patternLen-a.patternLen;
    });
    const seen=new Set(), deduped=[];
    for(const r of modeSafeResults){
        const hasRealSlash=r.isInversion && r.bassNote!==r.root;
        const baseName=NOTE_NAMES[r.root]+r.suffix+(hasRealSlash?('/'+NOTE_NAMES[r.bassNote]):'');
        if(!seen.has(baseName)){
            seen.add(baseName);
            deduped.push(r);
        }
    }
    return filterReadableChordResults(deduped, pcs).slice(0,2);
}
function formatChord(match){ const rootName=NOTE_NAMES[match.root]; const chordName=rootName+match.suffix; if(match.isInversion&&match.bassNote!==match.root) return chordName+'/'+NOTE_NAMES[match.bassNote]; return chordName; }
// Chord toggle On/Off (persisted)
var _chordEnabled = (function(){ try{ return localStorage.getItem('papianoChordOn') !== '0'; }catch(e){ return true; } })();
(function initChordToggle(){
    var track = document.getElementById('chordTrack');
    if(!track) return;
    function sync(){ track.classList.toggle('active', _chordEnabled); }
    sync();
    track.onclick = function(){ _chordEnabled = !_chordEnabled; try{ localStorage.setItem('papianoChordOn', _chordEnabled ? '1' : '0'); }catch(e){} sync(); if(!_chordEnabled){ var el1=document.getElementById('chordPrimary'); var el2=document.getElementById('chordSecondary'); if(el1){el1.classList.remove('show');el1.textContent='';} if(el2){el2.classList.remove('show');el2.textContent='';} } };
})();

let midiAccess = null;
let midiEnabled = false;
const midiBtn = document.getElementById('midiBtn');
function _attachMidiInputs(){
    if(!midiAccess) return;
    // Property assignment (not addEventListener) so re-running never stacks
    // duplicate listeners on the same input.
    midiAccess.inputs.forEach(input => { input.onmidimessage = (msg) => _handleMidiMessage(msg.data); });
}
function _detachMidiInputs(){
    if(!midiAccess) return;
    midiAccess.inputs.forEach(input => { input.onmidimessage = null; });
}
function _onMidiStateChange(){
    // A device was (un)plugged or one that failed earlier is now ready — re-scan
    // and re-attach so MIDI reconnects without a reload/relog.
    if(midiEnabled) _attachMidiInputs();
}
function _setMidiUiActive(on){ if(midiBtn) midiBtn.classList.toggle('active', !!on); }

// Web MIDI handler, extracted so the dispatch logic is unit-testable. Note: we
// deliberately do NOT filter GM channel 10 here. A live controller or DAW track
// can legitimately transmit piano notes on channel 10, and dropping it makes
// such keyboards appear dead; phantom-note problems from a specific MIDI FILE
// are the player's file/router config, not something the web app should mask by
// discarding a whole channel.
function _handleMidiMessage(data){
    if(!data || data.length < 1) return;
    const statusByte = data[0];
    const data1 = data[1];
    const data2 = data[2];
    const status = statusByte & 0xF0;
    const note = data1;
    const velocity = data2 || 0;
    if(!isPianoInputAllowed()) return;
    if (status === 0xB0 && data1 === 64) {
        setMidiSustainPedal(velocity >= 64);
        isSus = manualSustainEnabled || midiSustainPedalDown;
        requestChordUpdate();
        return;
    }
    if (status === 0x90 && velocity > 0) {
        const burst = markInputBurst();
        midiPedalHeldNotes.delete(note);
        const visualNote = note + transpose;
        const keyEl = keyElCache.get(visualNote);
        playNote(note, transpose, velocity / 127);
        playPressVisual(visualNote, keyEl, burst);
        if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendNoteOn === 'function') window.PapianoMultiplayer.sendNoteOn(visualNote, velocity / 127);
    } else if ((status === 0x80) || (status === 0x90 && velocity === 0)) {
        markInputBurst();
        const visualNote = note + transpose;
        if (midiSustainPedalDown) midiPedalHeldNotes.add(note);
        else stopNote(note);
        const keyEl = keyElCache.get(visualNote);
        playReleaseVisual(visualNote, keyEl);
        if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendNoteOff === 'function') window.PapianoMultiplayer.sendNoteOff(visualNote);
    }
}
window._handleMidiMessage = _handleMidiMessage;

midiBtn.onclick = () => {
    if(!midiEnabled){
        if(!navigator.requestMIDIAccess){
            _setMidiUiActive(false);
            showToast('This browser does not support the Web MIDI API. Try Chrome or Edge on desktop.', { type:'error', title:'MIDI not supported' });
            return;
        }
        midiEnabled = true;
        _setMidiUiActive(true);
        // Reuse an existing access object (instant re-enable + still hot-plug aware).
        if(midiAccess){ _attachMidiInputs(); return; }
        navigator.requestMIDIAccess().then(midi => {
            midiAccess = midi;
            midi.onstatechange = _onMidiStateChange;
            if(midiEnabled) _attachMidiInputs(); else _detachMidiInputs();
        }).catch(() => {
            midiEnabled = false;
            _setMidiUiActive(false);
            showToast('MIDI access was denied or is unavailable. Check your browser permissions.', { type:'error', title:'MIDI unavailable' });
        });
    } else {
        midiEnabled = false;
        _setMidiUiActive(false);
        _detachMidiInputs();
        setMidiSustainPedal(false);
        stopAllNotes();
    }
};

(function(){
    const fsBtn = document.getElementById('fsBtn');
    if (!fsBtn) return;
    let fsRequested = false;
    let fsTimer = null;

    function apiFullscreen(){
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    }
    function displayModeFullscreen(){
        return (window.matchMedia && (
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: standalone)').matches
        ));
    }
    function viewportLooksFullscreen(){
        const vv = window.visualViewport;
        const vw = Math.round(vv ? vv.width : window.innerWidth);
        const vh = Math.round(vv ? vv.height : window.innerHeight);
        const sw = Math.max(1, Math.round(screen.width || 1));
        const sh = Math.max(1, Math.round(screen.height || 1));
        const saw = Math.max(1, Math.round(screen.availWidth || sw));
        const sah = Math.max(1, Math.round(screen.availHeight || sh));
        const area = vw * vh;
        const screenArea = sw * sh;
        const availArea = saw * sah;
        const nearScreen = area >= screenArea * 0.92 || area >= availArea * 0.96;
        const nearHeight = vh >= Math.min(sh, sah) * 0.96 || vh >= Math.max(sh, sah) * 0.92;
        const nearWidth = vw >= Math.min(sw, saw) * 0.96 || vw >= Math.max(sw, saw) * 0.92;
        return nearScreen || (nearWidth && nearHeight);
    }
    function isFullscreen(){
        return apiFullscreen() || displayModeFullscreen() || viewportLooksFullscreen() || fsRequested;
    }
    function setFsClass(on){
        document.documentElement.classList.toggle('papiano-fullscreen', on);
        document.body.classList.toggle('papiano-fullscreen', on);
        fsBtn.classList.toggle('fs-hidden', on);
    }
    function updateFullscreenButton(){
        const nativeOn = apiFullscreen() || displayModeFullscreen() || viewportLooksFullscreen();
        if (nativeOn) fsRequested = true;
        if (!nativeOn && fsRequested && !document.hasFocus()) fsRequested = false;
        const on = isFullscreen();
        setFsClass(on);
        fsBtn.style.display = on ? 'none' : 'inline-flex';
        fsBtn.textContent = 'Fullscreen';
        fsBtn.title = 'Fullscreen';
    }
    function scheduleFullscreenChecks(){
        clearInterval(fsTimer);
        let ticks = 0;
        fsTimer = setInterval(() => {
            updateFullscreenButton();
            ticks++;
            if (ticks > 16) clearInterval(fsTimer);
        }, 180);
    }
    fsBtn.onclick = () => {
        const el = document.documentElement;
        fsRequested = true;
        updateFullscreenButton();
        scheduleViewportGeometrySync();
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if(req) {
            const result = req.call(el);
            if (result && result.catch) result.catch(()=>{});
        }
        setTimeout(() => {
            if (!apiFullscreen() && !displayModeFullscreen() && !viewportLooksFullscreen()) fsRequested = false;
            updateFullscreenButton();
        }, 1400);
        scheduleFullscreenChecks();
        scheduleViewportGeometrySync();
    };
    ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange','visibilitychange'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (!apiFullscreen() && !displayModeFullscreen() && !viewportLooksFullscreen()) fsRequested = false;
            updateFullscreenButton();
            scheduleViewportGeometrySync();
        });
    });
    ['resize','orientationchange','pageshow'].forEach(evt => window.addEventListener(evt, () => {
        if (!apiFullscreen() && !displayModeFullscreen() && !viewportLooksFullscreen()) fsRequested = false;
        setTimeout(() => { updateFullscreenButton(); scheduleViewportGeometrySync(); }, 80);
    }, { passive:true }));
    updateFullscreenButton();
})();

(function(){
    const btns = { gfxPotato:'potato', gfxDefault:'default' };
    const lowHiddenRows = ['rowAnimEffect','rowAnimTone','rowKeyGlow'];
    // Potato locks & hides the heavy-FX menus (particles + strike line) so they
    // can't be enabled in the limited tier.
    const lowHiddenSelectors = ['[data-visual-open="particle"]', '[data-visual-open="saber"]'];
    const mediumHiddenRows = [];
    function effectiveQuality(){ return typeof getEffectiveGraphicQuality === 'function' ? getEffectiveGraphicQuality() : graphicQuality; }
    function refreshGraphicButtons(){
        Object.entries(btns).forEach(([id, val]) => {
            const b = document.getElementById(id);
            if(!b) return;
            b.classList.toggle('active', val === graphicQuality);
        });
    }
    function setDisplayById(id, visible){
        const el = document.getElementById(id);
        if(!el) return;
        el.style.display = visible ? '' : 'none';
    }
    function applyGraphicModeDefaults(q){
        const cfg = GRAPHIC_MODE_DEFAULTS[q] || GRAPHIC_MODE_DEFAULTS.medium;
        setKeyGlowEnabled(false);
        setSaberFx('dust', cfg.dust);
        setParticleSetting('count', cfg.particleCount);
        setParticleSetting('size', cfg.particleSize);
        setParticleSetting('opacity', cfg.particleOpacity);
        setParticleSetting('speed', cfg.particleSpeed);
        setParticleSetting('turbulence', cfg.particleTurbulence);
        setParticleSetting('saturation', cfg.particleSaturation);
        setParticleSetting('fade', cfg.particleFade);
        setSaberAuraSize(cfg.saberAuraSize);
        setSaberVisualSetting('brightness', cfg.saberBrightness);
        setSaberVisualSetting('opacity', cfg.saberOpacity);
        setSaberVisualSetting('saturation', cfg.saberSaturation);
        syncSaberFxButtons();
        updateSaberLine();
        if(typeof ensureAnimLoop === 'function' && falling.length > 0) ensureAnimLoop();
    }
    function syncEffectiveGraphicState(prevDPR){
        const q = effectiveQuality();
        document.documentElement.setAttribute('data-graphic-quality', q);
        const nextDPR = typeof getRenderDPR === 'function' ? getRenderDPR() : prevDPR;
        if(nextDPR !== prevDPR){
            if(typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
            if(typeof _dustSpriteCache !== 'undefined' && _dustSpriteCache.clear) _dustSpriteCache.clear();
            if(typeof syncCanvasSize === 'function') syncCanvasSize(false);
        }
        refreshGraphicButtons();
    }
    function updateManualQualityUi(q, destructive){
        const isLow = q === 'potato';
        const isMed = q === 'medium';
        if(destructive){
            lowHiddenRows.forEach(id => setDisplayById(id, !isLow));
            lowHiddenSelectors.forEach(sel => { const el = document.querySelector(sel); if(el) el.style.display = isLow ? 'none' : ''; });
            mediumHiddenRows.forEach(id => setDisplayById(id, !isLow && !isMed));
        }
        const root = document.documentElement;
        if(q === 'potato'){
            root.style.setProperty('--saber-wave-opacity','0.28');
            root.style.setProperty('--saber-shadow-a','rgba(255,255,255,0.08)');
            root.style.setProperty('--saber-shadow-b','rgba(255,255,255,0.03)');
        } else if(q === 'medium'){
            root.style.setProperty('--saber-wave-opacity','0.55');
            root.style.setProperty('--saber-shadow-a','rgba(255,255,255,0.12)');
            root.style.setProperty('--saber-shadow-b','rgba(255,255,255,0.05)');
        } else {
            root.style.removeProperty('--saber-wave-opacity');
            root.style.removeProperty('--saber-shadow-a');
            root.style.removeProperty('--saber-shadow-b');
        }
        [document.querySelector('.top'), ...document.querySelectorAll('.floating-panel')].forEach(el => {
            if(!el) return;
            if(q === 'potato'){
                el.style.backdropFilter = 'none';
                el.style.webkitBackdropFilter = 'none';
            } else {
                el.style.backdropFilter = el.classList.contains('floating-panel') ? 'blur(22px) saturate(145%)' : 'blur(14px) saturate(138%)';
                el.style.webkitBackdropFilter = el.classList.contains('floating-panel') ? 'blur(22px) saturate(145%)' : 'blur(14px) saturate(138%)';
            }
        });
    }
    function applyGraphicQuality(q, applyDefaults){
        const prevDPR = (typeof currentDPR !== 'undefined') ? currentDPR : 1;
        // Two manual tiers (Potato/Default); 'auto' just falls back to the fixed default.
        const nextQuality = q === 'auto' ? _detectDefaultGraphicQuality() : q;
        performanceMode = 'manual';
        perfGovScale = 1.0; _perfSlowStreak = 0; _perfFastStreak = 0; _perfEmaMs = 1000 / 60; if(document.body) document.body.classList.remove('perf-lite');
        graphicQuality = GRAPHIC_PROFILES[nextQuality] ? nextQuality : _detectDefaultGraphicQuality();
        syncEffectiveGraphicState(prevDPR);
        updateManualQualityUi(graphicQuality, true);
        if(applyDefaults) applyGraphicModeDefaults(graphicQuality);
        if(typeof ensureAnimLoop === 'function' && falling.length>0) ensureAnimLoop();
    }
    Object.entries(btns).forEach(([id, val]) => {
        const b = document.getElementById(id);
        if(b) b.onclick = () => applyGraphicQuality(val, true);
    });
    window.applyGraphicQuality = applyGraphicQuality;
    window.updateAutoPerformance = function(){};
    window.setAutoGraphicQuality = function(){};
    applyGraphicQuality(graphicQuality);
})();

(function(){
    let metroBpm = 120;
    let metroBeats = 4;
    let metroSound = 'click';
    let metroRunning = false;
    let metroTimer = null;
    let metroCurBeat = 0;

    const bpmNum    = document.getElementById('metroBpmNum');
    const bpmSlider = document.getElementById('metroBpmSlider');
    const startBtn  = document.getElementById('metroStartBtn');
    const settingsBpmNum = document.getElementById('settingsMetroBpmNum');
    const settingsBpmSlider = document.getElementById('settingsMetroBpmSlider');
    const settingsStartBtn = document.getElementById('settingsMetroStartBtn');
    const dotsEl    = document.getElementById('metroDots');
    const metroBtn  = document.getElementById('metroBtn');

    function buildDots(){
        if(!dotsEl) return;
        dotsEl.innerHTML = '';
        for(let i=0;i<metroBeats;i++){
            const d = document.createElement('div');
            d.className = 'metro-dot' + (i===0 ? ' accent' : '');
            dotsEl.appendChild(d);
        }
    }

    function updateBpm(v){
        metroBpm = Math.max(20, Math.min(300, v));
        if(bpmNum) bpmNum.textContent = metroBpm;
        if(bpmSlider) bpmSlider.value = metroBpm;
        if(settingsBpmNum) settingsBpmNum.textContent = metroBpm;
        if(settingsBpmSlider) settingsBpmSlider.value = metroBpm;
        if(metroRunning){ stopMetro(); startMetro(); }
    }

    function tickSound(){
        try{
            const ctx = audioCtx;
            if(!ctx) return;
            if(ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const isAccent = metroCurBeat === 0;
            const master = ctx.createGain();
            master.gain.setValueAtTime(isAccent ? 0.42 : 0.28, now);
            master.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
            master.connect(ctx.destination);

            if(metroSound === 'beep'){
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(isAccent ? 1320 : 980, now);
                osc.connect(master);
                osc.start(now);
                osc.stop(now + 0.055);
                return;
            }

            if(metroSound === 'hihat'){
                const len = Math.floor(ctx.sampleRate * 0.035);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const data = buf.getChannelData(0);
                for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2.4);
                const src = ctx.createBufferSource();
                const hp = ctx.createBiquadFilter();
                hp.type = 'highpass';
                hp.frequency.setValueAtTime(isAccent ? 6200 : 7600, now);
                src.buffer = buf;
                src.connect(hp);
                hp.connect(master);
                src.start(now);
                return;
            }

            const osc = ctx.createOscillator();
            const toneGain = ctx.createGain();
            const bp = ctx.createBiquadFilter();
            const isWood = metroSound === 'wood';
            osc.type = isWood ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(isWood ? (isAccent ? 880 : 660) : (isAccent ? 1850 : 1450), now);
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(isWood ? (isAccent ? 980 : 760) : (isAccent ? 2100 : 1650), now);
            bp.Q.setValueAtTime(isWood ? 5 : 7, now);
            toneGain.gain.setValueAtTime(1, now);
            toneGain.gain.exponentialRampToValueAtTime(0.001, now + (isWood ? 0.042 : 0.032));
            osc.connect(bp);
            bp.connect(toneGain);
            toneGain.connect(master);
            osc.start(now);
            osc.stop(now + (isWood ? 0.045 : 0.035));
        }catch(e){}
    }

    function flashDot(){
        const dots = dotsEl ? dotsEl.querySelectorAll('.metro-dot') : [];
        const beatIndex = metroCurBeat;
        dots.forEach(d => d.classList.remove('beat'));
        if(dots[beatIndex]) dots[beatIndex].classList.add('beat');
        setTimeout(()=>{ if(dots[beatIndex]) dots[beatIndex].classList.remove('beat'); }, 80);
    }

    function tick(){
        tickSound();
        flashDot();
        metroCurBeat = (metroCurBeat + 1) % metroBeats;
    }

    function startMetro(){
        metroCurBeat = 0;
        metroRunning = true;
        tick();
        const scheduleNext = () => {
            if(!metroRunning) return;
            metroTimer = setTimeout(() => { tick(); scheduleNext(); }, 60000 / metroBpm);
        };
        scheduleNext();
        if(startBtn){ startBtn.textContent = 'Stop'; startBtn.classList.add('running'); }
        if(settingsStartBtn){ settingsStartBtn.textContent = 'Stop'; settingsStartBtn.classList.add('running'); }
        if(metroBtn) metroBtn.classList.add('active');
    }

    function stopMetro(){
        clearTimeout(metroTimer); metroTimer = null;
        metroRunning = false;
        metroCurBeat = 0;
        const dots = dotsEl ? dotsEl.querySelectorAll('.metro-dot') : [];
        dots.forEach(d => d.classList.remove('beat'));
        if(startBtn){ startBtn.textContent = 'Start'; startBtn.classList.remove('running'); }
        if(settingsStartBtn){ settingsStartBtn.textContent = 'Start'; settingsStartBtn.classList.remove('running'); }
        if(metroBtn) metroBtn.classList.remove('active');
    }

    if(startBtn) startBtn.onclick = () => { if(metroRunning) stopMetro(); else startMetro(); };
    if(settingsStartBtn) settingsStartBtn.onclick = () => { if(metroRunning) stopMetro(); else startMetro(); };

    document.querySelectorAll('.settings-metro-bpm').forEach(btn => {
        btn.onclick = () => updateBpm(metroBpm + parseInt(btn.dataset.delta, 10));
    });
    if(settingsBpmSlider) settingsBpmSlider.oninput = e => updateBpm(parseInt(e.target.value, 10));
    if(document.getElementById('metroBpmUp'))    document.getElementById('metroBpmUp').onclick    = ()=>updateBpm(metroBpm+1);
    if(document.getElementById('metroBpmDown'))  document.getElementById('metroBpmDown').onclick   = ()=>updateBpm(metroBpm-1);
    if(document.getElementById('metroBpmUp10'))  document.getElementById('metroBpmUp10').onclick   = ()=>updateBpm(metroBpm+10);
    if(document.getElementById('metroBpmDown10'))document.getElementById('metroBpmDown10').onclick  = ()=>updateBpm(metroBpm-10);
    if(bpmSlider) bpmSlider.oninput = e => updateBpm(parseInt(e.target.value));

    document.querySelectorAll('.metro-beat-btn').forEach(btn => {
        btn.onclick = () => {
            metroBeats = parseInt(btn.dataset.beats);
            document.querySelectorAll('.metro-beat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            buildDots();
            metroCurBeat = 0;
        };
    });

    document.querySelectorAll('.metro-sound-btn').forEach(btn => {
        btn.onclick = () => {
            metroSound = btn.dataset.sound;
            document.querySelectorAll('.metro-sound-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Expose state so presets can save/restore the metronome (it lives in this
    // private scope; without this it was silently dropped from every preset).
    function applyBeats(n){
        metroBeats = Math.max(1, Math.min(12, parseInt(n, 10) || 4));
        document.querySelectorAll('.metro-beat-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.beats, 10) === metroBeats));
        buildDots();
        metroCurBeat = 0;
    }
    function applySound(name){
        metroSound = name || 'click';
        document.querySelectorAll('.metro-sound-btn').forEach(b => b.classList.toggle('active', b.dataset.sound === metroSound));
    }
    window.getMetronomeState = function(){ return { bpm: metroBpm, beats: metroBeats, sound: metroSound }; };
    window.setMetronomeState = function(st){
        if(!st || typeof st !== 'object') return;
        if(st.bpm !== undefined) updateBpm(parseInt(st.bpm, 10) || metroBpm);
        if(st.beats !== undefined) applyBeats(st.beats);
        if(st.sound !== undefined) applySound(st.sound);
    };

    buildDots();
})();

(function(){
    const img=document.querySelector('.brand-icon img');
    if(!img)return;
    function fallback(){
        const wrap=img.closest('.brand-icon');
        if(wrap)wrap.classList.add('logo-fallback');
    }
    img.addEventListener('error', fallback, {once:true});
    if(img.complete && img.naturalWidth===0) fallback();
})();

(function initRecording(){
    const recBtn = document.getElementById('recBtn');
    const recHud = document.getElementById('recHud');
    const recTimeEl = recHud ? recHud.querySelector('.rec-time') : null;
    if (!recBtn) return;

    const MIME_CANDIDATES = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm'
    ];
    const VIDEO_BPS = 5_000_000;
    const AUDIO_BPS = 192_000;

    let mediaRecorder = null;
    let recordedChunks = [];
    let displayStream = null;
    let combinedStream = null;
    let recStartTime = 0;
    let timerRaf = 0;
    let isRecording = false;

    function pickMime(){
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
        for (const m of MIME_CANDIDATES){
            if (MediaRecorder.isTypeSupported(m)) return m;
        }
        return '';
    }

    function fmtTime(ms){
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
    }

    function tickTimer(){
        if (!isRecording) return;
        if (recTimeEl) recTimeEl.textContent = fmtTime(performance.now() - recStartTime);
        timerRaf = requestAnimationFrame(tickTimer);
    }

    function showHud(show){
        if (!recHud) return;
        recHud.classList.toggle('show', !!show);
    }

    function setBtnActive(active){
        recBtn.classList.toggle('rec-active', !!active);
        recBtn.textContent = active ? 'Stop' : 'Record';
        recBtn.title = active ? 'Stop recording' : 'Record screen + audio';
    }

    function cleanupStreams(){
        if (displayStream){
            displayStream.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
            displayStream = null;
        }
        combinedStream = null;
        mediaRecorder = null;
    }

    function triggerDownload(blob){
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date();
        const pad = (n) => String(n).padStart(2,'0');
        const fname = 'papiano-' +
            ts.getFullYear() + pad(ts.getMonth()+1) + pad(ts.getDate()) + '-' +
            pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds()) + '.webm';
        a.href = url;
        a.download = fname;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 250);
    }

    async function startRecording(){
        if (isRecording) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia){
            showToast('Use the desktop version of Chrome, Edge, or Firefox to record.', { type:'error', title:'Recording not supported' });
            return;
        }
        if (typeof MediaRecorder === 'undefined'){
            showToast('MediaRecorder is not available in this browser.', { type:'error', title:'Recording unavailable' });
            return;
        }

        if (audioCtx.state === 'suspended'){
            try{ await audioCtx.resume(); }catch(e){}
        }

        let dispStream;
        try{
            dispStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 60, max: 60 } },
                audio: false
            });
        } catch(err){
            return;
        }
        displayStream = dispStream;

        const audioDest = getRecAudioDest();
        const audioTracks = audioDest.stream.getAudioTracks();
        const tracks = [
            ...dispStream.getVideoTracks(),
            ...audioTracks
        ];
        combinedStream = new MediaStream(tracks);

        const mime = pickMime();
        const opts = {
            videoBitsPerSecond: VIDEO_BPS,
            audioBitsPerSecond: AUDIO_BPS
        };
        if (mime) opts.mimeType = mime;

        try{
            mediaRecorder = new MediaRecorder(combinedStream, opts);
        } catch(err){
            showToast('Recording could not start. Check screen and audio access.', { type:'error', title:'Recording unavailable' });
            cleanupStreams();
            return;
        }

        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mime || 'video/webm' });
            recordedChunks = [];
            cleanupStreams();
            if (blob.size > 0) triggerDownload(blob);
        };
        mediaRecorder.onerror = (ev) => {
        };

        const vTrack = dispStream.getVideoTracks()[0];
        if (vTrack){
            vTrack.addEventListener('ended', () => {
                if (isRecording) stopRecording();
            });
        }

        mediaRecorder.start(1000);
        isRecording = true;
        recStartTime = performance.now();
        if (recTimeEl) recTimeEl.textContent = '00:00';
        setBtnActive(true);
        showHud(true);
        timerRaf = requestAnimationFrame(tickTimer);
    }

    function stopRecording(){
        if (!isRecording) return;
        isRecording = false;
        cancelAnimationFrame(timerRaf);
        try{
            if (mediaRecorder && mediaRecorder.state !== 'inactive'){
                mediaRecorder.stop();
            } else {
                cleanupStreams();
            }
        } catch(err){
            cleanupStreams();
        }
        setBtnActive(false);
        showHud(false);
    }

    recBtn.addEventListener('click', () => {
        if (isRecording) stopRecording();
        else startRecording();
    });


    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || typeof MediaRecorder === 'undefined'){
        recBtn.style.display = 'none';
    }
})();

(function initPapianoOnline(){
    const roomButton = document.getElementById('mpRoomBtn');
    const topLeaveButton = document.getElementById('mpLeaveTopBtn');
    const layer = document.getElementById('mpLayer');
    const closeButton = document.getElementById('mpClose');
    const homeRooms = document.getElementById('mpHomeRooms');
    const searchResults = document.getElementById('mpSearchResults');
    const statusFilterButtons = Array.from(document.querySelectorAll('[data-mp-status-filter]'));
    let mpSearchStatusFilter = 'online';
    const roomNameInput = document.getElementById('mpRoomName');
    const maxPlayersInput = document.getElementById('mpMaxPlayers');
    const maxPlayersButton = document.getElementById('mpMaxPlayersButton');
    const maxPlayersLabel = document.getElementById('mpMaxPlayersLabel');
    const maxPlayersModal = document.getElementById('mpMaxPlayersModal');
    const maxPlayersClose = document.getElementById('mpMaxPlayersClose');
    const roomModeInput = document.getElementById('mpRoomMode');
    const roomTypeButton = document.getElementById('mpRoomTypeButton');
    const roomTypeLabel = document.getElementById('mpRoomTypeLabel');
    const roomTypeMeta = document.getElementById('mpRoomTypeMeta');
    const roomPasswordField = document.getElementById('mpRoomPasswordField');
    const roomPasswordInput = document.getElementById('mpRoomPassword');
    const roomTypeModal = document.getElementById('mpRoomTypeModal');
    const roomTypeClose = document.getElementById('mpRoomTypeClose');
    const passwordModal = document.getElementById('mpPasswordModal');
    const passwordRoom = document.getElementById('mpPasswordRoom');
    const passwordInput = document.getElementById('mpPasswordInput');
    const passwordError = document.getElementById('mpPasswordError');
    const passwordClose = document.getElementById('mpPasswordClose');
    const passwordCancel = document.getElementById('mpPasswordCancel');
    const passwordSubmit = document.getElementById('mpPasswordSubmit');
    const leaveConfirm = document.getElementById('mpLeaveConfirm');
    const leaveYes = document.getElementById('mpLeaveYes');
    const leaveNo = document.getElementById('mpLeaveNo');
    const playerStrip = document.getElementById('mpPlayerStrip');
    const chatPreview = document.getElementById('mpChatPreview');
    const chatPanel = document.getElementById('mpChatPanel');
    const chatClose = document.getElementById('mpChatClose');
    const chatTitle = document.getElementById('mpChatTitle');
    const chatSub = document.getElementById('mpChatSub');
    const messagesBox = document.getElementById('mpMessages');
    const chatForm = document.getElementById('mpChatForm');
    const chatInput = document.getElementById('mpChatInput');
    const chatCounter = document.getElementById('mpChatCounter');
    const replyBar = document.getElementById('mpReplyBar');
    const replyName = document.getElementById('mpReplyName');
    const replyText = document.getElementById('mpReplyText');
    const replyClear = document.getElementById('mpReplyClear');
    const MP_REPLY_ICON = '<svg class="mp-reply-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 9 5 14l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14h8a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const profile = document.getElementById('mpProfile');
    const profileAvatar = document.getElementById('mpProfileAvatar');
    const profileName = document.getElementById('mpProfileName');
    const profileRole = document.getElementById('mpProfileRole');
    const profilePlayTime = document.getElementById('mpProfilePlayTime');
    const profileId = document.getElementById('mpProfileId');
    const profileInstrument = document.getElementById('mpProfileInstrument');
    const profileLayerInstrument = document.getElementById('mpProfileLayerInstrument');
    const profileCountry = document.getElementById('mpProfileCountry');
    const friendAction = document.getElementById('mpFriendAction');
    const blockAction = document.getElementById('mpBlockAction');
    const reportAction = document.getElementById('mpReportAction');
    const reportModal = document.getElementById('mpReportModal');
    const reportClose = document.getElementById('mpReportClose');
    const reportCancel = document.getElementById('mpReportCancel');
    const reportSubmit = document.getElementById('mpReportSubmit');
    const reportTarget = document.getElementById('mpReportTarget');
    const reportReasons = document.getElementById('mpReportReasons');
    const reportDetail = document.getElementById('mpReportDetail');
    const profileBio = document.getElementById('mpProfileBio');
    const profileLikes = document.getElementById('mpProfileLikes');
    const profileDislikes = document.getElementById('mpProfileDislikes');
    const profileLikeButton = document.getElementById('mpProfileLikeBtn');
    const profileDislikeButton = document.getElementById('mpProfileDislikeBtn');
    const profileClose = document.getElementById('mpProfileClose');
    const profileActions = profile ? profile.querySelector('.mp-profile-actions') : null;
    const kickBan = document.getElementById('mpKickBan');
    const muteChat = document.getElementById('mpMuteChat');
    const muteInst = document.getElementById('mpMuteInst');
    const profileVolumeRow = document.getElementById('mpProfileVolumeRow');
    const profileVolume = document.getElementById('mpProfileVolume');
    const profileVolumeValue = document.getElementById('mpProfileVolumeValue');
    const profilePersonalMute = document.getElementById('mpProfilePersonalMute');
    if(!roomButton || !layer || !playerStrip || !messagesBox) return;

        const firebaseConfig = {
            apiKey: "AIzaSyAzjXvKk_1UvC0BaArsJk_Ep2WqIXhIcTY",
            authDomain: "papianoverse.firebaseapp.com",
            databaseURL: "https://papianoverse-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "papianoverse",
            storageBucket: "papianoverse.firebasestorage.app",
            messagingSenderId: "240332627380",
            appId: "1:240332627380:web:c80d08fa1f89b1acdb26e1",
            measurementId: "G-3FVZ17Q69B"
        };

    const MAX_ROOMS = 15;
    const ROOM_CREATE_COOLDOWN_MS = 30000;
    const ROOM_CREATE_GRACE_MS = 4000;
    const ROOM_EMPTY_DELETE_DELAY_MS = 250;
    const ROOM_PLAYER_STALE_MS = 45000;
    const ROOM_HEARTBEAT_MS = 20000;
    const ONLINE_STALE_MS = 3 * 60 * 1000; // 3 min TTL — user missed 9+ heartbeats = truly offline
    const GLOBAL_HEARTBEAT_MS = 55000; // lobby presence heartbeat (55s, well within 3-min TTL)
    const CHAT_MAX_LENGTH = 300;
    const CHAT_COOLDOWN_MS = 1200;
    const CHAT_BURST_WINDOW_MS = 10000;
    const CHAT_BURST_LIMIT = 5;
    const STREAM_MAX_EVENTS_PER_WRITE = 49;
    const PROFILE_REACTION_COOLDOWN_MS = 1200;
    const REPORT_COOLDOWN_MS = 60000;
    const FIREBASE_ROOT = 'papianoOnlineBeta';
    let mpHistoryArmed = false;
    let leaveConfirmSource = null;
    let firebaseReady = false;
    let firebaseStarting = false;
    let firebaseInitPromise = null;
    let authApi = null;
    let firebaseAuth = null;
    let currentAuthUser = null;
    let dbApi = null;
    let db = null;
    let fsApi = null;
    let fsDb = null;
    let mpSelfId = 'local_self';
    let currentRoom = null;
    let currentScreen = 'home';
    let roomsSnapshotReady = false;
    const MP_PAGE = window.PAPIANO_MULTIPLAYER_PAGE || (function(){ try{ var p = new URLSearchParams(location.search); if(p.get('stage') === '1' || p.has('room')) return 'stage'; }catch(e){} return 'home'; })();
    const STAGE_INTENT_KEY = 'papiano_stagepiano_intent_v1';
    let stageIntentProcessed = false;
    let pendingPasswordRoom = null;

    function isHomeMultiplayerPage(){ return MP_PAGE === 'home'; }
    function isStagePianoPage(){ return MP_PAGE === 'stage'; }

    function readStageIntent(){
        let intent = null;
        try{ intent = JSON.parse(sessionStorage.getItem(STAGE_INTENT_KEY) || 'null'); }catch(e){ intent = null; }
        try{
            const params = new URLSearchParams(location.search);
            const roomId = params.get('room');
            if(roomId) intent = { action:'join', roomId, password:params.get('password') || '' };
        }catch(e){}
        return intent && typeof intent === 'object' ? intent : null;
    }

    function clearStageIntent(){
        try{ sessionStorage.removeItem(STAGE_INTENT_KEY); }catch(e){}
    }

    function openStagePiano(intent){
        try{ sessionStorage.setItem(STAGE_INTENT_KEY, JSON.stringify({ ...(intent || {}), createdAt:Date.now() })); }catch(e){}
        window.location.assign('multiplayer.html?stage=1');
    }

    function getCreateRoomIntent(){
        return {
            action:'create',
            roomName:(roomNameInput?.value || '').trim(),
            maxPlayers:Number(maxPlayersInput?.value || 6) || 6,
            mode:roomModeInput?.value === 'Private' ? 'Private' : 'Public',
            password:(roomPasswordInput?.value || '').trim()
        };
    }
    let replyTarget = null;
    let selectedPlayer = null;
    let chatIdleTimer = null;
    function clearChatIdleTimer(){ if(chatIdleTimer){ clearTimeout(chatIdleTimer); chatIdleTimer = null; } }
    function bumpChatActivity(){
        if(!document.body.classList.contains('mp-chat-open')) return;
        document.body.classList.remove('mp-chat-idle');
        clearChatIdleTimer();
        chatIdleTimer = setTimeout(() => {
            if(document.body.classList.contains('mp-chat-open')) document.body.classList.add('mp-chat-idle');
        }, 5000);
    }
    if(chatPanel){
        ['pointerdown','keydown','input','focusin','wheel','touchstart'].forEach(ev => chatPanel.addEventListener(ev, bumpChatActivity, { passive:true }));
    }
    let reportPlayer = null;
    let selectedReportReason = 'Spam';
    let blockedPlayersLoadedFor = '';
    let roomPlayersByRoom = {};
    let roomModerationByRoom = {};
    let eventUnsubscribe = null;
    let streamAddedUnsubscribe = null;
    let streamChangedUnsubscribe = null;
    let roomPlayersUnsubscribe = null;
    let roomModerationUnsubscribe = null;
    let friendsUnsubscribe = null;
    let roomsUnsubscribe = null;
    let usersUnsubscribe = null;
    const MP_PLAYTIME_LOCAL_MS = 10000;
    const MP_PLAYTIME_REMOTE_MS = 60000;
    let mpPlayTimeStartedAt = 0;
    let mpPlayTimePending = 0;
    let mpPlayTimeBaseSeconds = 0;
    let mpPlayTimeRemoteSyncedAt = 0;
    let mpPlayTimeTimer = null;
    let renderRoomsTimer = 0;
    let chatUnsubscribe = null;
    let roomPlayerDisconnect = null;
    let userDisconnect = null;
    let activeEventRoomId = null;
    let seenEventKeys = new Set();
    let lastRemoteEventTime = Date.now();
    let currentRoomSeat = 0;
    let forcedLeaveRoomId = '';
    let roomPlayersLoaded = false;
    const emptyRoomCleanup = new Set();
    const roomDeleteQueue = new Set();
    const profileCache = new Map();
    const profileVoteCache = new Map();
    const profileVoteInFlight = new Set();
    const blockedPlayerIds = new Set();
    const reportCooldownByPlayer = new Map();
    const chatSendTimes = [];
    const remoteMixer = new Map();
    const remoteSustainByPlayer = new Map();
    const remotePedalHeldNotes = new Map();
    let remoteMixerLoadedFor = '';
    let searchRenderToken = 0;
    let chatViewportRaf = 0;
    const playerActivity = new Map();
    const friendIds = new Set();
    const friendProfiles = new Map();
    const friendUserUnsubscribers = new Map();
    const playerPillMap = new Map();
    const streamSeqByPlayer = new Map();
    const remotePerformanceByPlayer = new Map();
    const firestoreSearchCache = new Map();
    const lobbyRoomPlayerUnsubscribers = new Map();
    const emptyRoomTimers = new Map();
    const staleRoomPlayerCleanup = new Set();
    let searchDebounceTimer = 0;
    let roomPresenceTimer = 0;
    let globalPresenceTimer = 0;
    let roomStreamSeq = 0;
    let roomStreamSessionId = '';
    let roomStreamJoinCutoff = 0;
    let lastSentPerformanceSignature = '';
    let activityUiRaf = 0;

    if(leaveConfirm && leaveConfirm.parentElement !== document.body) document.body.appendChild(leaveConfirm);

    const players = [];
    const rooms = [];
    const state = new Map();
    const messages = [];

    function fallbackName(){
        try{
            let name = localStorage.getItem('papianoMpName');
            if(!name){
                name = 'Player ' + Math.floor(100 + Math.random() * 900);
                localStorage.setItem('papianoMpName', name);
            }
            return name;
        }catch(e){
            return 'Player ' + Math.floor(100 + Math.random() * 900);
        }
    }

    // Brightest version of each seat hue (top-right corner of the colour picker:
    // max saturation + max brightness), so default seat colours that drive
    // falling notes / key visuals are vivid, not muted.
    const MP_PLAYER_COLORS = ['#ff0013','#ffffff','#5400ff','#0076ff','#00ff52','#ffcb00'];

    function colorFromId(id){
        const text = String(id || '');
        const match = text.match(/(\d+)$/);
        if(match){
            const index = (Number(match[1]) - 1) % MP_PLAYER_COLORS.length;
            return MP_PLAYER_COLORS[index >= 0 ? index : 1];
        }
        let hash = 0;
        for(let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        const fallbackIndex = 1 + (((hash < 0 ? -hash : hash) % (MP_PLAYER_COLORS.length - 1)));
        return MP_PLAYER_COLORS[fallbackIndex];
    }

    function playerSeatColorIndex(seat){
        const number = Number(seat || 0);
        return Number.isInteger(number) && number >= 1 && number <= MP_PLAYER_COLORS.length ? number - 1 : -1;
    }

    function sanitizePlayerColor(value, fallback){
        const raw = String(value || '').trim();
        if(/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
        if(/^#[0-9a-fA-F]{3}$/.test(raw)){
            return '#' + raw.slice(1).split('').map(char => char + char).join('').toLowerCase();
        }
        return fallback || '#78dcff';
    }

    // Seat cache + color lock: once a player's color is resolved, it is LOCKED
    // for the room session to prevent flicker/fade. The lock is overwritten when
    // a fresh roomPlayers snapshot arrives (so a corrected colour self-heals).
    const _playerSeatCache = new Map(); // playerId → seat number
    const _playerColorLock = new Map(); // playerId → resolved hex color

    // Builds playerId → palette index for EVERY active player in the current
    // room, guaranteeing DISTINCT colours. Prefers the stored seat when seats
    // are present AND unique; otherwise falls back to a stable join-order rank.
    // This is the fix for "every pill is red": if the seat field is missing or
    // duplicated (so everyone would resolve to seat 1 → MP_PLAYER_COLORS[0]),
    // rank-based assignment keeps each player a different colour.
    function roomColorIndexMap(){
        const map = new Map();
        if(!(currentRoom && roomPlayersByRoom[currentRoom.id])) return map;
        const live = roomPlayersByRoom[currentRoom.id];
        const entries = Object.entries(live)
            .map(([key, data]) => ({
                id: String(data?.id || key),
                seat: Number(data?.seat || 0),
                joinedAt: Number(data?.joinedAt || data?.updatedAt || 0)
            }))
            .sort((a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        if(!entries.length) return map;
        const seatsSeen = new Set();
        let seatsUsable = true;
        for(const e of entries){
            if(e.seat < 1 || e.seat > MP_PLAYER_COLORS.length || seatsSeen.has(e.seat)){ seatsUsable = false; break; }
            seatsSeen.add(e.seat);
        }
        entries.forEach((e, rank) => {
            map.set(e.id, seatsUsable ? (e.seat - 1) : (rank % MP_PLAYER_COLORS.length));
        });
        return map;
    }

    function getRoomPlayerColorIndex(id){
        const targetId = String(id || '');
        const idx = roomColorIndexMap().get(targetId);
        if(typeof idx === 'number' && idx >= 0) return idx;
        const cachedSeat = _playerSeatCache.get(targetId);
        if(cachedSeat){
            const seatIndex = playerSeatColorIndex(cachedSeat);
            if(seatIndex >= 0) return seatIndex;
        }
        return -1;
    }

    function playerColor(playerOrId){
        const player = typeof playerOrId === 'object' ? playerOrId : null;
        const id = player ? player.id : playerOrId;
        const idStr = String(id || '');

        const locked = _playerColorLock.get(idStr);
        if(locked) return locked;

        // Room-wide resolution FIRST: this guarantees a distinct colour per
        // player even when the stored seat field is missing/duplicated. (Using a
        // raw player.seat here was what made every player collapse to seat 1's
        // red when seat data was unreliable.)
        const roomIndex = getRoomPlayerColorIndex(id);
        if(roomIndex >= 0){
            const color = MP_PLAYER_COLORS[roomIndex];
            _playerColorLock.set(idStr, color);
            return color;
        }

        // Then a seat carried directly on the player object (out-of-room lookups).
        const seatIndex = playerSeatColorIndex(player?.seat);
        if(seatIndex >= 0){
            const color = MP_PLAYER_COLORS[seatIndex];
            _playerSeatCache.set(idStr, player.seat);
            _playerColorLock.set(idStr, color);
            return color;
        }

        // Fallback: deterministic from ID hash — NOT locked (upgrades when seat arrives)
        let hash = 0;
        for(let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
        const fallbackIndex = 1 + (((hash < 0 ? -hash : hash) % (MP_PLAYER_COLORS.length - 1)));
        return MP_PLAYER_COLORS[fallbackIndex];
    }

    function sanitizeText(value, fallback = ''){
        const text = String(value ?? '').trim();
        return text || fallback;
    }

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
    }

    // Simple role labels map (loaded from Realtime DB at /roles, admin-managed).
    let mpRoleRegistry = {};
    function getRoleLabel(value){
        const key = String(value || '').trim().toLowerCase();
        const entry = mpRoleRegistry[key];
        return entry ? entry.label : (key ? key.toUpperCase() : '');
    }
    function getRoleColor(value){
        const key = String(value || '').trim().toLowerCase();
        return mpRoleRegistry[key]?.color || '';
    }
    function contrastInk(hex){
        const c = hex.replace('#','');
        const r = parseInt(c.substring(0,2),16)||0;
        const g = parseInt(c.substring(2,4),16)||0;
        const b = parseInt(c.substring(4,6),16)||0;
        return (r*0.299+g*0.587+b*0.114)>160?'#06111f':'#ffffff';
    }
    function attachRoleRegistryListener(){
        if(!firebaseReady || !dbApi || !db) return;
        try{
            var rolesRef = dbApi.ref(db, 'roles');
            dbApi.onValue(rolesRef, snap => {
                const data = snap.val() || {};
                mpRoleRegistry = {};
                Object.entries(data).forEach(([id, role]) => {
                    const roleId = String(id || '').trim().toLowerCase().slice(0, 40);
                    if (!roleId) return;
                    mpRoleRegistry[roleId] = {
                        label: String(role?.label || roleId).trim().slice(0, 28) || roleId.toUpperCase(),
                        color: (typeof role?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(role.color)) ? role.color : ''
                    };
                });
                renderSearch();
                renderRoomChrome();
                if(selectedPlayer && profile.classList.contains('show')) renderProfile(selectedPlayer);
            }, () => {});
        }catch(e){}
    }

    let banWatcherUnsubscribe = null;
    function startAccountBanWatcher(uid){
        if(!uid || !firebaseReady || !dbApi || !db) return;
        try{ banWatcherUnsubscribe?.(); }catch(e){}
        var banRef = dbApi.ref(db, 'deletedAccounts/' + uid);
        banWatcherUnsubscribe = dbApi.onValue(banRef, snap => {
            if(snap.val()?.deleted){
                try{ banWatcherUnsubscribe?.(); }catch(e){}
                try{ writeSelfUser({ online:false, room:null }); }catch(e){}
                try{ authApi.signOut(firebaseAuth); }catch(e){}
                window.location.assign('/');
            }
        }, () => {});
    }

    function formatMpSequentialId(value){
        const raw = String(value ?? '').trim().replace(/^#/, '');
        if(!/^\d+$/.test(raw)) return '';
        const number = Number(raw);
        return Number.isInteger(number) && number > 0 ? String(number) : '';
    }

    function normalizeHomeProfile(uid, data = {}){
        const role = String(data.role || data.badgeId || '').toLowerCase();
        const publicId = Number(data.publicId || 0);
        const validPublicId = Number.isInteger(publicId) && publicId > 0 ? publicId : 0;
        const userId = formatMpSequentialId(data.userId || validPublicId);
        return {
            uid:String(uid || data.uid || ''),
            name:sanitizeText(data.name || data.displayName, 'Papiano User').slice(0, 24),
            searchName:String(data.searchName || data.name || data.displayName || '').toLowerCase(),
            desc:sanitizeText(data.desc || data.bio, 'No bio yet.').slice(0, 160),
            badgeId:role,
            role:role,
            photoURL:String(data.photoURL || data.avatar_url || data.avatarURL || ''),
            publicId:validPublicId,
            userId,
            likes:Number(data.likes || 0),
            dislikes:Number(data.dislikes || 0),
            playTimeSeconds:Number(data.playTimeSeconds || 0),
            playTime:String(data.playTime || ''),
            countryCode:String(data.countryCode || '').slice(0, 2).toUpperCase()
        };
    }

    async function loadHomeProfile(uid, fallback = {}, options = {}){
        const key = String(uid || '');
        if(!key) return normalizeHomeProfile('', fallback);
        if(!options.force && profileCache.has(key)) return profileCache.get(key);
        let profile = normalizeHomeProfile(key, fallback);
        if(fsApi && fsDb){
            try{
                const snap = await fsApi.getDoc(fsApi.doc(fsDb, 'profiles', key));
                if(snap.exists()) profile = normalizeHomeProfile(key, { ...fallback, ...(snap.data() || {}) });
            }catch(e){}
        }
        profileCache.set(key, profile);
        return profile;
    }

    async function ensureHomeProfile(authUser, fallback = {}){
        const uid = String(authUser?.uid || '');
        if(!uid || !fsApi || !fsDb) return loadHomeProfile(uid, fallback);
        try{
            const profileRef = fsApi.doc(fsDb, 'profiles', uid);
            const counterRef = fsApi.doc(fsDb, 'counters', 'publicUserId');
            const data = await fsApi.runTransaction(fsDb, async transaction => {
                const snap = await transaction.get(profileRef);
                const oldData = snap.exists() ? (snap.data() || {}) : {};
                let publicId = Number(oldData.publicId || 0);
                if(!Number.isInteger(publicId) || publicId < 1){
                    const counterSnap = await transaction.get(counterRef);
                    const next = Number(counterSnap.exists() ? counterSnap.data().next : 1) || 1;
                    publicId = Math.max(1, next);
                    transaction.set(counterRef, { next: publicId + 1 }, { merge:true });
                }
                const baseName = sanitizeText(authUser.displayName || fallback.name || fallback.displayName, 'Papiano User').slice(0, 24);
                const merged = {
                    name:baseName,
                    searchName:baseName.toLowerCase(),
                    desc:String(fallback.desc || fallback.bio || '').slice(0, 160),
                    badgeId:'common',
                    photoURL:String(authUser.photoURL || fallback.photoURL || ''),
                    likes:0,
                    dislikes:0,
                    ...oldData,
                    publicId,
                    userId:formatMpSequentialId(publicId),
                    updatedAt:fsApi.serverTimestamp()
                };
                transaction.set(profileRef, merged, { merge:true });
                return merged;
            });
            const profile = normalizeHomeProfile(uid, data);
            profileCache.set(uid, profile);
            return profile;
        }catch(e){
            return loadHomeProfile(uid, fallback);
        }
    }

    function avatarMarkup(player, className = 'mp-avatar'){
        const photo = String(player?.photoURL || '').trim();
        const color = escapeHtml(playerColor(player));
        const label = escapeHtml(player?.name || 'Player');
        const image = photo ? `<img src="${escapeHtml(photo)}" alt="${label}">` : '';
        return `<span class="${className}" aria-hidden="true" style="--mp-player-color:${color}">${image}</span>`;
    }

    // Always-English chat stamp (consistent with index.html formatChatDayTime)
    function timeLabel(value){
        const date = value ? new Date(value) : new Date();
        if(Number.isNaN(date.getTime())) return '--:--';
        const time = String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');
        const now = new Date();
        const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
        if(dayDiff <= 0) return time;
        if(dayDiff === 1) return 'Yesterday ' + time;
        if(dayDiff < 7) return date.toLocaleDateString('en-US', { weekday:'short' }) + ' ' + time;
        const sameYear = date.getFullYear() === now.getFullYear();
        return date.toLocaleDateString('en-US', sameYear
            ? { day:'numeric', month:'short' }
            : { day:'numeric', month:'short', year:'numeric' }) + ', ' + time;
    }

    const MP_PIANO_SOUNDFONTS = {
        sf1:{ label:'Grand Piano', aliases:['piano','piano a','grand piano'] },
        sf2:{ label:'Soft Piano', aliases:['piano b','soft piano'] },
        sf3:{ label:'Studio Piano', aliases:['piano c','studio piano'] },
        sf4:{ label:'Bright Piano', aliases:['piano d','bright piano'] },
        ep1:{ label:'Electric Piano 1', aliases:['electric piano 1','ep1'] },
        ep2:{ label:'Electric Piano 2', aliases:['electric piano 2','ep2'] }
    };
    const MP_STRING_SOUNDFONTS = {
        stringSf1:{ label:'String Ensemble', aliases:['strings','string ensemble','strings a'] },
        stringSf2:{ label:'Slow Strings', aliases:['slow strings','strings b'] },
        stringSf3:{ label:'Cello', aliases:['cello'] },
        stringSf4:{ label:'Viola', aliases:['viola'] },
        stringSf5:{ label:'Violin', aliases:['violin'] },
        stringSf6:{ label:'Bass Pizzicato', aliases:['bass pizzicato','pizzicato'] }
    };
    const MP_OTHER_SOUNDFONTS = {
        otherSf1:{ label:'Acoustic Guitar', aliases:['acoustic guitar','nylon guitar','guitar'] },
        otherSf2:{ label:'Steel Guitar', aliases:['steel guitar','acoustic steel guitar'] },
        otherSf3:{ label:'Electric Guitar', aliases:['electric guitar','clean guitar'] },
        otherSf4:{ label:'Overdrive Guitar', aliases:['overdrive guitar','overdriven guitar'] },
        otherSf5:{ label:'Acoustic Bass', aliases:['acoustic bass','bass'] },
        otherSf6:{ label:'Electric Bass', aliases:['electric bass','finger bass'] },
        otherSf7:{ label:'Choir', aliases:['choir','choir aahs'] },
        otherSf8:{ label:'Flute', aliases:['flute'] },
        otherSf9:{ label:'Trumpet', aliases:['trumpet'] },
        otherSf10:{ label:'Marimba', aliases:['marimba'] },
        otherSf11:{ label:'Vibraphone', aliases:['vibraphone','vibes'] },
        otherSf12:{ label:'Harp', aliases:['harp','orchestral harp'] }
    };
    const MP_ALL_SOUNDFONTS = Object.assign({}, MP_PIANO_SOUNDFONTS, MP_STRING_SOUNDFONTS, MP_OTHER_SOUNDFONTS);
    const MP_ALL_SOUNDFONT_ALIAS = Object.entries(MP_ALL_SOUNDFONTS).reduce((map, [key, item]) => {
        map[key.toLowerCase()] = key;
        map[item.label.toLowerCase()] = key;
        item.aliases.forEach(alias => { map[alias.toLowerCase()] = key; });
        return map;
    }, {});
    const remoteSoundfontBuffers = new Map();
    const remoteSoundfontLoading = new Map();
    let remoteSoundfontLoadChain = Promise.resolve();
    let roomChromeSignature = '';
    let warmRemoteTimer = 0;
    let selfInstrumentRemoteKey = '';
    let selfInstrumentSyncTimer = 0;

    function normalizeInstrumentKey(value){
        const raw = String(value || '').trim().toLowerCase();
        return MP_ALL_SOUNDFONT_ALIAS[raw] || (SF_URLS[value] ? String(value) : 'sf1');
    }

    function normalizeStringInstrumentKey(value){
        const raw = String(value || '').trim().toLowerCase();
        return MP_ALL_SOUNDFONT_ALIAS[raw] || (SF_URLS[value] ? String(value) : 'stringSf1');
    }

    function normalizeRemoteSoundfontKey(value, layer = 'piano'){
        return layer === 'string' ? normalizeStringInstrumentKey(value) : normalizeInstrumentKey(value);
    }

    function instrumentLabel(key){
        const sfKey = normalizeInstrumentKey(key);
        return MP_ALL_SOUNDFONTS[sfKey]?.label || getSoundfontName(sfKey) || 'Grand Piano';
    }

    function stringInstrumentLabel(key){
        const sfKey = normalizeStringInstrumentKey(key);
        return MP_ALL_SOUNDFONTS[sfKey]?.label || getSoundfontName(sfKey) || 'String Ensemble';
    }

    function currentInstrumentKey(){
        return normalizeInstrumentKey(currentSf || 'sf1');
    }

    function currentInstrumentName(){
        return instrumentLabel(currentInstrumentKey());
    }

    function currentStringInstrumentKey(){
        return normalizeStringInstrumentKey(currentStringSf || 'stringSf1');
    }

    function currentStringInstrumentName(){
        return stringInstrumentLabel(currentStringInstrumentKey());
    }


    function playerMainInstrumentText(player){
        const key = normalizeInstrumentKey(player?.instrumentKey || player?.instrument || 'sf1');
        return sanitizeText(player?.instrument, instrumentLabel(key));
    }

    function playerLayerInstrumentText(player){
        if(!player?.stringsEnabled) return 'None';
        const key = normalizeStringInstrumentKey(player?.stringInstrumentKey || player?.stringInstrument || 'stringSf1');
        return sanitizeText(player?.stringInstrument, stringInstrumentLabel(key));
    }


    function normalizePlayer(id, data = {}){
        const instrumentKey = normalizeInstrumentKey(data.instrumentKey || data.sfKey || data.instrument);
        const stringInstrumentKey = normalizeStringInstrumentKey(data.stringInstrumentKey || data.layerInstrumentKey || data.stringInstrument || data.layerInstrument || 'stringSf1');
        const stringsEnabled = data.stringsEnabled === true || data.stringEnabled === true || data.layerEnabled === true;
        const profile = normalizeHomeProfile(id, data);
        const playerId = String(data.id || profile.uid || id);
        return {
            id:playerId,
            name:profile.name,
            uid:profile.uid,
            displayUserId:profile.userId,
            userId:profile.userId,
            role:profile.role,
            badgeId:profile.badgeId,
            photoURL:profile.photoURL,
            publicId:profile.publicId,
            searchName:profile.searchName,
            instrumentKey,
            instrument:sanitizeText(data.instrument, instrumentLabel(instrumentKey)),
            stringsEnabled,
            stringInstrumentKey,
            stringInstrument:sanitizeText(data.stringInstrument || data.layerInstrument, stringInstrumentLabel(stringInstrumentKey)),
            color:sanitizePlayerColor(data.color, colorFromId(playerId)),
            bio:profile.desc,
            likes:profile.likes,
            dislikes:profile.dislikes,
            playTimeSeconds:profile.playTimeSeconds,
            countryCode:profile.countryCode,
            online:data.online !== false,
            room:data.room || null,
            seat:Number(data.seat || 0),
            lastSeen:Number(data.lastSeen || data.updatedAt || data.joinedAt || 0),
            lastActive:Number(data.lastActive || data.updatedAt || data.joinedAt || 0),
            lastPlayed:Number(data.lastPlayed || 0),
            updatedAt:Number(data.updatedAt || 0)
        };
    }

    function applyHomeProfileToPlayer(player, profile){
        if(!player || !profile) return player;
        player.name = profile.name;
        player.uid = profile.uid || player.uid || '';
        player.displayUserId = profile.userId;
        player.userId = profile.userId;
        player.role = profile.role;
        player.badgeId = profile.badgeId;
        player.photoURL = profile.photoURL;
        player.publicId = profile.publicId;
        player.searchName = profile.searchName;
        player.bio = profile.desc;
        player.likes = profile.likes;
        player.dislikes = profile.dislikes;
        player.playTimeSeconds = profile.playTimeSeconds;
        player.countryCode = profile.countryCode;
        return player;
    }



    async function hydratePlayerProfile(player, options = {}){
        if(!player || !player.id) return player;
        const profile = await loadHomeProfile(player.id, player, options);
        const local = players.find(item => item.id === player.id);
        applyHomeProfileToPlayer(local || player, profile);
        if(local && local !== player) applyHomeProfileToPlayer(player, profile);
        return local || player;
    }

    function normalizeRoom(id, data = {}){
        const mode = data.mode === 'Private' ? 'Private' : 'Public';
        return {
            id:String(data.id || id),
            name:sanitizeText(data.name, 'Untitled Room').slice(0, 32),
            owner:sanitizeText(data.ownerName || data.owner, 'Host'),
            ownerUid:data.ownerUid || data.ownerId || '',
            mode,
            roomNumber:Number(data.roomNumber || data.number || data.slot || 0),
            max:Math.min(6, Math.max(2, Number(data.max || 6))),
            count:Number(data.activeCount ?? data.count ?? 0),
            activeCount:Number(data.activeCount ?? data.count ?? 0),
            password:mode === 'Private' ? String(data.password || '') : '',
            createdAt:Number(data.createdAt || 0),
            updatedAt:Number(data.updatedAt || 0),
            chatEnabled:data.chatEnabled !== false
        };
    }

    function upsertPlayer(player){
        const normalized = normalizePlayer(player.id, player);
        const index = players.findIndex(item => item.id === normalized.id);
        if(index >= 0) players[index] = { ...players[index], ...normalized };
        else players.push(normalized);
        if(!state.has(normalized.id)) state.set(normalized.id, { banned:false, muteChat:false, muteInstrument:false });
        return normalized;
    }

    function ensureLocalSelf(){
        if(isSignedIn()) return;
        if(players.some(player => player.id === mpSelfId)) return;
        upsertPlayer({
            id:mpSelfId,
            name:fallbackName(),
            uid:mpSelfId,
            displayUserId:'',
            userId:'',
            role:'PLAYER',
            badgeId:'common',
            instrumentKey:currentInstrumentKey(),
            instrument:currentInstrumentName(),
            color:'#78dcff',
            bio:'Papiano player.',
            online:true,
            room:null
        });
    }

    ensureLocalSelf();

    function isSignedIn(){ return !!currentAuthUser; }

    function isLocalGuestPlayerId(id){
        const value = String(id || '').trim();
        return !value || value === 'local_self' || /^(guest|visitor|demo|anonymous|local)(?:[_:-]|$)/i.test(value);
    }

    function isGuestPlayerRecord(player){
        if(!player || isLocalGuestPlayerId(player.id || player.uid)) return true;
        const name = String(player.name || '').trim();
        const hasProfileId = !!(player.displayUserId || player.userId || player.publicId);
        return /^Player\s+\d{2,}$/i.test(name) && !hasProfileId;
    }

    function isAuthenticatedDisplayPlayer(player){
        return !!player && !isGuestPlayerRecord(player);
    }

    function purgeLocalGuestPlayers(){
        for(let i = players.length - 1; i >= 0; i--){
            if(isGuestPlayerRecord(players[i])) players.splice(i, 1);
        }
        state.delete('local_self');
        playerActivity.delete('local_self');
        streamSeqByPlayer.delete('local_self');
        remotePerformanceByPlayer.delete('local_self');
        remoteMixer.delete('local_self');
    }

    function clearFriendUserSubscriptions(){
        friendUserUnsubscribers.forEach(unsubscribe => { try{ unsubscribe(); }catch(e){} });
        friendUserUnsubscribers.clear();
        friendProfiles.clear();
    }

    function syncFriendUserSubscriptions(){
        if(!firebaseReady || !dbApi) return;
        friendUserUnsubscribers.forEach((unsubscribe, id) => {
            if(friendIds.has(id)) return;
            try{ unsubscribe(); }catch(e){}
            friendUserUnsubscribers.delete(id);
            friendProfiles.delete(id);
        });
        friendIds.forEach(id => {
            if(id === mpSelfId || isLocalGuestPlayerId(id) || friendUserUnsubscribers.has(id)) return;
            const unsubscribe = dbApi.onValue(dbRef(`users/${id}`), snap => {
                const cached = friendProfiles.get(id) || { id, name:'Player', online:false };
                const data = snap.val() || cached;
                const player = normalizePlayer(id, { ...cached, ...data, id, online:data.online === true });
                friendProfiles.set(id, player);
                const index = players.findIndex(item => item.id === id);
                if(index >= 0) players[index] = { ...players[index], ...player };
                else players.push(player);
                renderSearch();
                if(selectedPlayer && selectedPlayer.id === id && profile.classList.contains('show')) renderProfile(player);
            });
            friendUserUnsubscribers.set(id, unsubscribe);
        });
    }

    function mpBuildPairId(uidA, uidB){
        return [uidA, uidB].filter(Boolean).map(String).sort().join('_');
    }

    // Friends are owned by the main app's Firestore "friendships" collection
    // (doc per pair, status 'accepted'). Multiplayer used to read a separate,
    // empty Realtime DB node, so the Friends tab never detected real friends.
    // Subscribe to the same Firestore source so both apps stay in sync, then
    // resolve each friend's live online status from the realtime users node.
    function attachFirestoreFriends(){
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)) return null;
        try{
            const col = fsApi.collection(fsDb, 'friendships');
            const friendsQuery = fsApi.query(col, fsApi.where('users', 'array-contains', mpSelfId));
            return fsApi.onSnapshot(friendsQuery, snap => {
                const nextIds = new Set();
                snap.forEach(docSnap => {
                    const data = (docSnap.data && docSnap.data()) || {};
                    if(data.status !== 'accepted' || !Array.isArray(data.users)) return;
                    const other = data.users.find(uid => uid && String(uid) !== mpSelfId);
                    if(other) nextIds.add(String(other));
                });
                const freshIds = [];
                nextIds.forEach(id => { if(!friendProfiles.has(id)) freshIds.push(id); });
                Array.from(friendProfiles.keys()).forEach(id => { if(!nextIds.has(id)) friendProfiles.delete(id); });
                friendIds.clear();
                nextIds.forEach(id => {
                    friendIds.add(id);
                    if(!friendProfiles.has(id)) friendProfiles.set(id, normalizePlayer(id, { id, name:'Player', online:false }));
                });
                syncFriendUserSubscriptions();
                renderRoomChrome();
                renderSearch();
                if(selectedPlayer && profile.classList.contains('show')) renderProfile(selectedPlayer);
                // Pull name / photo / country for newly added friends so offline
                // friends still show real details instead of a "Player" placeholder.
                freshIds.forEach(id => {
                    const seed = players.find(item => item.id === id) || friendProfiles.get(id) || { id, name:'Player', online:false };
                    hydratePlayerProfile(seed, { force:false }).then(updated => {
                        if(updated) friendProfiles.set(id, players.find(item => item.id === id) || updated);
                        renderSearch();
                    }).catch(() => {});
                });
            }, () => {});
        }catch(e){ return null; }
    }

    function mpPlayTimeDateKey(ms = Date.now()){
        return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(ms));
    }
    function mpPlayTimeSyncKey(){
        return (mpSelfId && !isLocalGuestPlayerId(mpSelfId)) ? `papianoPlayTimeRemoteDay:${mpSelfId}` : '';
    }
    function mpMarkPlayTimeSyncedToday(){
        const key = mpPlayTimeSyncKey();
        if(key){ try{ localStorage.setItem(key, mpPlayTimeDateKey()); }catch(e){} }
    }
    function mpFormatPlayTime(seconds){
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }
    function mpAccumulatePlayTime(){
        if(!mpPlayTimeStartedAt || document.hidden) return false;
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - mpPlayTimeStartedAt) / 1000));
        mpPlayTimeStartedAt = now;
        if(!elapsed) return false;
        mpPlayTimePending += elapsed;
        return true;
    }
    // Multiplayer is a separate page from index.html, so the main-app tracker is
    // not running here. Accumulate time spent in multiplayer and add it to the
    // same profiles/{uid}.playTimeSeconds field. We use an atomic increment for
    // the delta since the last flush so there is no read-modify-write race with
    // the main app and no risk of rolling the total backwards.
    function mpPersistPlayTime(syncRemote = false){
        mpAccumulatePlayTime();
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)) return;
        if(mpPlayTimePending <= 0) return;
        const now = Date.now();
        // Forced flushes (tab hidden, sign-out, page unload) always write.
        // Background flushes are throttled to every 30 seconds.
        if(!syncRemote){
            if(now - mpPlayTimeRemoteSyncedAt < MP_PLAYTIME_REMOTE_MS) return;
        }
        const deltaSeconds = mpPlayTimePending;
        mpPlayTimePending = 0;
        mpPlayTimeRemoteSyncedAt = now;
        mpPlayTimeBaseSeconds += deltaSeconds;
        try{
            const ref = fsApi.doc(fsDb, 'profiles', mpSelfId);
            fsApi.setDoc(ref, {
                playTimeSeconds: fsApi.increment(deltaSeconds),
                playTime: mpFormatPlayTime(mpPlayTimeBaseSeconds),
                playTimeLeaderboardUpdatedAt: fsApi.serverTimestamp(),
                updatedAt: fsApi.serverTimestamp()
            }, { merge:true }).then(mpMarkPlayTimeSyncedToday).catch(() => {
                // Write failed: put the delta back so it retries on the next flush.
                mpPlayTimePending += deltaSeconds;
                mpPlayTimeBaseSeconds -= deltaSeconds;
            });
        }catch(e){
            mpPlayTimePending += deltaSeconds;
            mpPlayTimeBaseSeconds -= deltaSeconds;
        }
    }
    function startMpPlayTimeTracker(){
        if(!mpSelfId || isLocalGuestPlayerId(mpSelfId)) return;
        if(!mpPlayTimeStartedAt) mpPlayTimeStartedAt = Date.now();
        clearInterval(mpPlayTimeTimer);
        mpPlayTimeTimer = setInterval(() => mpPersistPlayTime(false), MP_PLAYTIME_LOCAL_MS);
    }
    function pauseMpPlayTimeTracker(syncRemote = false){
        mpPersistPlayTime(syncRemote);
        mpPlayTimeStartedAt = 0;
        clearInterval(mpPlayTimeTimer);
        mpPlayTimeTimer = null;
    }

    function syncAuthUi(){
        const signedIn = isSignedIn();
        document.body.classList.toggle('mp-auth-signed-in', signedIn);
        document.body.classList.toggle('mp-auth-signed-out', !signedIn);
    }

    function dbRef(path){ return dbApi.ref(db, `${FIREBASE_ROOT}/${path}`); }
    function roomPlayersKnown(roomId){
        return Object.prototype.hasOwnProperty.call(roomPlayersByRoom, roomId);
    }
    function playerLastSeen(data){
        return Number(data?.lastSeen || data?.updatedAt || data?.joinedAt || 0);
    }
    function isActiveRoomPlayer(id, data){
        const playerId = String(id || '');
        if(isLocalGuestPlayerId(playerId) || isGuestPlayerRecord({ id:playerId, ...(data || {}) })) return false;
        if(playerId === mpSelfId && currentRoom && String(data?.room || currentRoom.id) === currentRoom.id) return true;
        const lastSeen = playerLastSeen(data);
        return lastSeen > 0 && Date.now() - lastSeen <= ROOM_PLAYER_STALE_MS;
    }
    function activeRoomPlayerEntries(live){
        if(!live || typeof live !== 'object') return [];
        return Object.entries(live).filter(([id, data]) => isActiveRoomPlayer(id, data || {}));
    }
    function liveRoomCount(roomId){
        const live = roomPlayersByRoom[roomId];
        return activeRoomPlayerEntries(live).length;
    }
    function roomCount(room){
        if(!room) return 0;
        if(roomPlayersKnown(room.id)) return liveRoomCount(room.id);
        return Math.max(0, Number(room.activeCount ?? room.count ?? 0));
    }
    function roomDisplayNumber(room, index = 0){
        const raw = Number(room?.roomNumber || room?.number || room?.slot || 0);
        if(Number.isFinite(raw) && raw >= 1 && raw <= MAX_ROOMS) return Math.trunc(raw);
        return Math.min(MAX_ROOMS, Math.max(1, index + 1));
    }
    function roomMetadataCount(room){
        return Math.max(0, Number(room?.activeCount ?? room?.count ?? 0));
    }
    function roomPastCreateGrace(room){
        return Date.now() - Number(room?.createdAt || 0) >= ROOM_CREATE_GRACE_MS;
    }
    function makeRoomSessionId(){
        return mpSelfId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }
    function ownedLiveRoom(){
        if(!isSignedIn()) return null;
        return visibleRooms().find(room => room.ownerUid === mpSelfId) || null;
    }
    async function loadOwnedLiveRoom(){
        const local = ownedLiveRoom();
        if(local) return local;
        if(!firebaseReady || !dbApi || !isSignedIn()) return null;
        try{
            const claimSnap = await dbApi.get(dbRef(`ownerRooms/${mpSelfId}`));
            const claim = claimSnap.val() || null;
            const roomId = String(claim?.roomId || '');
            if(!roomId) return null;
            const roomSnap = await dbApi.get(dbRef(`rooms/${roomId}`));
            if(!roomSnap.exists()){
                await dbApi.remove(dbRef(`ownerRooms/${mpSelfId}`)).catch(() => {});
                return null;
            }
            const room = normalizeRoom(roomId, roomSnap.val() || {});
            const playersSnap = await dbApi.get(dbRef(`roomPlayers/${roomId}`));
            const live = playersSnap.val() || {};
            const activeCount = activeRoomPlayerEntries(live).length;
            if(activeCount <= 0){
                await dbApi.remove(dbRef(`ownerRooms/${mpSelfId}`)).catch(() => {});
                await dbApi.remove(dbRef(`rooms/${roomId}`)).catch(() => {});
                return null;
            }
            const index = rooms.findIndex(item => item.id === room.id);
            if(index >= 0) rooms[index] = room;
            else rooms.unshift(room);
            return room;
        }catch(e){
            return null;
        }
    }
    async function claimOwnerRoom(room){
        if(!firebaseReady || !dbApi || !room || !isSignedIn()) return true;
        const now = Date.now();
        try{
            const result = await dbApi.runTransaction(dbRef(`ownerRooms/${mpSelfId}`), value => {
                if(value && value.roomId && value.roomId !== room.id) return value;
                return { roomId:room.id, ownerUid:mpSelfId, createdAt:Number(room.createdAt || now), updatedAt:now };
            });
            const value = result?.snapshot?.val?.() || null;
            return !!(result.committed && value && value.roomId === room.id);
        }catch(e){
            return false;
        }
    }
    async function releaseOwnerRoom(room){
        if(!firebaseReady || !dbApi || !room || !room.ownerUid) return;
        try{
            await dbApi.runTransaction(dbRef(`ownerRooms/${room.ownerUid}`), value => {
                if(value && value.roomId && value.roomId !== room.id) return value;
                return null;
            });
        }catch(e){}
    }
    function isKnownEmptyRoom(room){
        if(!room || !roomPastCreateGrace(room)) return false;
        if(roomPlayersKnown(room.id)) return liveRoomCount(room.id) === 0;
        return roomMetadataCount(room) <= 0;
    }
    function visibleRooms(){
        return rooms.filter(room => !roomDeleteQueue.has(room.id) && !isKnownEmptyRoom(room));
    }
    function activeRoomTotal(){
        return visibleRooms().length;
    }
    function nextRoomNumber(){
        const used = new Set(rooms.map(room => Number(room.roomNumber || 0)).filter(number => Number.isFinite(number) && number >= 1 && number <= MAX_ROOMS));
        for(let number = 1; number <= MAX_ROOMS; number++){
            if(!used.has(number)) return number;
        }
        return null;
    }
    async function releaseRoomSlot(room){
        if(!firebaseReady || !dbApi || !room) return;
        const number = Number(room.roomNumber || 0);
        if(!Number.isInteger(number) || number < 1 || number > MAX_ROOMS) return;
        try{
            await dbApi.runTransaction(dbRef(`roomSlots/${number}`), value => {
                if(value && value.roomId && value.roomId !== room.id) return value;
                return null;
            });
        }catch(e){}
    }
    let _roomCountWriteInFlight = false;
    async function updateRoomActiveCount(room, count){
        if(!firebaseReady || !dbApi || !room || emptyRoomCleanup.has(room.id)) return;
        const safeCount = Math.max(0, Math.min(Number(room.max || 6), Number(count || 0)));
        room.count = safeCount;
        room.activeCount = safeCount;
        if(_roomCountWriteInFlight) return;
        _roomCountWriteInFlight = true;
        try{
            await dbApi.update(dbRef(`rooms/${room.id}`), { count:safeCount, activeCount:safeCount, updatedAt:Date.now() });
        }catch(e){}finally{
            _roomCountWriteInFlight = false;
        }
    }
    function pruneStaleRoomPlayers(roomId, live){
        if(!firebaseReady || !dbApi || !roomId || !live || typeof live !== 'object') return;
        let pruned = false;
        Object.entries(live).forEach(([id, data]) => {
            if(isActiveRoomPlayer(id, data || {})) return;
            const key = roomId + ':' + id;
            if(staleRoomPlayerCleanup.has(key)) return;
            staleRoomPlayerCleanup.add(key);
            pruned = true;
            dbApi.remove(dbRef(`roomPlayers/${roomId}/${id}`)).catch(() => {}).finally(() => staleRoomPlayerCleanup.delete(key));
        });
        if(pruned){
            const room = rooms.find(r => r.id === roomId);
            if(room){
                const freshCount = activeRoomPlayerEntries(live).length;
                room.count = freshCount;
                room.activeCount = freshCount;
                updateRoomActiveCount(room, freshCount);
            }
        }
    }
    function removeRoomLocally(roomId){
        const id = String(roomId || '');
        if(!id) return;
        const index = rooms.findIndex(room => room.id === id);
        if(index >= 0) rooms.splice(index, 1);
        const unsubscribe = lobbyRoomPlayerUnsubscribers.get(id);
        if(unsubscribe){
            try{ unsubscribe(); }catch(e){}
            lobbyRoomPlayerUnsubscribers.delete(id);
        }
        delete roomPlayersByRoom[id];
        const timer = emptyRoomTimers.get(id);
        if(timer) clearTimeout(timer);
        emptyRoomTimers.delete(id);
        if(currentRoom && currentRoom.id === id){
            currentRoom = null;
            if(isInPianoRoom()) leaveRoomToHome();
        }
        renderRooms();
    }

    async function deleteEmptyRoom(room){
        if(!firebaseReady || !dbApi || !room || emptyRoomCleanup.has(room.id)) return;
        if(Date.now() - Number(room.createdAt || 0) < ROOM_CREATE_GRACE_MS) return;
        emptyRoomCleanup.add(room.id);
        roomDeleteQueue.add(room.id);
        try{
            const snap = await dbApi.get(dbRef(`roomPlayers/${room.id}`));
            const live = snap.val() || {};
            pruneStaleRoomPlayers(room.id, live);
            const activeCount = activeRoomPlayerEntries(live).length;
            if(activeCount > 0){
                roomDeleteQueue.delete(room.id);
                await updateRoomActiveCount(room, activeCount);
                return;
            }
            await Promise.allSettled([
                dbApi.remove(dbRef(`roomPlayers/${room.id}`)),
                dbApi.remove(dbRef(`roomSeats/${room.id}`)),
                dbApi.remove(dbRef(`roomSeatClaims/${room.id}`)),
                dbApi.remove(dbRef(`messages/${room.id}`)),
                dbApi.remove(dbRef(`streams/${room.id}`)),
                dbApi.remove(dbRef(`moderation/${room.id}`))
            ]);
            await dbApi.remove(dbRef(`rooms/${room.id}`));
            await releaseOwnerRoom(room);
            await releaseRoomSlot(room);
            removeRoomLocally(room.id);
        }catch(e){
            roomDeleteQueue.delete(room.id);
            showToast('Couldn’t update room. Try again.', { type:'error', title:'Online Room' });
        }finally{
            emptyRoomCleanup.delete(room.id);
        }
    }
    function scheduleEmptyRoomDelete(room){
        if(!room || !firebaseReady || !dbApi) return;
        if(liveRoomCount(room.id) > 0){
            const timer = emptyRoomTimers.get(room.id);
            if(timer) clearTimeout(timer);
            emptyRoomTimers.delete(room.id);
            return;
        }
        if(Date.now() - Number(room.createdAt || 0) < ROOM_CREATE_GRACE_MS) return;
        if(emptyRoomTimers.has(room.id)) return;
        emptyRoomTimers.set(room.id, window.setTimeout(() => {
            emptyRoomTimers.delete(room.id);
            deleteEmptyRoom(room);
        }, ROOM_EMPTY_DELETE_DELAY_MS));
    }
    function reconcileRoomPresence(room){
        if(!room) return;
        if(!roomPlayersKnown(room.id)){
            if(roomMetadataCount(room) <= 0) scheduleEmptyRoomDelete(room);
            return;
        }
        const live = roomPlayersByRoom[room.id] || {};
        pruneStaleRoomPlayers(room.id, live);
        const count = liveRoomCount(room.id);
        if(count > 0){
            const timer = emptyRoomTimers.get(room.id);
            if(timer) clearTimeout(timer);
            emptyRoomTimers.delete(room.id);
            if(!_roomCountWriteInFlight && Number(room.activeCount ?? room.count ?? 0) !== count) updateRoomActiveCount(room, count);
            return;
        }
        scheduleEmptyRoomDelete(room);
    }
    function cleanupEmptyRooms(){
        if(!firebaseReady || !dbApi) return;
        rooms.forEach(reconcileRoomPresence);
    }
    function getPlayer(id){
        if(!id) return currentUser();
        const local = players.find(player => player.id === id);
        if(local) return local;
        if(currentRoom && roomPlayersByRoom[currentRoom.id]?.[id]) return normalizePlayer(id, roomPlayersByRoom[currentRoom.id][id]);
        return normalizePlayer(id, { name:'Player', online:false });
    }
    function getState(id){
        if(currentRoom && roomModerationByRoom[currentRoom.id]?.[id]){
            const remote = roomModerationByRoom[currentRoom.id][id];
            return { banned:!!remote.banned, muteChat:!!remote.muteChat, muteInstrument:!!remote.muteInstrument };
        }
        if(!state.has(id)) state.set(id, { banned:false, muteChat:false, muteInstrument:false });
        return state.get(id);
    }
    function currentUser(){ return getPlayer(mpSelfId); }

    function localStoreGetNumber(key){
        try{
            const value = Number(localStorage.getItem(key) || 0);
            return Number.isFinite(value) ? value : 0;
        }catch(e){ return 0; }
    }

    function localStoreSetNumber(key, value){
        try{ localStorage.setItem(key, String(Number(value) || 0)); }catch(e){}
    }

    function roomCreateCooldownKey(){ return `papiano_room_create_at_${mpSelfId || 'guest'}`; }

    function roomCreateCooldownLeft(now = Date.now()){
        const last = localStoreGetNumber(roomCreateCooldownKey());
        return Math.max(0, ROOM_CREATE_COOLDOWN_MS - (now - last));
    }

    function markRoomCreated(now = Date.now()){
        localStoreSetNumber(roomCreateCooldownKey(), now);
    }

    function compactSeconds(ms){ return Math.max(1, Math.ceil(ms / 1000)); }

    function isRoomOwner(){
        if(!currentRoom) return false;
        return currentRoom.ownerUid ? currentRoom.ownerUid === currentUser().id : currentRoom.owner === currentUser().name;
    }
    function isInPianoRoom(){ return currentScreen === 'pianoMulti' && document.body.classList.contains('mp-room-active'); }
    function syncSelfInstrumentState(writeRemote = false){
        const user = players.find(player => player.id === mpSelfId);
        if(!user) return;
        user.instrumentKey = currentInstrumentKey();
        user.instrument = currentInstrumentName();
        user.stringsEnabled = !!stringEnabled;
        user.stringInstrumentKey = currentStringInstrumentKey();
        user.stringInstrument = currentStringInstrumentName();
        if(!writeRemote || !firebaseReady || !dbApi || !currentRoom) return;
        const signature = `${currentRoom.id}:${user.instrumentKey}:${user.instrument}:${user.stringsEnabled ? '1' : '0'}:${user.stringInstrumentKey}:${user.stringInstrument}`;
        if(selfInstrumentRemoteKey === signature) return;
        selfInstrumentRemoteKey = signature;
        const payload = {
            instrumentKey:user.instrumentKey,
            instrument:user.instrument,
            stringsEnabled:user.stringsEnabled,
            stringInstrumentKey:user.stringInstrumentKey,
            stringInstrument:user.stringInstrument
        };
        writeSelfUser(payload).catch(() => {
            if(selfInstrumentRemoteKey === signature) selfInstrumentRemoteKey = '';
        });
        dbApi.update(dbRef(`roomPlayers/${currentRoom.id}/${mpSelfId}`), {
            ...payload,
            updatedAt:Date.now()
        }).catch(() => {
            if(selfInstrumentRemoteKey === signature) selfInstrumentRemoteKey = '';
        });
    }

    function scheduleSelfInstrumentStateSync(delay = 260){
        syncSelfInstrumentState(false);
        if(selfInstrumentSyncTimer) clearTimeout(selfInstrumentSyncTimer);
        selfInstrumentSyncTimer = window.setTimeout(() => {
            selfInstrumentSyncTimer = 0;
            syncSelfInstrumentState(true);
        }, delay);
    }

    function mixerKey(){
        return 'papianoRemoteMixer:' + String(mpSelfId || 'local');
    }

    function loadRemoteMixer(){
        const key = mixerKey();
        if(remoteMixerLoadedFor === key) return;
        remoteMixer.clear();
        remoteMixerLoadedFor = key;
        try{
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            Object.entries(data || {}).forEach(([id, value]) => {
                const volume = Math.max(0, Math.min(1, Number(value.volume ?? 1)));
                remoteMixer.set(id, { volume, muted:!!value.muted });
            });
        }catch(e){}
    }

    function saveRemoteMixer(){
        try{
            const data = {};
            remoteMixer.forEach((value, id) => { data[id] = { volume:value.volume, muted:value.muted }; });
            localStorage.setItem(mixerKey(), JSON.stringify(data));
        }catch(e){}
    }

    function getRemoteMixer(playerId){
        loadRemoteMixer();
        const id = String(playerId || '');
        if(!id || id === mpSelfId) return { volume:1, muted:false };
        if(!remoteMixer.has(id)) remoteMixer.set(id, { volume:1, muted:false });
        return remoteMixer.get(id);
    }

    function setRemoteMixer(playerId, updates){
        const id = String(playerId || '');
        if(!id || id === mpSelfId) return;
        const current = getRemoteMixer(id);
        const next = {
            volume:Math.max(0, Math.min(1, Number(updates.volume ?? current.volume ?? 1))),
            muted:updates.muted !== undefined ? !!updates.muted : !!current.muted
        };
        remoteMixer.set(id, next);
        saveRemoteMixer();
        if(selectedPlayer && selectedPlayer.id === id) renderProfile(selectedPlayer);
        renderRoomChrome();
    }

    function getRemotePlaybackGain(playerId){
        if(isPlayerBlocked(playerId)) return 0;
        const mixer = getRemoteMixer(playerId);
        return mixer.muted ? 0 : Math.max(0, Math.min(1, Number(mixer.volume ?? 1)));
    }

    function getPerformanceSnapshot(){
        const stringFx = sfEffectSettings.sf2 || {};
        return {
            instrumentKey:currentInstrumentKey(),
            instrument:currentInstrumentName(),
            sustainEnabled:!!manualSustainEnabled,
            sustainPedalDown:!!midiSustainPedalDown,
            sustainValue:Math.max(0, Math.min(1, Number(sustainLevel || 0))),
            stringsEnabled:!!stringEnabled,
            stringInstrumentKey:currentStringInstrumentKey(),
            stringInstrument:currentStringInstrumentName(),
            stringVolume:Math.max(0, Math.min(1, Number(stringVolume || 0))),
            stringFade:Math.max(0.1, Math.min(10, Number(stringFx.fadeSec || STRING_FADE_DEFAULT))),
            stringRangeLeft:Number(stringRangeLeft || 21),
            stringRangeRight:Number(stringRangeRight || 108)
        };
    }

    function activePlayers(){
        if(!currentRoom) return [];
        const live = roomPlayersByRoom[currentRoom.id];
        const list = live ? Object.entries(live).map(([id, data]) => normalizePlayer(id, data)) : players.filter(player => player.room === currentRoom.id);
        return list.filter(player => isAuthenticatedDisplayPlayer(player) && !getState(player.id).banned);
    }

    function isPlayerBlocked(id){ return blockedPlayerIds.has(String(id || '')); }
    function canUseSafetyAction(player){ return !!player && isInPianoRoom() && player.id !== mpSelfId && !isLocalGuestPlayerId(player.id); }
    function syncSafetyActions(player){
        const show = canUseSafetyAction(player);
        if(blockAction){
            const blocked = show && isPlayerBlocked(player.id);
            blockAction.hidden = !show;
            blockAction.style.display = show ? '' : 'none';
            blockAction.disabled = !show;
            blockAction.classList.toggle('active', blocked);
            blockAction.textContent = blocked ? 'Unblock Player' : 'Block Player';
        }
        if(reportAction){
            reportAction.hidden = !show;
            reportAction.style.display = show ? '' : 'none';
            reportAction.disabled = !show;
        }
    }
    function attachBlocksListener(){
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)) return null;
        try{
            const col = fsApi.collection(fsDb, 'blocks');
            const q = fsApi.query(col, fsApi.where('blockerId', '==', mpSelfId));
            return fsApi.onSnapshot(q, snap => {
                blockedPlayerIds.clear();
                snap.forEach(docSnap => {
                    const data = (docSnap.data && docSnap.data()) || {};
                    if(data.blockedId) blockedPlayerIds.add(String(data.blockedId));
                });
                renderMessages();
                renderRoomChrome();
                if(selectedPlayer && profile.classList.contains('show')) syncSafetyActions(selectedPlayer);
            }, () => {});
        }catch(e){ return null; }
    }
    async function toggleBlockedPlayer(player){
        if(!canUseSafetyAction(player)) return;
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)){
            showToast('Block is available after login.', { type:'error', title:'Profile' });
            return;
        }
        const id = String(player.id);
        const blocked = blockedPlayerIds.has(id);
        try{
            const blockDocId = mpSelfId + '_' + id;
            const ref = fsApi.doc(fsDb, 'blocks', blockDocId);
            if(blocked){
                await fsApi.deleteDoc(ref);
                blockedPlayerIds.delete(id);
                showToast('Player unblocked.', { type:'success', title:'Profile' });
            }else{
                await fsApi.setDoc(ref, {
                    blockerId: mpSelfId,
                    blockedId: id,
                    createdAt: fsApi.serverTimestamp()
                });
                blockedPlayerIds.add(id);
                showToast('Player blocked.', { type:'success', title:'Profile' });
            }
        }catch(e){
            showToast('Couldn\'t update block. Try again.', { type:'error', title:'Profile' });
        }
        syncSafetyActions(player);
        renderMessages();
        renderRoomChrome();
    }
    function mpHistoryKey(screen){
        if(screen === 'home' || screen === 'multiHome') return 'multiHome';
        if(screen === 'pianoMultiGuard') return 'pianoMultiGuard';
        return 'multi:' + screen;
    }
    function replaceMpHistory(screen){
        try{ history.replaceState({ papianoMp:mpHistoryKey(screen) }, '', location.href); }catch(e){}
    }
    function pushMpHistory(screen){
        try{
            const key = mpHistoryKey(screen);
            const current = history.state || {};
            if(current.papianoMp !== key) history.pushState({ papianoMp:key }, '', location.href);
        }catch(e){}
    }
    function armPianoHistory(){
        try{
            const current = history.state || {};
            if(current.papianoMp !== 'pianoMultiGuard') history.pushState({ papianoMp:'pianoMultiGuard' }, '', location.href);
            else history.replaceState({ papianoMp:'pianoMultiGuard' }, '', location.href);
            mpHistoryArmed = true;
        }catch(e){}
    }

    function closeLeaveConfirm(){
        const source = leaveConfirmSource;
        leaveConfirmSource = null;
        leaveConfirm?.classList.remove('show');
        leaveConfirm?.setAttribute('aria-hidden', 'true');
        return source;
    }
    function openLeaveConfirm(source = 'button'){
        leaveConfirmSource = source;
        leaveConfirm?.classList.add('show');
        leaveConfirm?.setAttribute('aria-hidden', 'false');
    }
    function requestLeaveRoom(source = 'button'){
        if(isSolo()){ window.location.assign('/'); return; }
        if(isInPianoRoom()) openLeaveConfirm(source);
        else leaveRoomToHome();
    }
    function stayInPianoRoom(){
        const source = closeLeaveConfirm();
        if(source === 'history') armPianoHistory();
    }

    async function leaveFirebaseRoom(){
        if(typeof flushRoomNoteEvents === 'function') flushRoomNoteEvents();
        if(!firebaseReady || !dbApi || !currentRoom) return;
        const room = currentRoom;
        const seat = currentRoomSeat || Number(roomPlayersByRoom[room.id]?.[mpSelfId]?.seat || 0);
        try{ await dbApi.remove(dbRef(`roomPlayers/${room.id}/${mpSelfId}`)); }catch(e){}
        await releaseRoomSeat(room, seat);
        try{ await dbApi.remove(dbRef(`streams/${room.id}/${mpSelfId}`)); }catch(e){}
        try{ await writeSelfUser({ room:null, online:true }); }catch(e){}
        currentRoomSeat = 0;
        roomSessionId = '';
        let nextCount = 0;
        try{
            const snap = await dbApi.get(dbRef(`roomPlayers/${room.id}`));
            const live = snap.val() || {};
            roomPlayersByRoom[room.id] = live;
            nextCount = activeRoomPlayerEntries(live).length;
            room.count = nextCount;
            room.activeCount = nextCount;
            await updateRoomActiveCount(room, nextCount);
        }catch(e){}
        if(nextCount <= 0) window.setTimeout(() => deleteEmptyRoom(room), ROOM_EMPTY_DELETE_DELAY_MS);
    }

    function leaveRoomToHome(){
        if(isSolo()){ window.location.assign('/'); return; }
        closeLeaveConfirm();
        if(typeof stopAllNotes === 'function') stopAllNotes();
        clearRoomSubscriptions();
        if(roomPlayerDisconnect){ try{ roomPlayerDisconnect.cancel(); }catch(e){} roomPlayerDisconnect = null; }
        if(warmRemoteTimer){ clearTimeout(warmRemoteTimer); warmRemoteTimer = 0; }
        stopRoomPresenceHeartbeat();
        stopRoomIdleWatch();
        leaveFirebaseRoom();
        const user = currentUser();
        if(user) user.room = null;
        currentRoom = null;
        messages.splice(0, messages.length);
        remoteSustainByPlayer.clear();
        remotePedalHeldNotes.clear();
        streamSeqByPlayer.clear();
        remotePerformanceByPlayer.clear();
        seenEventKeys.clear();
        roomSessionId = '';
        currentRoomSeat = 0;
        forcedLeaveRoomId = '';
        lastSentPerformanceSignature = '';
        currentScreen = 'home';
        mpHistoryArmed = false;
        setRoomActive(false, { skipHistory:true });
        showLayer('home');
        replaceMpHistory('multiHome');
        if(isStagePianoPage()) window.location.replace('multiplayer.html');
    }

    function mpSelfHasPermission(permName){
        // Permissions are no longer role-based in the simplified system
        return false;
    }
    function canModeratePlayer(player){
        if(!player || !isInPianoRoom() || !currentRoom) return false;
        if(player.id === currentUser().id) return false;
        if(player.room !== currentRoom.id) return false;
        if(getState(player.id).banned) return false;
        return isRoomOwner() || mpSelfHasPermission('kick_player') || mpSelfHasPermission('ban_user') || mpSelfHasPermission('mute_chat') || mpSelfHasPermission('mute_playing');
    }
    function showLayer(screen='home', options = {}){
        currentScreen = screen;
        document.body.classList.add('mp-lobby-open');
        attachRoomsListener();
        attachUsersListener();
        document.body.classList.remove('mp-chat-open','mp-profile-open','mp-chat-keyboard','mp-chat-dismissed');
        if(profile) profile.classList.remove('show');
        document.querySelectorAll('[data-mp-screen]').forEach(item => item.classList.toggle('active', item.dataset.mpScreen === screen));
        roomButton.classList.add('active');
        if(screen === 'home') renderRooms();
        if(screen === 'search') renderSearch();
        if(screen === 'create') syncRoomType();
        if(!options.skipHistory && !isInPianoRoom()){
            if(screen === 'home') replaceMpHistory('multiHome');
            else pushMpHistory(screen);
        }
    }

    function hideLayer(){
        document.body.classList.remove('mp-lobby-open');
        roomButton.classList.toggle('active', document.body.classList.contains('mp-chat-open'));
    }

    function scheduleRenderRooms(){
        if(renderRoomsTimer) return;
        renderRoomsTimer = window.setTimeout(() => {
            renderRoomsTimer = 0;
            if(currentScreen === 'home') renderRooms();
        }, 180);
    }


    function closeLobbyToSolo(){
        // Return to the main Papiano app from any multiplayer entry URL.
        window.location.assign('/');
    }

    function setChatOpen(open, options = {}){
        const willOpen = !!open;
        document.body.classList.toggle('mp-chat-open', willOpen);
        document.body.classList.toggle('mp-chat-dismissed', !willOpen && options.dismiss !== false);
        if(willOpen) document.body.classList.remove('mp-chat-dismissed');
        roomButton.classList.toggle('active', willOpen);
        if(!willOpen) setChatKeyboardActive(false);
        refreshChatViewport();
        renderChatPreview();
        if(willOpen){
            pushMpHistory('chat');
            renderMessages();
            updateChatCounter();
            bumpChatActivity();
        }else{
            clearChatIdleTimer();
            document.body.classList.remove('mp-chat-idle');
        }
    }

    function setRoomActive(active, options = {}){
        if(!active) setPianoInputReady(false);
        document.body.classList.toggle('mp-room-active', !!active);
        roomButton.textContent = active ? 'Chat' : 'Rooms';
        roomButton.classList.remove('active');
        if(active && !options.skipHistory) armPianoHistory();
        hideLayer();
        setChatOpen(false);
        renderRoomChrome();
    }

    function resetRoomStreamSession(){
        roomStreamSeq = 0;
        roomStreamSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        lastSentPerformanceSignature = '';
    }

    let _roomPlayersReadyResolve = null;
    let _roomPlayersReadyPromise = null;

    function _createRoomPlayersReadyGate(){
        _roomPlayersReadyPromise = new Promise(resolve => { _roomPlayersReadyResolve = resolve; });
        // Safety timeout — never block UI forever if Firebase is dead
        const timeout = setTimeout(() => { if(_roomPlayersReadyResolve){ _roomPlayersReadyResolve(); _roomPlayersReadyResolve = null; } }, 4000);
        const origResolve = _roomPlayersReadyResolve;
        _roomPlayersReadyResolve = () => { clearTimeout(timeout); origResolve(); _roomPlayersReadyResolve = null; };
    }

    async function enterPianoRoom(){
        if(!currentRoom) return;
        setPianoInputReady(false);
        resetRoomStreamSession();
        currentScreen = 'pianoMulti';
        syncSelfInstrumentState(true);
        startBackgroundSoundfont();
        _createRoomPlayersReadyGate();
        subscribeRoomData(currentRoom.id);
        startRoomPresenceHeartbeat();
        // Wait for first roomPlayers snapshot before showing the room
        if(_roomPlayersReadyPromise) await _roomPlayersReadyPromise;
        setRoomActive(true);
        startRoomIdleWatch();
        scheduleWarmRemoteInstruments(700);
        window.setTimeout(() => {
            if(window.PapianoMultiplayer && typeof window.PapianoMultiplayer.sendSustainState === 'function') window.PapianoMultiplayer.sendSustainState();
        }, 120);
    }

    function touchRoomPresence(){
        if(!firebaseReady || !dbApi || !currentRoom || !isInPianoRoom()) return;
        const now = Date.now();
        // Re-assert the current valid name each heartbeat so a returning player is
        // never left showing a stale fallback name in the room list.
        const roomUpdate = { lastSeen:now, lastActive:now, room:currentRoom.id };
        const selfName = (currentUser() && currentUser().name) || '';
        if(selfName) roomUpdate.name = selfName;
        dbApi.update(dbRef(`roomPlayers/${currentRoom.id}/${mpSelfId}`), roomUpdate).catch(() => {});
        dbApi.update(dbRef(`users/${mpSelfId}`), { room:currentRoom.id, online:true, lastSeen:now, lastActive:now, updatedAt:now }).catch(() => {});
        // Prune ghost players on every heartbeat
        const live = roomPlayersByRoom[currentRoom.id];
        if(live) pruneStaleRoomPlayers(currentRoom.id, live);
    }

    function startRoomPresenceHeartbeat(){
        if(roomPresenceTimer) clearInterval(roomPresenceTimer);
        touchRoomPresence();
        roomPresenceTimer = window.setInterval(touchRoomPresence, ROOM_HEARTBEAT_MS);
    }

    function stopRoomPresenceHeartbeat(){
        if(roomPresenceTimer) clearInterval(roomPresenceTimer);
        roomPresenceTimer = 0;
    }

    // ── AFK auto-leave ───────────────────────────────────────────────────────────
    // A player sitting in a room without any real interaction for 20 minutes is
    // sent back to the multiplayer home. The presence heartbeat keeps writing
    // lastActive on its own, so without this an idle tab would linger forever and
    // leave a ghost seat / stale name pill in the room.
    const ROOM_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
    let _lastRoomActivityTs = Date.now();
    let _roomIdleTimer = 0;

    function bumpRoomActivity(){ _lastRoomActivityTs = Date.now(); }
    window.__mpActivity = bumpRoomActivity;

    function startRoomIdleWatch(){
        stopRoomIdleWatch();
        if(isSolo()) return; // solo piano never auto-leaves
        _lastRoomActivityTs = Date.now();
        _roomIdleTimer = window.setInterval(() => {
            if(isSolo() || !isInPianoRoom()) return;
            if(Date.now() - _lastRoomActivityTs >= ROOM_IDLE_TIMEOUT_MS){
                stopRoomIdleWatch();
                showToast('You were inactive for 20 minutes, so you left the room.', { type:'info', title:'Online Room' });
                leaveRoomToHome();
            }
        }, 30000);
    }

    function stopRoomIdleWatch(){
        if(_roomIdleTimer){ clearInterval(_roomIdleTimer); _roomIdleTimer = 0; }
    }

    // Any genuine user interaction resets the idle clock. Note playing also calls
    // window.__mpActivity directly (covers MIDI hardware with no DOM events).
    ['pointerdown','keydown','touchstart'].forEach(evt => {
        document.addEventListener(evt, bumpRoomActivity, { passive:true, capture:true });
    });

    function touchGlobalPresence(){
        if(!firebaseReady || !dbApi || !mpSelfId || mpSelfId === 'local_self') return;
        const now = Date.now();
        dbApi.update(dbRef(`users/${mpSelfId}`), { online:true, lastSeen:now, updatedAt:now }).catch(() => {});
    }

    function startGlobalPresenceHeartbeat(){
        if(globalPresenceTimer) clearInterval(globalPresenceTimer);
        touchGlobalPresence();
        globalPresenceTimer = window.setInterval(touchGlobalPresence, GLOBAL_HEARTBEAT_MS);
    }

    function stopGlobalPresenceHeartbeat(){
        if(globalPresenceTimer) clearInterval(globalPresenceTimer);
        globalPresenceTimer = 0;
    }

    function renderRooms(){
        syncAuthUi();
        const list = visibleRooms().slice(0, MAX_ROOMS);
        const isRoomMax = activeRoomTotal() >= MAX_ROOMS;
        const createButtons = layer.querySelectorAll('[data-mp-go="create"]');
        createButtons.forEach(button => {
            button.disabled = isRoomMax;
            button.textContent = isRoomMax ? 'Rooms Full' : 'Host Room';
        });
        if(!list.length){
            homeRooms.innerHTML = '<div class="mp-empty">No rooms yet.</div>';
            return;
        }
        homeRooms.innerHTML = list.map((room, index) => {
            const count = roomCount(room);
            const isFull = count >= room.max;
            const actionText = isFull ? 'Full' : room.mode === 'Private' ? 'Code' : 'Join';
            const displayNumber = roomDisplayNumber(room, index);
            return `
                <button class="mp-room-card${isFull ? ' disabled' : ''}" type="button" data-mp-join="${escapeHtml(room.id)}" ${isFull ? 'disabled aria-disabled="true"' : ''}>
                    <span class="mp-room-number">Room #${displayNumber}</span>
                    <b class="mp-room-title">${escapeHtml(room.name)}</b>
                    <span class="mp-room-owner">${escapeHtml(room.owner)} · ${escapeHtml(room.mode)}</span>
                    <span class="mp-room-badge">${count}/${room.max}</span>
                    <strong class="mp-room-status${isFull ? ' full' : ''}">${actionText}</strong>
                </button>
            `;
        }).join('');
    }

    async function renderSearch(){
        const token = ++searchRenderToken;
        if(token !== searchRenderToken) return;
        const mode = mpSearchStatusFilter === 'friends' ? 'friends' : 'online';

        statusFilterButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.mpStatusFilter === mode);
        });

        let list = [];
        if(mode === 'friends'){
            list = Array.from(friendIds).map(id => {
                const local = players.find(player => player.id === id);
                return local || friendProfiles.get(id) || normalizePlayer(id, { id, name:'Player', online:false });
            }).filter(player => isAuthenticatedDisplayPlayer(player));
        }else{
            const source = currentRoom ? activePlayers() : players;
            list = source.filter(player => isAuthenticatedDisplayPlayer(player) && player.online === true && !(player.lastSeen > 0 && (Date.now() - player.lastSeen) >= ONLINE_STALE_MS));
        }

        list = list.sort((a,b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

        const emptyText = mode === 'friends' ? 'No friends yet.' : 'No online players.';
        searchResults.innerHTML = list.map(player => {
            const isOnline = player.online === true && !(player.lastSeen > 0 && (Date.now() - player.lastSeen) >= ONLINE_STALE_MS);
            const statusText = isOnline ? 'Online' : 'Offline';
            const statusClass = isOnline ? 'online' : 'offline';
            const meta = [player.displayUserId || player.userId, player.id === mpSelfId ? 'You' : (mode === 'friends' ? 'Friend' : ''), player.room ? 'In room' : ''].filter(Boolean).join(' · ');
            return `
                <button class="mp-search-card" type="button" data-mp-player="${escapeHtml(player.id)}">
                    ${avatarMarkup(player)}
                    <span class="mp-search-card-text"><b>${escapeHtml(player.name)}</b><span>${escapeHtml(meta)}</span></span>
                    <strong class="mp-player-status-badge ${statusClass}">${statusText}</strong>
                </button>
            `;
        }).join('') || `<div class="mp-empty">${emptyText}</div>`;
    }

    function renderRoomChrome(){
        if(!currentRoom){
            roomChromeSignature = '';
            playerStrip.innerHTML = '';
            playerPillMap.clear();
            if(chatPreview) chatPreview.innerHTML = '';
            chatTitle.textContent = 'Room Chat';
            chatSub.textContent = 'No room active';
            return;
        }
        const list = activePlayers();
        const count = list.length;
        const signature = currentRoom.id + '|' + list.map(player => {
            const s = getState(player.id);
            return [player.id, player.name, player.photoURL || '', playerColor(player), playerMainInstrumentText(player), playerLayerInstrumentText(player), s.muteInstrument ? '1' : '0', isFriend(player.id) ? '1' : '0'].join('¦');
        }).join('§');
        if(roomChromeSignature !== signature){
            roomChromeSignature = signature;
            playerStrip.innerHTML = list.map(player => {
                const s = getState(player.id);
                return `
                    <button class="mp-player-pill${s.muteInstrument ? ' is-muted' : ''}" type="button" data-mp-player="${escapeHtml(player.id)}" style="--mp-player-color:${escapeHtml(playerColor(player))}" aria-label="${escapeHtml(player.name)}">
                        ${avatarMarkup(player)}
                        <span class="mp-player-text">
                            <span class="mp-player-name">${escapeHtml(player.name)}</span>
                        </span>
                    </button>
                `;
            }).join('');
            playerPillMap.clear();
            playerStrip.querySelectorAll('[data-mp-player]').forEach(item => playerPillMap.set(item.dataset.mpPlayer, item));
        }
        chatTitle.textContent = currentRoom.name;
        chatSub.textContent = `${count} / ${currentRoom.max} online`;
        updateAllPlayerActivityUi();
    }

    function visibleRoomMessages(){
        return messages.filter(message => {
            const s = getState(message.playerId);
            return !s.banned && !s.muteChat && !isPlayerBlocked(message.playerId);
        });
    }

    function chatPreviewLimit(){
        const vv = window.visualViewport;
        const width = Math.round(vv ? vv.width : window.innerWidth);
        const height = Math.round(vv ? vv.height : window.innerHeight);
        const landscape = width > height;
        let quota = 3;
        if(width >= 1024 && height >= 560) quota = 6;
        else if(width >= 768) quota = landscape ? 5 : 4;
        else if(landscape && height < 430) quota = 2;
        const piano = document.getElementById('pianoWrap');
        const pianoHeight = piano ? piano.getBoundingClientRect().height : Math.round(height * 0.25);
        const strip = document.getElementById('mpPlayerStrip');
        const stripRect = strip ? strip.getBoundingClientRect() : null;
        const topReserve = (stripRect && stripRect.bottom > 0)
            ? Math.round(stripRect.bottom + 10)
            : (width <= 767 ? 104 : 116);
        const available = Math.max(42, height - pianoHeight - topReserve - 20);
        const fit = Math.max(1, Math.floor(available / (width >= 768 ? 74 : 68)));
        return Math.max(1, Math.min(quota, fit));
    }

    function chatAvatarContent(player){
        const photo = String(player?.photoURL || '').trim();
        if(photo) return `<img src="${escapeHtml(photo)}" alt="${escapeHtml(player.name || 'Player')}">`;
        const parts = String(player?.name || 'P').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        const initials = (parts.map(part => part[0]).join('') || 'P').toUpperCase();
        return escapeHtml(initials);
    }

    function renderChatPreview(){
        if(!chatPreview) return;
        if(!currentRoom){
            chatPreview.innerHTML = '';
            return;
        }
        const limit = chatPreviewLimit();
        chatPreview.style.setProperty('--mp-chat-preview-rows', String(limit));
        chatPreview.innerHTML = visibleRoomMessages().slice(-limit).map(message => {
            const player = getPlayer(message.playerId);
            const mine = message.playerId === currentUser().id;
            return `
                <button class="mp-chat-preview-item${mine ? ' mine' : ''}" type="button" data-mp-open-chat="1" data-mp-message-open="${escapeHtml(message.id)}" aria-label="Open room chat">
                    <span class="mp-chat-preview-head">
                        <span class="mp-chat-preview-profile">
                            <span class="mp-chat-preview-avatar" style="--mp-player-color:${escapeHtml(playerColor(player))}">${chatAvatarContent(player)}</span>
                            <span class="mp-chat-preview-name">${escapeHtml(player.name)}</span>
                        </span>
                        <span class="mp-chat-preview-time">${escapeHtml(message.time)}</span>
                    </span>
                    <span class="mp-chat-preview-text">${escapeHtml(message.text)}</span>
                    <span class="mp-chat-preview-foot"><span class="mp-chat-preview-reply" aria-hidden="true">${MP_REPLY_ICON}</span></span>
                </button>
            `;
        }).join('');
    }

    function renderMessages(){
        const meId = currentUser().id;
        messagesBox.innerHTML = visibleRoomMessages().map(message => {
            const player = getPlayer(message.playerId);
            const color = playerColor(player);
            const quote = message.replyTo ? `<span class="mp-quote"><b>${escapeHtml(message.replyTo.name)}</b><span>${escapeHtml(message.replyTo.text)}</span></span>` : '';
            return `
                <button class="mp-message${message.playerId === meId ? ' mine' : ''}" type="button" data-mp-message="${escapeHtml(message.id)}" aria-label="Reply to ${escapeHtml(player.name)}">
                    <span class="mp-message-avatar" style="--mp-player-color:${escapeHtml(color)}">${chatAvatarContent(player)}</span>
                    <span class="mp-bubble">
                        ${quote}
                        <span class="mp-message-name" style="color:${escapeHtml(color)}">${escapeHtml(player.name)}</span>
                        <span class="mp-message-text">${escapeHtml(message.text)}</span>
                    </span>
                </button>
            `;
        }).join('');
        renderChatPreview();
        requestAnimationFrame(() => {
            messagesBox.scrollTop = messagesBox.scrollHeight;
        });
    }

    function setReply(message){
        replyTarget = message ? { name:getPlayer(message.playerId).name, text:message.text.length > 42 ? message.text.slice(0,42) + '...' : message.text } : null;
        replyBar.classList.toggle('active', !!replyTarget);
        if(replyTarget){
            replyName.textContent = replyTarget.name;
            replyText.textContent = replyTarget.text;
        }
    }

    function resizeChatInput(){
        if(!chatInput) return;
        chatInput.style.height = '42px';
        chatInput.style.height = Math.min(90, Math.max(42, chatInput.scrollHeight || 42)) + 'px';
    }

    function updateChatCounter(){
        if(!chatCounter || !chatInput) return;
        const length = Math.min(CHAT_MAX_LENGTH, String(chatInput.value || '').length);
        chatCounter.textContent = `${length}/${CHAT_MAX_LENGTH}`;
        chatCounter.classList.toggle('full', length >= CHAT_MAX_LENGTH);
        resizeChatInput();
    }

    function cleanChatText(text){
        return String(text || '').trim().replace(/\s+/g, ' ').slice(0, CHAT_MAX_LENGTH);
    }

    function canSendRoomChat(user, now = Date.now()){
        if(!currentRoom || !user) return false;
        if(currentRoom.chatEnabled === false){
            showToast('Room chat is disabled.', { type:'info', title:'Room Chat' });
            return false;
        }
        const userState = getState(user.id);
        if(userState.banned || userState.muteChat){
            showToast('You are muted in this room.', { type:'error', title:'Room Chat' });
            return false;
        }
        while(chatSendTimes.length && now - chatSendTimes[0] > CHAT_BURST_WINDOW_MS) chatSendTimes.shift();
        const last = chatSendTimes[chatSendTimes.length - 1] || 0;
        if(last && now - last < CHAT_COOLDOWN_MS){
            showToast(`Wait ${compactSeconds(CHAT_COOLDOWN_MS - (now - last))}s before sending again.`, { type:'info', title:'Room Chat' });
            return false;
        }
        if(chatSendTimes.length >= CHAT_BURST_LIMIT){
            showToast('Chat rate limit reached. Slow down.', { type:'error', title:'Room Chat' });
            return false;
        }
        chatSendTimes.push(now);
        return true;
    }

    async function addMessage(text){
        const clean = cleanChatText(text);
        if(!clean || !currentRoom) return;
        const user = currentUser();
        const now = Date.now();
        if(!canSendRoomChat(user, now)) return;
        const payload = {
            playerId:user.id,
            text:clean,
            createdAt:now,
            time:timeLabel(now),
            replyTo:replyTarget || null
        };
        chatInput.value = '';
        updateChatCounter();
        resizeChatInput();
        setReply(null);
        if(firebaseReady && dbApi){
            try{ await dbApi.push(dbRef(`messages/${currentRoom.id}`), payload); }
            catch(e){ showToast('Couldn’t send message. Try again.', { type:'error', title:'Online Room' }); }
        }else{
            messages.push({ id:'m' + now, ...payload });
            if(messages.length > 60) messages.splice(0, messages.length - 60);
            renderMessages();
        }
        markPlayerActivity(user.id, 'active');
        pulsePlayer(user.id);
    }

    function isFriend(playerId){
        const id = String(playerId || '');
        return !!id && id !== mpSelfId && friendIds.has(id);
    }


    function canOfferFriend(player){
        return !!player && isInPianoRoom() && isSignedIn() && firebaseReady && dbApi && isAuthenticatedDisplayPlayer(player) && player.id !== mpSelfId && !isFriend(player.id);
    }

    function syncFriendAction(player){
        if(!friendAction) return;
        const show = canOfferFriend(player);
        friendAction.hidden = !show;
        friendAction.style.display = show ? '' : 'none';
        friendAction.disabled = !show;
        friendAction.classList.remove('active');
        friendAction.textContent = 'Add Friend';
    }

    async function toggleFriend(player){
        if(!canOfferFriend(player)) return;
        const id = String(player.id);
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)){
            showToast('Friends are not available right now.', { type:'error', title:'Friends' });
            return;
        }
        try{
            const pairId = mpBuildPairId(mpSelfId, id);
            const ref = fsApi.doc(fsDb, 'friendships', pairId);
            const snap = await fsApi.getDoc(ref);
            if(snap && (typeof snap.exists === 'function' ? snap.exists() : snap.exists)){
                const status = (snap.data && snap.data() || {}).status;
                showToast(status === 'accepted' ? 'Already friends.' : 'Request already sent.', { type:'info', title:'Friends' });
                return;
            }
            await fsApi.setDoc(ref, {
                users:[mpSelfId, id],
                requesterId:mpSelfId,
                receiverId:id,
                status:'pending',
                createdAt:fsApi.serverTimestamp(),
                updatedAt:fsApi.serverTimestamp()
            });
            showToast('Friend request sent.', { type:'success', title:'Friends' });
            syncFriendAction(player);
        }catch(e){
            showToast('Couldn’t send friend request. Try again.', { type:'error', title:'Friends' });
        }
    }

    function updatePlayerActivityUi(id){
        const player = getPlayer(id);
        const pill = findPlayerPill(id);
        if(pill){
            pill.setAttribute('aria-label', player.name);
        }
        if(selectedPlayer && selectedPlayer.id === String(id) && profile.classList.contains('show')){
            if(profileCountry) profileCountry.textContent = profileCountryText(selectedPlayer);
            syncFriendAction(selectedPlayer);
            syncSafetyActions(selectedPlayer);
        }
    }

    function updateAllPlayerActivityUi(){
        if(!currentRoom) return;
        activePlayers().forEach(player => updatePlayerActivityUi(player.id));
    }

    function markPlayerActivity(id, type = 'active'){
        if(!id) return;
        const now = Date.now();
        const key = String(id);
        const current = playerActivity.get(key) || {};
        current.activeAt = now;
        if(type === 'playing') current.playedAt = now;
        playerActivity.set(key, current);
        const player = players.find(item => item.id === key);
        if(player){
            player.lastActive = now;
            player.lastSeen = now;
            if(type === 'playing') player.lastPlayed = now;
        }
        if(!activityUiRaf){
            activityUiRaf = requestAnimationFrame(() => {
                activityUiRaf = 0;
                if(currentRoom) updatePlayerActivityUi(key);
            });
        }
    }

    function countryFlagEmoji(code){
        const cc = String(code || '').trim().toUpperCase();
        if(!/^[A-Z]{2}$/.test(cc)) return '';
        return String.fromCodePoint(...[...cc].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
    }

    let countryNameLookup;
    function countryDisplayName(code){
        const cc = String(code || '').trim().toUpperCase();
        if(!/^[A-Z]{2}$/.test(cc)) return '';
        try{
            if(countryNameLookup === undefined){
                countryNameLookup = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type:'region' }) : null;
            }
            return (countryNameLookup && countryNameLookup.of(cc)) || cc;
        }catch(e){ return cc; }
    }

    function profilePlayHours(player){
        let seconds = Math.max(0, Number(player?.playTimeSeconds || 0));
        if(player?.id === mpSelfId){
            seconds = Math.max(seconds, Number(mpPlayTimeBaseSeconds || 0) + Number(mpPlayTimePending || 0));
        }
        const hours = Math.max(0, Math.floor(seconds / 3600));
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    function profileCountryText(player){
        const cc = String(player?.countryCode || '').trim().toUpperCase();
        if(!cc) return 'Not set';
        const flag = countryFlagEmoji(cc);
        const name = countryDisplayName(cc);
        return (flag ? flag + ' ' : '') + name;
    }

    function updateProfileVoteButtons(player, voteType = ''){
        const isSelf = !!player && player.id === mpSelfId;
        const disabled = !player || isSelf || !firebaseReady || !fsApi || !fsDb;
        if(profileLikeButton){
            profileLikeButton.disabled = disabled;
            profileLikeButton.classList.toggle('active', voteType === 'like');
        }
        if(profileDislikeButton){
            profileDislikeButton.disabled = disabled;
            profileDislikeButton.classList.toggle('active', voteType === 'dislike');
        }
    }

    async function loadProfileVote(player){
        if(!player || player.id === mpSelfId || !fsApi || !fsDb){
            updateProfileVoteButtons(player, '');
            return;
        }
        const cacheKey = player.id + ':' + mpSelfId;
        if(profileVoteCache.has(cacheKey)){
            updateProfileVoteButtons(player, profileVoteCache.get(cacheKey));
            return;
        }
        try{
            const snap = await fsApi.getDoc(fsApi.doc(fsDb, 'profiles', player.id, 'reactions', mpSelfId));
            const type = snap.exists() ? String(snap.data()?.type || '') : '';
            const vote = type === 'like' || type === 'dislike' ? type : '';
            profileVoteCache.set(cacheKey, vote);
            if(selectedPlayer && selectedPlayer.id === player.id) updateProfileVoteButtons(player, vote);
        }catch(e){
            updateProfileVoteButtons(player, '');
        }
    }

    function safeReactionCount(value){
        const count = Math.trunc(Number(value || 0));
        if(!Number.isFinite(count) || count < 0) return 0;
        return Math.min(count, 1000000);
    }

    function syncReportReasonButtons(){
        reportReasons?.querySelectorAll('[data-report-reason]').forEach(button => {
            button.classList.toggle('active', button.dataset.reportReason === selectedReportReason);
        });
    }
    function openReportModal(player){
        if(!canUseSafetyAction(player)) return;
        reportPlayer = player;
        selectedReportReason = 'Spam';
        if(reportTarget) reportTarget.textContent = `${player.name} · ${player.displayUserId || player.userId || player.id}`;
        if(reportDetail) reportDetail.value = '';
        syncReportReasonButtons();
        reportModal?.classList.add('show');
        reportModal?.setAttribute('aria-hidden', 'false');
        pushMpHistory('report');
    }
    function closeReportModal(){
        reportPlayer = null;
        reportModal?.classList.remove('show');
        reportModal?.setAttribute('aria-hidden', 'true');
    }
    function cleanReportDetail(value){ return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 300); }
    async function submitPlayerReport(){
        const player = reportPlayer;
        if(!canUseSafetyAction(player)) return;
        if(!fsApi || !fsDb || !mpSelfId || isLocalGuestPlayerId(mpSelfId)){
            showToast('Report is available after login.', { type:'error', title:'Report' });
            return;
        }
        const now = Date.now();
        const last = Number(reportCooldownByPlayer.get(player.id) || 0);
        if(last && now - last < REPORT_COOLDOWN_MS){
            showToast('Report already sent. Wait before sending another one.', { type:'info', title:'Report' });
            return;
        }
        const reportDocId = mpSelfId + '_' + player.id;
        try{
            const ref = fsApi.doc(fsDb, 'reports', reportDocId);
            const existing = await fsApi.getDoc(ref);
            if(existing && (typeof existing.exists === 'function' ? existing.exists() : existing.exists)){
                showToast('Already reported this user.', { type:'info', title:'Report' });
                closeReportModal();
                return;
            }
            await fsApi.setDoc(ref, {
                reporterId: mpSelfId,
                reporterName: currentUser().name,
                targetId: player.id,
                targetName: player.name,
                targetUserId: player.displayUserId || player.userId || '',
                reason: selectedReportReason || 'Other',
                source: 'multiplayer',
                roomId: currentRoom?.id || '',
                roomType: 'multiplayer',
                messageId: '',
                messageTextSnapshot: cleanReportDetail(reportDetail?.value),
                messageImageURL: '',
                messageSenderName: player.name,
                createdAt: fsApi.serverTimestamp()
            });
            reportCooldownByPlayer.set(player.id, now);
            closeReportModal();
            showToast('Report sent.', { type:'success', title:'Report' });
        }catch(e){
            showToast('Couldn\'t send report. Try again.', { type:'error', title:'Report' });
        }
    }

    async function castProfileVote(voteType){
        const player = selectedPlayer;
        if(!player || player.id === mpSelfId) return;
        if(voteType !== 'like' && voteType !== 'dislike') return;
        if(!firebaseReady || !fsApi || !fsDb || !isSignedIn()){
            showToast('Profile reactions are not available right now.', { type:'error', title:'Profile' });
            return;
        }
        const voteKey = player.id + ':' + mpSelfId;
        if(profileVoteInFlight.has(voteKey)) return;
        const now = Date.now();
        const lastVoteAt = Number(profileVoteCache.get(voteKey + ':at') || 0);
        if(lastVoteAt && now - lastVoteAt < PROFILE_REACTION_COOLDOWN_MS) return;
        profileVoteInFlight.add(voteKey);
        profileVoteCache.set(voteKey + ':at', now);
        if(profileLikeButton) profileLikeButton.disabled = true;
        if(profileDislikeButton) profileDislikeButton.disabled = true;
        try{
            const targetRef = fsApi.doc(fsDb, 'profiles', player.id);
            const voteRef = fsApi.doc(fsDb, 'profiles', player.id, 'reactions', mpSelfId);
            const result = await fsApi.runTransaction(fsDb, async transaction => {
                const [targetSnap, voteSnap] = await Promise.all([transaction.get(targetRef), transaction.get(voteRef)]);
                const targetData = targetSnap.exists() ? (targetSnap.data() || {}) : {};
                const oldTypeRaw = voteSnap.exists() ? String(voteSnap.data()?.type || '') : '';
                const oldType = oldTypeRaw === 'like' || oldTypeRaw === 'dislike' ? oldTypeRaw : '';
                const nextType = oldType === voteType ? '' : voteType;
                let likes = safeReactionCount(targetData.likes);
                let dislikes = safeReactionCount(targetData.dislikes);
                if(oldType === 'like') likes = Math.max(0, likes - 1);
                if(oldType === 'dislike') dislikes = Math.max(0, dislikes - 1);
                if(nextType === 'like') likes += 1;
                if(nextType === 'dislike') dislikes += 1;
                transaction.set(targetRef, { likes, dislikes, updatedAt:fsApi.serverTimestamp() }, { merge:true });
                if(nextType){
                    transaction.set(voteRef, { type:nextType, voterId:mpSelfId, updatedAt:fsApi.serverTimestamp() }, { merge:true });
                }else{
                    transaction.delete(voteRef);
                }
                return { likes, dislikes, vote:nextType };
            });
            profileVoteCache.set(voteKey, result.vote);
            const freshProfile = await loadHomeProfile(player.id, player, { force:true });
            const local = players.find(item => item.id === player.id);
            const target = applyHomeProfileToPlayer(local || player, freshProfile);
            if(local && local !== player) applyHomeProfileToPlayer(player, freshProfile);
            const likes = safeReactionCount(target.likes || freshProfile.likes);
            const dislikes = safeReactionCount(target.dislikes || freshProfile.dislikes);
            if(profileLikes) profileLikes.textContent = likes;
            if(profileDislikes) profileDislikes.textContent = dislikes;
            updateProfileVoteButtons(player, result.vote);
            profileCache.set(player.id, freshProfile);
        }catch(e){
            showToast('Couldn’t update reaction. Try again.', { type:'error', title:'Profile' });
            updateProfileVoteButtons(player, profileVoteCache.get(voteKey) || '');
        }finally{
            profileVoteInFlight.delete(voteKey);
        }
    }

    function renderProfile(player){
        if(!player) return;
        profileAvatar.textContent = '';
        profileAvatar.innerHTML = player.photoURL
            ? `<img src="${escapeHtml(player.photoURL)}" alt="${escapeHtml(player.name)}">`
            : escapeHtml((player.name || '?').trim().charAt(0).toUpperCase() || '?');
        profileAvatar.setAttribute('aria-label', player.name);
        profileAvatar.style.setProperty('--mp-player-color', playerColor(player));
        profileName.textContent = player.name;
        const _rl8300 = getRoleLabel(player.badgeId); const _rc8300 = getRoleColor(player.badgeId);
        profileRole.textContent = _rl8300;
        profileRole.dataset.rarity = '';
        if(_rc8300) profileRole.style.cssText = 'background:'+_rc8300+';color:'+contrastInk(_rc8300)+';';
        else profileRole.style.cssText = '';
        profileId.textContent = player.displayUserId || player.userId || 'ID pending';
        profileInstrument.textContent = playerMainInstrumentText(player);
        if(profileLayerInstrument) profileLayerInstrument.textContent = playerLayerInstrumentText(player);
        profileBio.textContent = player.bio;
        const mixer = getRemoteMixer(player.id);
        const isSelfProfile = player.id === mpSelfId;
        if(profileVolumeRow) profileVolumeRow.style.display = isSelfProfile ? 'none' : '';
        if(profileVolume) profileVolume.value = Math.round((mixer.volume ?? 1) * 100);
        if(profileVolumeValue) profileVolumeValue.textContent = (mixer.muted ? 'Muted · ' : '') + Math.round((mixer.volume ?? 1) * 100) + '%';
        if(profilePersonalMute){
            profilePersonalMute.textContent = mixer.muted ? 'Unmute' : 'Mute';
            profilePersonalMute.classList.toggle('active', !!mixer.muted);
        }
        if(profileLikes) profileLikes.textContent = Number(player.likes || 0);
        if(profileDislikes) profileDislikes.textContent = Number(player.dislikes || 0);
        if(profileCountry) profileCountry.textContent = profileCountryText(player);
        if(profilePlayTime) profilePlayTime.textContent = profilePlayHours(player);
        syncFriendAction(player);
        syncSafetyActions(player);
        const s = getState(player.id);
        const canModerate = canModeratePlayer(player);
        if(profileActions){
            const showFriend = canOfferFriend(player);
            const showSafety = canUseSafetyAction(player);
            profileActions.hidden = !canModerate && !showFriend && !showSafety;
            profileActions.style.display = canModerate || showFriend || showSafety ? '' : 'none';
        }
        [kickBan, muteChat, muteInst].forEach(button => {
            if(!button) return;
            button.hidden = !canModerate;
            button.style.display = canModerate ? '' : 'none';
            button.disabled = !canModerate;
        });
        if(canModerate){
            muteChat.disabled = s.banned;
            muteInst.disabled = s.banned;
            kickBan.disabled = s.banned;
        }
        muteChat.classList.toggle('active', s.muteChat);
        muteInst.classList.toggle('active', s.muteInstrument);
    }

    async function openProfile(id){
        const player = getPlayer(id);
        selectedPlayer = player;
        if(!isInPianoRoom()){
            openLobbyProfile(player);
            return;
        }
        const wasOpen = profile.classList.contains('show');
        renderProfile(player);
        updateProfileVoteButtons(player, profileVoteCache.get(player.id + ':' + mpSelfId) || '');
        loadProfileVote(player);
        profile.classList.add('show');
        document.body.classList.add('mp-profile-open');
        if(!wasOpen) pushMpHistory('profile');
        const fresh = await hydratePlayerProfile(player, { force:true });
        if(selectedPlayer && selectedPlayer.id === player.id && profile.classList.contains('show')){
            selectedPlayer = fresh;
            renderProfile(fresh);
            updateProfileVoteButtons(fresh, profileVoteCache.get(fresh.id + ':' + mpSelfId) || '');
            loadProfileVote(fresh);
            renderSearch();
            renderRoomChrome();
        }
    }

    function openLobbyProfile(player){
        if(!player) return;
        const overlay = document.getElementById('mpLobbyProfileOverlay');
        if(!overlay) return;
        const avatarEl = document.getElementById('mpLobbyProfileAvatar');
        const nameEl = document.getElementById('mpLobbyProfileName');
        const badgeEl = document.getElementById('mpLobbyProfileBadge');
        const playTimeEl = document.getElementById('mpLobbyProfilePlayTime');
        const flagEl = document.getElementById('mpLobbyProfileFlag');
        const idEl = document.getElementById('mpLobbyProfileId');
        const bioEl = document.getElementById('mpLobbyProfileBio');
        const likeVal = document.getElementById('mpLobbyLikeVal');
        const dislikeVal = document.getElementById('mpLobbyDislikeVal');
        const likeBtn = document.getElementById('mpLobbyLikeBtn');
        const dislikeBtn = document.getElementById('mpLobbyDislikeBtn');
        const friendBtn = document.getElementById('mpLobbyFriendBtn');
        const chatBtn = document.getElementById('mpLobbyChatBtn');
        const unfriendBtn = document.getElementById('mpLobbyUnfriendBtn');
        const blockBtn = document.getElementById('mpLobbyBlockBtn');
        const reportBtn = document.getElementById('mpLobbyReportBtn');

        if(avatarEl){
            if(player.photoURL){
                avatarEl.innerHTML = '<img src="' + escapeHtml(player.photoURL) + '" alt="' + escapeHtml(player.name) + '">';
            } else {
                avatarEl.textContent = (player.name || '?').charAt(0).toUpperCase();
            }
        }
        if(nameEl) nameEl.textContent = player.name || 'Player';
        if(badgeEl){
            const _rl = getRoleLabel(player.badgeId); const _rc = getRoleColor(player.badgeId);
            badgeEl.textContent = _rl;
            if(_rc) badgeEl.style.cssText='background:'+_rc+';color:'+contrastInk(_rc)+';';
            else badgeEl.style.cssText='';
            badgeEl.className='mp-lobby-badge-pill';
        }
        if(flagEl){
            const country = profileCountryText(player);
            if(country && country !== '—'){ flagEl.textContent = country; flagEl.style.display = ''; }
            else flagEl.style.display = 'none';
        }
        if(idEl) idEl.textContent = player.displayUserId || player.userId || '—';
        if(bioEl) bioEl.textContent = player.bio || '—';
        if(playTimeEl) playTimeEl.textContent = profilePlayHours(player);
        if(likeVal) likeVal.textContent = Number(player.likes || 0);
        if(dislikeVal) dislikeVal.textContent = Number(player.dislikes || 0);

        likeBtn?.classList.remove('mp-lobby-voted');
        dislikeBtn?.classList.remove('mp-lobby-voted');
        const cached = profileVoteCache.get(player.id + ':' + mpSelfId) || '';
        if(cached === 'like') likeBtn?.classList.add('mp-lobby-voted');
        if(cached === 'dislike') dislikeBtn?.classList.add('mp-lobby-voted');

        const isSelf = player.id === mpSelfId;
        const alreadyFriend = isFriend(player.id);
        if(friendBtn) friendBtn.style.display = (isSelf || alreadyFriend) ? 'none' : 'inline-flex';
        if(chatBtn) chatBtn.style.display = (isSelf || !alreadyFriend) ? 'none' : 'inline-flex';
        if(unfriendBtn) unfriendBtn.style.display = (isSelf || !alreadyFriend) ? 'none' : 'inline-flex';
        if(blockBtn) blockBtn.style.display = isSelf ? 'none' : 'inline-flex';
        if(reportBtn) reportBtn.style.display = isSelf ? 'none' : 'inline-flex';

        if(likeBtn){
            likeBtn.onclick = () => { castProfileVote('like'); likeBtn.classList.add('mp-lobby-voted'); dislikeBtn?.classList.remove('mp-lobby-voted'); };
        }
        if(dislikeBtn){
            dislikeBtn.onclick = () => { castProfileVote('dislike'); dislikeBtn.classList.add('mp-lobby-voted'); likeBtn?.classList.remove('mp-lobby-voted'); };
        }
        if(friendBtn){
            friendBtn.onclick = () => {
                toggleFriend(player);
                const s = friendBtn.querySelector('span:last-child');
                if(s) s.textContent = 'Sent';
                friendBtn.disabled = true;
            };
        }
        if(chatBtn){
            chatBtn.onclick = () => { closeLobbyProfile(); };
        }
        if(unfriendBtn){
            unfriendBtn.onclick = () => {
                toggleFriend(player);
                unfriendBtn.style.display = 'none';
                if(chatBtn) chatBtn.style.display = 'none';
                if(friendBtn){ friendBtn.style.display = 'inline-flex'; friendBtn.disabled = false; const s = friendBtn.querySelector('span:last-child'); if(s) s.textContent = 'Add'; }
            };
        }
        if(blockBtn){ blockBtn.onclick = () => { toggleBlockedPlayer(player); closeLobbyProfile(); }; }
        if(reportBtn){ reportBtn.onclick = () => { closeLobbyProfile(); openReportModal(player); }; }

        overlay.classList.add('active');
        document.body.classList.add('mp-profile-open');
        pushMpHistory('profile');

        (async () => {
            const fresh = await hydratePlayerProfile(player, { force:true });
            if(selectedPlayer && selectedPlayer.id === player.id && overlay.classList.contains('active')){
                selectedPlayer = fresh;
                if(nameEl) nameEl.textContent = fresh.name || 'Player';
                if(badgeEl){
                    const _rl2 = getRoleLabel(fresh.badgeId); const _rc2 = getRoleColor(fresh.badgeId);
                    badgeEl.textContent = _rl2;
                    if(_rc2) badgeEl.style.cssText='background:'+_rc2+';color:'+contrastInk(_rc2)+';';
                    else badgeEl.style.cssText='';
                    badgeEl.className='mp-lobby-badge-pill';
                }
                if(idEl) idEl.textContent = fresh.displayUserId || fresh.userId || '—';
                if(bioEl) bioEl.textContent = fresh.bio || '—';
                if(playTimeEl) playTimeEl.textContent = profilePlayHours(fresh);
                if(likeVal) likeVal.textContent = Number(fresh.likes || 0);
                if(dislikeVal) dislikeVal.textContent = Number(fresh.dislikes || 0);
                if(flagEl){
                    const country = profileCountryText(fresh);
                    if(country && country !== '—'){ flagEl.textContent = country; flagEl.style.display = ''; }
                    else flagEl.style.display = 'none';
                }
                loadProfileVote(fresh);
                renderSearch();
            }
        })();
    }

    function closeLobbyProfile(){
        const overlay = document.getElementById('mpLobbyProfileOverlay');
        if(overlay) overlay.classList.remove('active');
        document.body.classList.remove('mp-profile-open');
    }

    window.PapianoMultiplayer = window.PapianoMultiplayer || {};
    window.PapianoMultiplayer.closeLobbyProfile = closeLobbyProfile;

    (function bindLobbyProfileClose(){
        const overlay = document.getElementById('mpLobbyProfileOverlay');
        const xBtn = document.getElementById('mpLobbyProfileCloseX');
        const closeBtn = document.getElementById('mpLobbyProfileCloseBtn');
        if(overlay) overlay.addEventListener('click', function(e){ if(e.target === overlay) closeLobbyProfile(); });
        if(xBtn) xBtn.addEventListener('click', closeLobbyProfile);
        if(closeBtn) closeBtn.addEventListener('click', closeLobbyProfile);
    })();

    function closeProfile(){
        if(!isInPianoRoom()){
            closeLobbyProfile();
            return;
        }
        profile.classList.remove('show');
        document.body.classList.remove('mp-profile-open');
    }

    function syncMaxPlayers(){
        const value = Math.min(6, Math.max(2, Number(maxPlayersInput?.value) || 6));
        if(maxPlayersInput) maxPlayersInput.value = String(value);
        if(maxPlayersLabel) maxPlayersLabel.textContent = value + ' Players';
        maxPlayersModal?.querySelectorAll('[data-mp-max-choice]').forEach(button => {
            button.classList.toggle('active', Number(button.dataset.mpMaxChoice) === value);
        });
    }
    function openMaxPlayersModal(){ syncMaxPlayers(); maxPlayersModal?.classList.add('show'); maxPlayersModal?.setAttribute('aria-hidden', 'false'); pushMpHistory('maxPlayers'); }
    function closeMaxPlayersModal(){ maxPlayersModal?.classList.remove('show'); maxPlayersModal?.setAttribute('aria-hidden', 'true'); }
    function setMaxPlayers(value){ if(maxPlayersInput) maxPlayersInput.value = String(Math.min(6, Math.max(2, Number(value) || 6))); syncMaxPlayers(); closeMaxPlayersModal(); }

    function syncRoomType(){
        const mode = roomModeInput?.value === 'Private' ? 'Private' : 'Public';
        if(roomTypeLabel) roomTypeLabel.textContent = mode === 'Private' ? 'Private Room' : 'Open Room';
        if(roomTypeMeta) roomTypeMeta.textContent = mode === 'Private' ? 'Password required' : 'Open room. No password required.';
        if(roomTypeButton) roomTypeButton.dataset.mode = mode;
        if(roomPasswordField) roomPasswordField.hidden = mode !== 'Private';
        if(roomPasswordInput){ roomPasswordInput.disabled = mode !== 'Private'; if(mode !== 'Private') roomPasswordInput.value = ''; }
        roomTypeModal?.querySelectorAll('[data-mp-room-type-choice]').forEach(button => button.classList.toggle('active', button.dataset.mpRoomTypeChoice === mode));
    }
    function openRoomTypeModal(){ roomTypeModal?.classList.add('show'); roomTypeModal?.setAttribute('aria-hidden', 'false'); pushMpHistory('roomType'); }
    function closeRoomTypeModal(){ roomTypeModal?.classList.remove('show'); roomTypeModal?.setAttribute('aria-hidden', 'true'); }
    function setRoomType(mode){ if(roomModeInput) roomModeInput.value = mode === 'Private' ? 'Private' : 'Public'; syncRoomType(); closeRoomTypeModal(); }

    function refreshAll(){
        renderRooms();
        renderRoomChrome();
        renderMessages();
        renderSearch();
        if(selectedPlayer && profile.classList.contains('show')) openProfile(selectedPlayer.id);
    }

    // Private rooms are gated server-side at /api/private-room — the RTDB
    // rules require a fresh roomGrants/{roomId}/{uid} entry before allowing
    // a non-owner write into roomPlayers, and only the Vercel function can
    // mint that grant (it owns roomSecrets via Admin SDK). callPrivateRoomApi
    // returns { ok:true } on success or { ok:false, reason } on failure.
    async function callPrivateRoomApi(action, roomId, password){
        try{
            const user = firebaseAuth?.currentUser;
            if(!user) return { ok:false, reason:'not signed in' };
            const idToken = await user.getIdToken();
            const response = await fetch('/api/private-room', {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                body:JSON.stringify({ action, idToken, roomId, password:String(password || '') })
            });
            const data = await response.json().catch(() => ({}));
            return data && typeof data === 'object' ? data : { ok:false, reason:'bad response' };
        }catch(e){
            return { ok:false, reason:'network' };
        }
    }

    function openPasswordModal(room){
        pendingPasswordRoom = room;
        if(passwordRoom) passwordRoom.textContent = `${room.name} · ${roomCount(room)}/${room.max}`;
        if(passwordInput) passwordInput.value = '';
        if(passwordError) passwordError.textContent = '';
        passwordModal?.classList.add('show');
        passwordModal?.setAttribute('aria-hidden', 'false');
        pushMpHistory('password');
        window.setTimeout(() => passwordInput?.focus(), 40);
    }
    function closePasswordModal(){
        pendingPasswordRoom = null;
        passwordModal?.classList.remove('show');
        passwordModal?.setAttribute('aria-hidden', 'true');
        if(passwordError) passwordError.textContent = '';
    }
    let passwordSubmitBusy = false;
    async function submitPasswordModal(){
        if(!pendingPasswordRoom || passwordSubmitBusy) return;
        const value = passwordInput?.value || '';
        const room = pendingPasswordRoom;
        if(firebaseReady && dbApi){
            // Guard against double-submit (Enter + click, or impatient taps):
            // the API round-trip is async, so without this two joins could race.
            passwordSubmitBusy = true;
            if(passwordSubmit) passwordSubmit.disabled = true;
            let result;
            try{ result = await callPrivateRoomApi('check', room.id, value); }
            finally{ passwordSubmitBusy = false; if(passwordSubmit) passwordSubmit.disabled = false; }
            if(!result?.ok){
                if(passwordError){
                    passwordError.textContent = result?.reason === 'wrong password' ? 'Incorrect password.'
                        : result?.reason === 'not signed in' ? 'Sign in to join.'
                        : 'Couldn’t verify. Try again.';
                }
                return;
            }
        }else if(value !== room.password){
            if(passwordError) passwordError.textContent = 'Incorrect password.';
            return;
        }
        closePasswordModal();
        if(isHomeMultiplayerPage()){ openStagePiano({ action:'join', roomId:room.id, password:value }); return; }
        enterRoom(room);
    }

    async function writeSelfUser(updates = {}){
        if(!firebaseReady || !dbApi) return;
        const user = currentUser();
        const payload = {
            id:user.id,
            name:user.name,
            uid:user.id,
            uidLabel:user.displayUserId || user.userId || '',
            userId:user.displayUserId || user.userId || '',
            publicId:user.publicId || 0,
            role:getRoleLabel(user.badgeId),
            badgeId:user.badgeId || 'player',
            photoURL:user.photoURL || '',
            instrumentKey:currentInstrumentKey(),
            instrument:currentInstrumentName(),
            stringsEnabled:!!stringEnabled,
            stringInstrumentKey:currentStringInstrumentKey(),
            stringInstrument:currentStringInstrumentName(),
            color:user.color,
            bio:user.bio || 'No bio yet.',
            desc:user.bio || 'No bio yet.',
            likes:user.likes || 0,
            dislikes:user.dislikes || 0,
            online:true,
            updatedAt:Date.now(),
            ...updates
        };
        await dbApi.update(dbRef(`users/${mpSelfId}`), payload);
    }

    function isRoomSeatNumber(room, seat){
        const max = Math.min(6, Math.max(2, Number(room?.max || 6)));
        return Number.isInteger(seat) && seat >= 1 && seat <= max;
    }

    function isStaleSeatValue(value, now = Date.now()){
        const seen = Number(value?.lastSeen || value?.joinedAt || 0);
        return seen > 0 && now - seen > ROOM_PLAYER_STALE_MS;
    }

    async function reserveRoomSeat(room, live = {}){
        if(!firebaseReady || !dbApi || !room) return 0;
        const max = Math.min(6, Math.max(2, Number(room.max || 6)));
        const now = Date.now();
        const existingSeat = Number(live?.[mpSelfId]?.seat || currentRoomSeat || 0);
        try{
            const result = await dbApi.runTransaction(dbRef(`roomSeats/${room.id}`), allSeats => {
                const seats = allSeats || {};
                // Check if already has a valid seat
                if(existingSeat >= 1 && existingSeat <= max){
                    const existing = seats[existingSeat];
                    if(existing && existing.uid === mpSelfId) return seats;
                    if(!existing || isStaleSeatValue(existing, now)){
                        seats[existingSeat] = { uid:mpSelfId, seat:existingSeat, joinedAt:now, lastSeen:now };
                        return seats;
                    }
                }
                // Find first available seat
                for(let s = 1; s <= max; s++){
                    const entry = seats[s];
                    if(!entry || entry.uid === mpSelfId || isStaleSeatValue(entry, now)){
                        seats[s] = { uid:mpSelfId, seat:s, joinedAt:now, lastSeen:now };
                        return seats;
                    }
                }
                return seats; // All taken
            });
            const committed = result?.snapshot?.val?.() || {};
            for(let s = 1; s <= max; s++){
                if(committed[s] && committed[s].uid === mpSelfId) return s;
            }
        }catch(e){}
        return 0;
    }

    async function releaseRoomSeat(room, seat){
        if(!firebaseReady || !dbApi || !room) return;
        const number = Number(seat || currentRoomSeat || 0);
        const removals = [];
        if(isRoomSeatNumber(room, number)) removals.push(dbApi.remove(dbRef(`roomSeats/${room.id}/${number}`)));
        removals.push(dbApi.remove(dbRef(`roomSeatClaims/${room.id}/${mpSelfId}`)));
        await Promise.allSettled(removals);
    }

    async function enterFirebaseRoom(room){
        if(!firebaseReady || !dbApi || !room || !isSignedIn()) return false;
        const user = currentUser();
        try{
            if(currentRoom && currentRoom.id !== room.id) await leaveFirebaseRoom();
            const now = Date.now();
            let live = roomPlayersByRoom[room.id] || null;
            try{
                const snap = await dbApi.get(dbRef(`roomPlayers/${room.id}`));
                live = snap.val() || {};
                roomPlayersByRoom[room.id] = live;
            }catch(e){}
            const activeCount = activeRoomPlayerEntries(live || {}).length;
            const alreadyInside = !!(live && live[mpSelfId]) || user.room === room.id;
            const modSnap = await dbApi.get(dbRef(`moderation/${room.id}/${mpSelfId}`)).catch(() => null);
            const moderation = modSnap?.val?.() || {};
            if(moderation.banned){
                showToast('You are banned from this room.', { type:'error', title:'Online Room' });
                return false;
            }
            if(!alreadyInside && activeCount >= room.max){
                showToast('Room is full.', { type:'error', title:'Online Room' });
                return false;
            }
            const seat = await reserveRoomSeat(room, live || {});
            if(!seat){
                showToast('Room is full.', { type:'error', title:'Online Room' });
                return false;
            }
            roomSessionId = makeRoomSessionId();
            currentRoomSeat = seat;
            forcedLeaveRoomId = '';
            const playerPayload = {
                id:user.id,
                name:user.name,
                uidLabel:user.displayUserId || user.userId || '',
                userId:user.displayUserId || user.userId || '',
                publicId:user.publicId || 0,
                role:getRoleLabel(user.badgeId),
                badgeId:user.badgeId || 'player',
                photoURL:user.photoURL || '',
                instrumentKey:currentInstrumentKey(),
                instrument:currentInstrumentName(),
                stringsEnabled:!!stringEnabled,
                stringInstrumentKey:currentStringInstrumentKey(),
                stringInstrument:currentStringInstrumentName(),
                color:user.color,
                bio:user.bio || 'No bio yet.',
                desc:user.bio || 'No bio yet.',
                likes:user.likes || 0,
                dislikes:user.dislikes || 0,
                online:true,
                room:room.id,
                seat,
                sessionId:roomSessionId,
                lastSeen:now,
                lastActive:now,
                joinedAt:alreadyInside ? Number(live?.[mpSelfId]?.joinedAt || now) : now,
                updatedAt:now
            };
            await dbApi.set(dbRef(`roomPlayers/${room.id}/${mpSelfId}`), playerPayload);
            currentRoom = room;
            user.room = room.id;
            roomPlayersByRoom[room.id] = { ...(live || {}), [mpSelfId]:playerPayload };
            const nextCount = activeRoomPlayerEntries(roomPlayersByRoom[room.id]).length;
            room.count = nextCount;
            room.activeCount = nextCount;
            await updateRoomActiveCount(room, nextCount);
            writeSelfUser({ room:room.id }).catch(() => {});
            try{
                roomPlayerDisconnect = dbApi.onDisconnect(dbRef(`roomPlayers/${room.id}/${mpSelfId}`));
                roomPlayerDisconnect.remove();
                dbApi.onDisconnect(dbRef(`roomSeats/${room.id}/${seat}`)).remove();
                dbApi.onDisconnect(dbRef(`roomSeatClaims/${room.id}/${mpSelfId}`)).remove();
                dbApi.onDisconnect(dbRef(`streams/${room.id}/${mpSelfId}`)).remove();
            }catch(e){}
            return true;
        }catch(e){
            await releaseRoomSeat(room, currentRoomSeat);
            currentRoomSeat = 0;
            roomSessionId = '';
            currentRoom = currentRoom && currentRoom.id === room.id ? null : currentRoom;
            user.room = null;
            showToast('Couldn’t update room. Try again.', { type:'error', title:'Online Room' });
            return false;
        }
    }

    async function requireSignedInAccount(){
        await initFirebase();
        const existing = firebaseAuth?.currentUser || null;
        if(existing){
            await applyAuthenticatedUser(existing);
            return true;
        }
        if(isSignedIn()) return true;
        showToast('Sign in from Papiano home first.', { type:'info', title:'Account Required' });
        return false;
    }

    async function openCreateScreen(){
        const ok = await requireSignedInAccount();
        if(!ok) return;
        const ownerRoom = await loadOwnedLiveRoom();
        if(ownerRoom){ await enterRoom(ownerRoom); return; }
        const createWait = roomCreateCooldownLeft();
        if(createWait > 0){ showToast(`Wait ${compactSeconds(createWait)}s before creating another room.`, { type:'info', title:'Host Room' }); return; }
        if(activeRoomTotal() >= MAX_ROOMS){ showToast('Room limit reached.', { type:'error', title:'Online Room' }); return; }
        showLayer('create');
    }

    async function enterRoom(room){
        if(!room) return false;
        if(!(await requireSignedInAccount())) return false;
        setPianoEntryLoading(12, 'Joining Room');
        try{
            if(firebaseReady){
                const ok = await enterFirebaseRoom(room);
                if(!ok){ hidePianoEntryLoading(); return false; }
            }else{
                const user = currentUser();
                if(user.room !== room.id){ user.room = room.id; room.count = Math.min(room.max, room.count + 1); }
                currentRoom = room;
            }
            await preparePianoEntryRuntime();
            await enterPianoRoom();
            await finalizePianoEntryRuntime();
            hidePianoEntryLoading();
            return true;
        }catch(e){
            hidePianoEntryLoading();
            showToast('Couldn’t enter room. Try again.', { type:'error', title:'Online Room' });
            return false;
        }
    }

    async function joinRoom(id){
        const room = rooms.find(item => item.id === id);
        if(!room || roomCount(room) >= room.max) return;
        if(!(await requireSignedInAccount())) return;
        if(room.mode === 'Private'){ openPasswordModal(room); return; }
        enterRoom(room);
    }

    async function quickMatch(){
        if(!(await requireSignedInAccount())) return;
        const room = visibleRooms().find(item => item.mode === 'Public' && roomCount(item) > 0 && roomCount(item) < item.max);
        if(room) joinRoom(room.id);
        else showToast('No public rooms are open.', { type:'info', title:'Online Room' });
    }

    async function reserveRoomSlot(){
        if(!firebaseReady || !dbApi || !isSignedIn()){
            const roomNumber = nextRoomNumber();
            return roomNumber ? { roomNumber, roomId:'room_' + roomNumber + '_' + Date.now().toString(36) } : null;
        }
        const knownRoomIds = new Set(rooms.map(room => room.id));
        for(let number = 1; number <= MAX_ROOMS; number++){
            const roomId = 'room_' + number + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
            const now = Date.now();
            try{
                const result = await dbApi.runTransaction(dbRef(`roomSlots/${number}`), value => {
                    if(value && value.roomId && knownRoomIds.has(value.roomId)) return value;
                    if(value && value.roomId && Number(value.createdAt || 0) && now - Number(value.createdAt || 0) < 15000) return value;
                    return { roomId, ownerUid:mpSelfId, createdAt:now };
                });
                const reserved = result?.snapshot?.val?.();
                if(result.committed && reserved && reserved.roomId === roomId) return { roomNumber:number, roomId };
            }catch(e){}
        }
        return null;
    }

    async function createRoom(){
        if(!(await requireSignedInAccount())) return;
        const ownerRoom = await loadOwnedLiveRoom();
        if(ownerRoom){ await enterRoom(ownerRoom); return; }
        const createWait = roomCreateCooldownLeft();
        if(createWait > 0){ showToast(`Wait ${compactSeconds(createWait)}s before creating another room.`, { type:'info', title:'Host Room' }); return; }
        if(activeRoomTotal() >= MAX_ROOMS){ showToast('Room limit reached.', { type:'error', title:'Online Room' }); return; }
        const user = currentUser();
        const maxPlayers = Math.min(6, Math.max(2, Number(maxPlayersInput.value) || 6));
        const mode = roomModeInput?.value === 'Private' ? 'Private' : 'Public';
        const roomName = (roomNameInput?.value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
        if(!roomName){
            showToast('Enter a room name.', { type:'error', title:'Host Room' });
            roomNameInput?.focus();
            return;
        }
        const roomPassword = mode === 'Private' ? (roomPasswordInput?.value || '').trim().slice(0, 48) : '';
        if(mode === 'Private' && !roomPassword){
            showToast('Enter a private room password.', { type:'error', title:'Host Room' });
            roomPasswordInput?.focus();
            return;
        }
        const reservation = await reserveRoomSlot();
        if(!reservation){ showToast('Room limit reached.', { type:'error', title:'Online Room' }); return; }
        const roomNumber = reservation.roomNumber;
        const now = Date.now();
        const room = {
            id:reservation.roomId,
            roomNumber,
            name:roomName,
            owner:user.name,
            ownerUid:user.id,
            mode,
            max:maxPlayers,
            count:0,
            activeCount:0,
            // Private-room passwords are NEVER stored at rooms/{id}/password
            // anymore — every signed-in user can read this node, so plaintext
            // there is trivially harvestable. The real secret lives at
            // roomSecrets/{id} (Admin-SDK only) and is set via /api/private-room.
            password:'',
            chatEnabled:true,
            createdAt:now,
            updatedAt:now
        };
        if(firebaseReady && dbApi){
            let claimed = false;
            try{
                claimed = await claimOwnerRoom(room);
                if(!claimed){
                    await releaseRoomSlot(room);
                    const existing = await loadOwnedLiveRoom();
                    if(existing) await enterRoom(existing);
                    return;
                }
                await dbApi.set(dbRef(`rooms/${room.id}`), room);
                if(mode === 'Private'){
                    const result = await callPrivateRoomApi('set', room.id, roomPassword);
                    if(!result?.ok){
                        await Promise.allSettled([
                            dbApi.remove(dbRef(`rooms/${room.id}`)),
                            releaseOwnerRoom(room),
                            releaseRoomSlot(room)
                        ]);
                        showToast('Couldn’t set room password. Try again.', { type:'error', title:'Host Room' });
                        return;
                    }
                }
            }catch(e){
                if(claimed) await releaseOwnerRoom(room);
                await releaseRoomSlot(room);
                showToast('Couldn’t update room. Try again.', { type:'error', title:'Online Room' });
                return;
            }
        }else{
            rooms.unshift(room);
        }
        markRoomCreated(now);
        const entered = await enterRoom(room);
        if(!entered && firebaseReady && dbApi){
            await Promise.allSettled([dbApi.remove(dbRef(`rooms/${room.id}`)), releaseOwnerRoom(room), releaseRoomSlot(room)]);
        }
    }

    function findPlayerPill(id){
        if(!id || !playerStrip) return null;
        return playerPillMap.get(String(id)) || null;
    }

    function pulsePlayer(id){
        if(!id || getState(id).muteInstrument) return;
        markPlayerActivity(id, 'playing');
    }

    function playRemotePressVisual(midi, keyEl, playerId){
        const player = getPlayer(playerId);
        const color = playerColor(player);
        if(Number.isFinite(midi)) _trackKeyColor(midi, playerId, color, keyEl);
        if(keyEl) scheduleKeyVisual(keyEl, true);
        const level = getRemoteVisualLevel();
        addRemoteAnim(midi, playerId, level, color);
        if(level === 'full' && saberDustEnabled){
            const geom = getKeyStageGeom(midi);
            if(geom) spawnNeonDust(geom, geom.isBlack ? 2 : 3);
        }
    }

    function playRemoteReleaseVisual(midi, keyEl, playerId){
        if(keyEl) scheduleKeyVisual(keyEl, false);
        if(Number.isFinite(midi)) _untrackKeyColor(midi, playerId, keyEl);
        markFallingReleased(midi, remoteFallingOwnerId(playerId));
    }

    function decodeRemoteSoundfontData(data){
        const buffers = {};
        const notes = Object.keys(data || {});
        if(!notes.length) return Promise.resolve(null);
        return new Promise(resolve => {
            let done = 0;
            const finish = () => {
                done++;
                if(done >= notes.length) resolve(Object.keys(buffers).length ? buffers : null);
            };
            notes.forEach(note => {
                try{
                    const b64 = data[note] && data[note].split(',')[1];
                    if(!b64){ finish(); return; }
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    audioCtx.decodeAudioData(bytes.buffer.slice(0), buffer => { buffers[note] = buffer; finish(); }, finish);
                }catch(e){
                    finish();
                }
            });
        });
    }

    function loadRemoteSoundfontBuffers(sfKey, layer = 'piano'){
        const key = normalizeRemoteSoundfontKey(sfKey, layer);
        const cacheKey = layer + ':' + key;
        if(remoteSoundfontBuffers.has(cacheKey)) return Promise.resolve(remoteSoundfontBuffers.get(cacheKey));
        const loadedLayer = layer === 'string' ? 'string' : 'piano';
        if(getLoadedKey(loadedLayer) === key && countBufferMap(getLayerBuffers(loadedLayer)) > 0){
            const buffers = cloneBufferMap(getLayerBuffers(loadedLayer));
            remoteSoundfontBuffers.set(cacheKey, buffers);
            return Promise.resolve(buffers);
        }
        if(soundfontBufferCache.has(key)){
            const buffers = cloneBufferMap(soundfontBufferCache.get(key));
            remoteSoundfontBuffers.set(cacheKey, buffers);
            return Promise.resolve(buffers);
        }
        if(remoteSoundfontLoading.has(cacheKey)) return remoteSoundfontLoading.get(cacheKey);
        const url = SF_URLS[key];
        if(!url) return Promise.resolve(null);
        const loadTask = () => new Promise(resolve => {
            if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
            const script = document.createElement('script');
            script.id = 'mp-remote-sf-' + key + '-' + Date.now().toString(36);
            const previous = window.MIDI && window.MIDI.Soundfont;
            if(!window.MIDI) window.MIDI = {};
            window.MIDI.Soundfont = {};
            const finish = buffers => {
                remoteSoundfontLoading.delete(cacheKey);
                try{ script.remove(); }catch(e){}
                if(previous && (!window.MIDI.Soundfont || !Object.keys(window.MIDI.Soundfont).length)) window.MIDI.Soundfont = previous;
                if(buffers){
                    remoteSoundfontBuffers.set(cacheKey, buffers);
                    cacheSoundfontBuffers(key, buffers);
                }
                resolve(buffers || null);
            };
            const timeout = window.setTimeout(() => finish(null), SOUNDFONT_LOAD_TIMEOUT_MS);
            script.onload = async () => {
                window.clearTimeout(timeout);
                const sfData = window.MIDI && window.MIDI.Soundfont;
                const dataKey = sfData && Object.keys(sfData)[0];
                const buffers = dataKey ? await decodeRemoteSoundfontData(sfData[dataKey]) : null;
                finish(buffers);
            };
            script.onerror = () => { window.clearTimeout(timeout); finish(null); };
            script.src = url;
            document.head.appendChild(script);
        });
        const promise = remoteSoundfontLoadChain.then(loadTask, loadTask);
        remoteSoundfontLoadChain = promise.catch(() => null);
        remoteSoundfontLoading.set(cacheKey, promise);
        return promise;
    }

    function getCachedRemoteSoundfontBuffers(sfKey, layer = 'piano'){
        const key = normalizeRemoteSoundfontKey(sfKey, layer);
        const cacheKey = layer + ':' + key;
        if(remoteSoundfontBuffers.has(cacheKey)) return remoteSoundfontBuffers.get(cacheKey);
        const loadedLayer = layer === 'string' ? 'string' : 'piano';
        if(getLoadedKey(loadedLayer) === key && countBufferMap(getLayerBuffers(loadedLayer)) > 0){
            const buffers = cloneBufferMap(getLayerBuffers(loadedLayer));
            remoteSoundfontBuffers.set(cacheKey, buffers);
            return buffers;
        }
        if(soundfontBufferCache.has(key)){
            const buffers = cloneBufferMap(soundfontBufferCache.get(key));
            remoteSoundfontBuffers.set(cacheKey, buffers);
            return buffers;
        }
        return null;
    }

    function warmRemoteInstruments(){
        if(!currentRoom || !isInPianoRoom()) return;
        activePlayers().forEach(player => {
            if(player.id !== currentUser().id) loadRemoteSoundfontBuffers(player.instrumentKey || player.instrument, 'piano');
        });
    }

    function scheduleWarmRemoteInstruments(delay = 620){
        if(warmRemoteTimer) clearTimeout(warmRemoteTimer);
        warmRemoteTimer = window.setTimeout(() => {
            warmRemoteTimer = 0;
            warmRemoteInstruments();
        }, delay);
    }

    function getRemoteSustainState(playerId){
        const id = String(playerId || '');
        if(!remoteSustainByPlayer.has(id)){
            remoteSustainByPlayer.set(id, { sustainEnabled:false, sustainPedalDown:false, sustainValue:0 });
        }
        return remoteSustainByPlayer.get(id);
    }

    function updateRemoteSustainState(playerId, event = {}){
        const id = String(playerId || event.playerId || '');
        if(!id) return getRemoteSustainState('');
        const state = getRemoteSustainState(id);
        const wasPedalDown = !!state.sustainPedalDown;
        if(event.sustainEnabled !== undefined) state.sustainEnabled = !!event.sustainEnabled;
        if(event.sustainPedalDown !== undefined) state.sustainPedalDown = !!event.sustainPedalDown;
        if(event.sustainValue !== undefined) state.sustainValue = Math.max(0, Math.min(1, Number(event.sustainValue || 0)));
        if(wasPedalDown && !state.sustainPedalDown) releaseRemoteHeldNotes(id, event);
        return state;
    }

    function remoteSustainValue(playerId, event = {}){
        const state = getRemoteSustainState(playerId);
        const enabled = event.sustainEnabled !== undefined ? !!event.sustainEnabled : !!state.sustainEnabled;
        const pedalDown = event.sustainPedalDown !== undefined ? !!event.sustainPedalDown : !!state.sustainPedalDown;
        const value = event.sustainValue !== undefined ? Number(event.sustainValue || 0) : Number(state.sustainValue || 0);
        return (enabled || pedalDown) ? Math.max(0, Math.min(1, value)) : 0;
    }

    function shouldHoldRemoteNoteOff(playerId, event = {}){
        if(event.sustainPedalDown !== undefined) return !!event.sustainPedalDown;
        return !!getRemoteSustainState(playerId).sustainPedalDown;
    }

    function holdRemoteNoteOff(playerId, midi){
        const id = String(playerId || '');
        if(!remotePedalHeldNotes.has(id)) remotePedalHeldNotes.set(id, new Set());
        remotePedalHeldNotes.get(id).add(Number(midi));
    }

    function releaseRemoteHeldNotes(playerId, event = {}){
        const id = String(playerId || '');
        const held = remotePedalHeldNotes.get(id);
        if(!held || !held.size) return;
        const notes = Array.from(held);
        held.clear();
        const releaseEvent = { ...event, sustainPedalDown:false, sustainEnabled:false };
        notes.forEach(midi => {
            releaseRemoteNote(id, midi, false, releaseEvent);
        });
    }

    function releaseRemoteLayer(playerId, midi, layer, event = {}, fast = false){
        const key = layer === 'string' ? `remoteString:${playerId}:${midi}` : `remote:${playerId}:${midi}`;
        const voice = activeNotes.get(key);
        if(!voice) return;
        const profile = layer === 'string'
            ? getStringFadeProfile(Number(event.stringFade || voice.fadeSec || STRING_FADE_DEFAULT), !!fast)
            : getReleaseProfile(!!fast, remoteSustainValue(playerId, event));
        releaseVoice(voice, profile.tc, profile.delay);
        activeNotes.delete(key);
    }

    function releaseRemoteNote(playerId, midi, fast = false, event = {}){
        releaseRemoteLayer(playerId, midi, 'piano', event, fast);
        releaseRemoteLayer(playerId, midi, 'string', event, fast);
    }

    function playRemoteBuffer(player, event, buffers, layer = 'piano'){
        const midi = Number(event.note);
        if(!Number.isFinite(midi) || !buffers) return false;
        if(layer === 'string'){
            const left = Number(event.stringRangeLeft || 21);
            const right = Number(event.stringRangeRight || 108);
            if(midi < Math.min(left, right) || midi > Math.max(left, right)) return false;
        }
        const noteName = midiNoteToName(midi + (Number(event.transpose) || 0));
        const buffer = buffers[noteName];
        if(!buffer) return false;
        const key = layer === 'string' ? `remoteString:${player.id}:${midi}` : `remote:${player.id}:${midi}`;
        fastReleaseActiveKey(key);
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        const gainNode = audioCtx.createGain();
        const fx = layer === 'string' ? (sfEffectSettings.sf2 || {}) : (sfEffectSettings.sf1 || {});
        const now = audioCtx.currentTime;
        const mixerGain = getRemotePlaybackGain(player.id);
        if(mixerGain <= 0) return false;
        let vel = Math.max(0.01, Math.min(1, Number(event.velocity) || 0.8));
        // Match the local string attenuation so listeners hear the exact balance
        // the player hears (local applies STRING_VEL_SCALE in playNote).
        if(layer === 'string') vel *= STRING_VEL_SCALE;
        const eventVolume = layer === 'string'
            ? Math.max(0, Math.min(1, Number(event.stringVolume ?? 0.75)))
            : Math.max(0, Math.min(1, Number(event.pianoVolume ?? 1)));
        const layerBoost = layer === 'string' ? 1.2 : 2.25;
        gainNode.gain.setValueAtTime(vel * layerBoost * eventVolume * mixerGain, now);
        src.connect(gainNode);
        gainNode.connect(masterGain);
        if((fx.reverb || 0) > 0){
            if(!reverbNode) buildReverb();
            if(reverbNode){
                const sendGain = audioCtx.createGain();
                sendGain.gain.value = Math.min(0.85, Math.max(0, fx.reverb * 0.85));
                gainNode.connect(sendGain);
                sendGain.connect(reverbNode);
            }
        }
        const voice = {
            key,
            layer:layer === 'string' ? 'remoteString' : 'remote',
            sustain:layer === 'string' ? 0 : remoteSustainValue(player.id, event),
            fadeSec:layer === 'string' ? Math.max(0.1, Math.min(10, Number(event.stringFade || STRING_FADE_DEFAULT))) : 0,
            masterGain:gainNode,
            oscillators:[],
            released:false,
            sfSrc:src,
            startedAt:now,
            ended:false
        };
        src.onended = () => cleanupVoiceRef(voice);
        src.start();
        activeNotes.set(key, voice);
        activeVoices.push(voice);
        enforceVoiceLimit();
        return true;
    }

    function playRemoteNote(event){
        if(!event || !currentRoom || event.roomId !== currentRoom.id) return;
        if(event.type === 'batch' && Array.isArray(event.events)){
            if(event.playerId === currentUser().id) return;
            for(let i=0;i<event.events.length;i++){
                const item = event.events[i];
                if(item) playRemoteNote({ ...item, roomId:event.roomId, playerId:item.playerId || event.playerId });
            }
            return;
        }
        if(event.playerId === currentUser().id) return;

        // Chord detection: runs BEFORE all audio/mute/volume guards.
        var _chMidi = Number(event.note);
        if(Number.isFinite(_chMidi) && _chMidi >= 21 && _chMidi <= 108){
            if(event.type === 'noteOn' && typeof _remoteNoteOn === 'function') _remoteNoteOn(event.playerId, _chMidi);
            else if(event.type === 'noteOff' && typeof _remoteNoteOff === 'function') _remoteNoteOff(event.playerId, _chMidi);
        }
        // End chord detection.

        const player = getPlayer(event.playerId);
        if(event.type === 'sustain'){
            if(getState(player.id).muteInstrument) return;
            updateRemoteSustainState(player.id, event);
            return;
        }
        if(getState(player.id).muteInstrument) return;
        markPlayerActivity(player.id, event.type === 'noteOn' ? 'playing' : 'active');
        if(getRemotePlaybackGain(player.id) <= 0) return;
        const midi = Number(event.note);
        if(!Number.isFinite(midi)) return;
        const el = (typeof keyElFast !== 'undefined' && keyElFast[midi]) || (typeof noteElementMap !== 'undefined' && noteElementMap.get(midi));
        if(event.type === 'noteOn'){
            updateRemoteSustainState(player.id, event);
            const held = remotePedalHeldNotes.get(player.id);
            if(held) held.delete(midi);
            try{ if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }catch(e){}
            const instrumentKey = normalizeInstrumentKey(event.instrumentKey || player.instrumentKey || event.instrument || player.instrument);
            const cachedPiano = getCachedRemoteSoundfontBuffers(instrumentKey, 'piano');
            if(cachedPiano) playRemoteBuffer(player, event, cachedPiano, 'piano');
            else loadRemoteSoundfontBuffers(instrumentKey, 'piano').then(buffers => {
                if(currentRoom && event.roomId === currentRoom.id) playRemoteBuffer(player, event, buffers, 'piano');
            });
            if(event.stringsEnabled){
                const stringKey = normalizeStringInstrumentKey(event.stringInstrumentKey || event.stringInstrument || 'stringSf1');
                const cachedString = getCachedRemoteSoundfontBuffers(stringKey, 'string');
                if(cachedString) playRemoteBuffer(player, event, cachedString, 'string');
                else loadRemoteSoundfontBuffers(stringKey, 'string').then(buffers => {
                    if(currentRoom && event.roomId === currentRoom.id) playRemoteBuffer(player, event, buffers, 'string');
                });
            }
            playRemotePressVisual(midi, el, player.id);
            pulsePlayer(player.id);
        }else if(event.type === 'noteOff'){
            updateRemoteSustainState(player.id, event);
            const sustainHeld = shouldHoldRemoteNoteOff(player.id, event);
            if(sustainHeld) holdRemoteNoteOff(player.id, midi);
            else releaseRemoteNote(player.id, midi, false, event);
            playRemoteReleaseVisual(midi, el, player.id);
        }
    }

    let pendingRoomNoteEvents = [];
    let pendingRoomNoteFlushTimer = 0;
    let cachedPerformanceSnapshot = null;
    let cachedPerformanceSnapshotAt = 0;

    function getCachedPerformanceSnapshot(){
        const now = performance.now();
        if(cachedPerformanceSnapshot && now - cachedPerformanceSnapshotAt < 80) return cachedPerformanceSnapshot;
        cachedPerformanceSnapshot = getPerformanceSnapshot();
        cachedPerformanceSnapshotAt = now;
        return cachedPerformanceSnapshot;
    }

    function compactPerformanceState(snapshot = getCachedPerformanceSnapshot()){
        return {
            ik:snapshot.instrumentKey,
            i:snapshot.instrument,
            se:!!snapshot.sustainEnabled,
            sd:!!snapshot.sustainPedalDown,
            sv:Math.round(Math.max(0, Math.min(1, Number(snapshot.sustainValue || 0))) * 100) / 100,
            st:!!snapshot.stringsEnabled,
            sk:snapshot.stringInstrumentKey,
            si:snapshot.stringInstrument,
            sl:Math.round(Math.max(0, Math.min(1, Number(snapshot.stringVolume || 0))) * 100) / 100,
            sf:Math.round(Math.max(0.1, Math.min(10, Number(snapshot.stringFade || STRING_FADE_DEFAULT))) * 10) / 10,
            rl:Number(snapshot.stringRangeLeft || 21),
            rr:Number(snapshot.stringRangeRight || 108),
            pv:Math.round(Math.max(0, Math.min(1, Number(pianoVolume || 1))) * 100) / 100
        };
    }

    function expandPerformanceState(data = {}, fallback = {}){
        return {
            instrumentKey:normalizeInstrumentKey(data.ik || fallback.instrumentKey || fallback.instrument),
            instrument:data.i || fallback.instrument || instrumentLabel(data.ik || fallback.instrumentKey || 'sf1'),
            sustainEnabled:!!data.se,
            sustainPedalDown:!!data.sd,
            sustainValue:Math.max(0, Math.min(1, Number(data.sv || 0))),
            stringsEnabled:data.st !== undefined ? !!data.st : !!fallback.stringsEnabled,
            stringInstrumentKey:normalizeStringInstrumentKey(data.sk || fallback.stringInstrumentKey || fallback.stringInstrument || 'stringSf1'),
            stringInstrument:data.si || fallback.stringInstrument || stringInstrumentLabel(data.sk || fallback.stringInstrumentKey || 'stringSf1'),
            stringVolume:Math.max(0, Math.min(1, Number(data.sl ?? 0.75))),
            stringFade:Math.max(0.1, Math.min(10, Number(data.sf || STRING_FADE_DEFAULT))),
            stringRangeLeft:Number(data.rl || 21),
            stringRangeRight:Number(data.rr || 108),
            pianoVolume:Math.max(0, Math.min(1, Number(data.pv ?? 1)))
        };
    }

    function stateSignature(state){
        return JSON.stringify(state);
    }

    function cleanStreamEvents(events){
        if(!Array.isArray(events)) return [];
        const clean = [];
        for(let i = 0; i < events.length && clean.length < STREAM_MAX_EVENTS_PER_WRITE; i++){
            const item = events[i] || {};
            if(item.k === 'x'){
                clean.push({ k:'x', ...compactPerformanceState() });
                continue;
            }
            if(item.k === 's'){
                clean.push({
                    k:'s',
                    se:!!item.se,
                    sd:!!item.sd,
                    sv:Math.round(Math.max(0, Math.min(1, Number(item.sv || 0))) * 100) / 100
                });
                continue;
            }
            if(item.k !== 'n' && item.k !== 'f') continue;
            const note = Number(item.n);
            if(!Number.isFinite(note) || note < 21 || note > 108) continue;
            if(item.k === 'f') clean.push({ k:'f', n:Math.trunc(note) });
            else clean.push({
                k:'n',
                n:Math.trunc(note),
                v:Math.round(Math.max(0.01, Math.min(1, Number(item.v || 0.8))) * 100) / 100
            });
        }
        return clean;
    }

    async function writeRoomStream(payload){
        if(!firebaseReady || !dbApi || !currentRoom || !isInPianoRoom()) return;
        const events = cleanStreamEvents(payload?.e);
        if(!events.length) return;
        const cleanPayload = {
            r:currentRoom.id,
            p:mpSelfId,
            q:Math.max(1, Math.trunc(Number(payload?.q || 1))),
            s:String(payload?.s || roomStreamSessionId || 'default').slice(0, 48),
            e:events,
            t:Date.now()
        };
        try{ await dbApi.set(dbRef(`streams/${currentRoom.id}/${mpSelfId}`), cleanPayload); }catch(e){}
    }

    function inflateCompactEvent(item, roomId, playerId){
        const player = getPlayer(playerId);
        let state = remotePerformanceByPlayer.get(playerId);
        if(!state){
            state = expandPerformanceState({}, player);
            remotePerformanceByPlayer.set(playerId, state);
        }
        if(item.k === 'x'){
            state = expandPerformanceState(item, player);
            remotePerformanceByPlayer.set(playerId, state);
            const local = players.find(item => item.id === String(playerId));
            if(local){
                local.instrumentKey = state.instrumentKey;
                local.instrument = state.instrument;
                local.stringsEnabled = !!state.stringsEnabled;
                local.stringInstrumentKey = state.stringInstrumentKey;
                local.stringInstrument = state.stringInstrument;
                renderRoomChrome();
            }
            return null;
        }
        if(item.k === 's'){
            state = { ...state, sustainEnabled:!!item.se, sustainPedalDown:!!item.sd, sustainValue:Math.max(0, Math.min(1, Number(item.sv || 0))) };
            remotePerformanceByPlayer.set(playerId, state);
            return { roomId, playerId, type:'sustain', ...state };
        }
        const note = Number(item.n);
        if(!Number.isFinite(note)) return null;
        return {
            roomId,
            playerId,
            type:item.k === 'f' ? 'noteOff' : 'noteOn',
            note,
            velocity:Math.max(0.01, Math.min(1, Number(item.v || 0.8))),
            ...state
        };
    }

    function playRoomStream(playerId, stream){
        if(!stream || !currentRoom || stream.r !== currentRoom.id || playerId === mpSelfId) return;
        const streamTime = Number(stream.t || 0);
        if(streamTime && roomStreamJoinCutoff && streamTime < roomStreamJoinCutoff - 250) return;
        const seq = Number(stream.q || 0);
        const sessionId = String(stream.s || 'default');
        const seqKey = `${playerId}:${sessionId}`;
        if(!seq || seq <= (streamSeqByPlayer.get(seqKey) || 0)) return;
        streamSeqByPlayer.set(seqKey, seq);
        const events = Array.isArray(stream.e) ? stream.e : [];
        if(events.length > STREAM_MAX_EVENTS_PER_WRITE) return;
        for(let i = 0; i < events.length; i++){
            const event = inflateCompactEvent(events[i], currentRoom.id, playerId);
            if(event) playRemoteNote(event);
        }
    }

    function flushRoomNoteEvents(){
        if(pendingRoomNoteFlushTimer){
            clearTimeout(pendingRoomNoteFlushTimer);
            pendingRoomNoteFlushTimer = 0;
        }
        if(!pendingRoomNoteEvents.length) return;
        if(!firebaseReady || !dbApi || !currentRoom || !isInPianoRoom()){
            pendingRoomNoteEvents.length = 0;
            return;
        }
        const state = compactPerformanceState();
        const signature = stateSignature(state);
        const events = [];
        if(signature !== lastSentPerformanceSignature){
            lastSentPerformanceSignature = signature;
            events.push({ k:'x', ...state });
        }
        events.push(...pendingRoomNoteEvents.splice(0, pendingRoomNoteEvents.length));
        writeRoomStream({ r:currentRoom.id, p:mpSelfId, q:++roomStreamSeq, s:roomStreamSessionId, e:events, t:Date.now() });
    }

    function scheduleRoomNoteFlush(){
        if(pendingRoomNoteFlushTimer) return;
        pendingRoomNoteFlushTimer = setTimeout(flushRoomNoteEvents, 18);
    }

    function sendNoteEvent(type, note, velocity = 0.8){
        if(!firebaseReady || !dbApi || !currentRoom || !isInPianoRoom()) return;
        if(getState(currentUser().id).muteInstrument) return;
        const midi = Number(note);
        if(!Number.isFinite(midi) || midi < 21 || midi > 108) return;
        if(type === 'noteOn') pulsePlayer(currentUser().id);
        else markPlayerActivity(currentUser().id, 'active');
        const value = Number(velocity);
        pendingRoomNoteEvents.push(type === 'noteOff' ? { k:'f', n:midi } : {
            k:'n',
            n:midi,
            v:Math.round(Math.max(0.01, Math.min(1, Number.isFinite(value) && value > 0 ? value : 0.8)) * 100) / 100
        });
        if(pendingRoomNoteEvents.length >= 48) flushRoomNoteEvents();
        else scheduleRoomNoteFlush();
    }

    async function sendSustainEvent(){
        if(!firebaseReady || !dbApi || !currentRoom || !isInPianoRoom()) return;
        flushRoomNoteEvents();
        const snapshot = getPerformanceSnapshot();
        await writeRoomStream({
            r:currentRoom.id,
            p:mpSelfId,
            q:++roomStreamSeq,
            s:roomStreamSessionId,
            e:[{
                k:'s',
                se:!!snapshot.sustainEnabled,
                sd:!!snapshot.sustainPedalDown,
                sv:Math.round(Math.max(0, Math.min(1, Number(snapshot.sustainValue || 0))) * 100) / 100
            }],
            t:Date.now()
        });
    }

    window.PapianoMultiplayer = {
        sendNoteOn(note, velocity){ sendNoteEvent('noteOn', note, velocity); },
        sendNoteOff(note){ sendNoteEvent('noteOff', note, 0); },
        sendSustainState(){ sendSustainEvent(); },
        syncInstrument(){ scheduleSelfInstrumentStateSync(); },
        isInRoom(){ return !!(currentRoom && currentScreen === 'pianoMulti'); },
        playerColor(id){ return playerColor(id || mpSelfId); },
        isOnline(){ return firebaseReady; },
        _detectChords(){ _detectAndRenderChords(); }
    };

    // Live multiplayer chord detection (fully synchronous).
    // Tracks remote players' active notes client-side (no extra writes),
    // detects chords via matchChords(), and renders synchronously on each note
    // event. A single timer only handles fade-out cleanup.
    const _remoteActiveNotes = new Map(); // playerId → Set<midi>
    let _mpChordDecayTimer = 0;

    var _lastChordSource = ''; // 'self' or playerId — tracks who triggered last

    function _detectAndRenderChords(){
        if(!_chordEnabled) return;
        var el1 = document.getElementById('chordPrimary');
        var el2 = document.getElementById('chordSecondary');
        if(!el1 || !el2) return;

        // Collect candidates: self (pressStartTimes) + all remote players
        var bestMidi = null;
        var bestSource = '';
        var bestTs = 0;

        // Self notes from pressStartTimes
        if(typeof pressStartTimes !== 'undefined' && pressStartTimes.size >= 3){
            bestMidi = Array.from(pressStartTimes.keys());
            bestSource = 'self';
            bestTs = Date.now(); // self is always "now"
        }

        // Remote notes — pick the one with most recent activity
        _remoteActiveNotes.forEach(function(set, pid){
            if(set && set.size >= 3){
                var ts = _remoteNoteTimestamps.get(pid) || 0;
                if(ts >= bestTs || !bestMidi){
                    bestMidi = Array.from(set);
                    bestSource = pid;
                    bestTs = ts;
                }
            }
        });

        if(!bestMidi || bestMidi.length < 3){
            el1.classList.remove('show'); el1.textContent = ''; el1.style.color = '';
            el2.classList.remove('show'); el2.textContent = ''; el2.style.color = '';
            _lastChordSource = '';
            return;
        }

        var midiArr = bestMidi.sort(function(a,b){ return a - b; });
        var matches = [];
        try{ matches = matchChords(midiArr) || []; }catch(e){ matches = []; }

        if(matches.length === 0){
            el1.classList.remove('show'); el1.textContent = ''; el1.style.color = '';
            el2.classList.remove('show'); el2.textContent = ''; el2.style.color = '';
            _lastChordSource = '';
            return;
        }

        // Color: self = user custom colour (if any) or seat colour; remote = their seat colour
        var color = playerColor(mpSelfId);
        if(bestSource === 'self'){
            var customChord = (typeof userCustomChordColor === 'function') ? userCustomChordColor() : '';
            if(customChord) color = customChord;
        }
        if(bestSource !== 'self'){
            var remotePlayer = null;
            if(currentRoom && roomPlayersByRoom[currentRoom.id] && roomPlayersByRoom[currentRoom.id][bestSource]){
                remotePlayer = roomPlayersByRoom[currentRoom.id][bestSource];
            }
            color = playerColor(remotePlayer || bestSource);
        }
        _lastChordSource = bestSource;

        // Use setProperty with !important to override CSS !important on .chord-name
        el1.textContent = formatChord(matches[0]);
        el1.style.setProperty('color', color, 'important');
        el1.style.setProperty('text-shadow', '0 2px 12px rgba(0,0,0,0.8), 0 0 20px ' + color + '55', 'important');
        el1.classList.add('show');
        if(matches.length >= 2){
            el2.textContent = formatChord(matches[1]);
            el2.style.setProperty('color', color, 'important');
            el2.style.setProperty('opacity', '0.6', 'important');
            el2.classList.add('show');
        } else {
            el2.classList.remove('show'); el2.textContent = '';
        }
    }

    // Stuck note cleanup — if a note has been held >10s, it's probably a missed noteOff
    function _ensureDecayTimer(){
        if(_mpChordDecayTimer) return;
        _mpChordDecayTimer = setInterval(function(){
            var now = Date.now();
            var changed = false;
            _remoteActiveNotes.forEach(function(set, pid){
                if(set && set.size > 0 && _remoteNoteTimestamps){
                    var ts = _remoteNoteTimestamps.get(pid);
                    if(ts && now - ts > 10000){ set.clear(); changed = true; }
                }
            });
            if(changed) _detectAndRenderChords();
            if(_remoteActiveNotes.size === 0){ clearInterval(_mpChordDecayTimer); _mpChordDecayTimer = 0; }
        }, 2000);
    }
    var _remoteNoteTimestamps = new Map(); // playerId → last noteOn timestamp


    function _remoteNoteOn(playerId, midi){
        if(!playerId || playerId === mpSelfId) return;
        var set = _remoteActiveNotes.get(playerId);
        if(!set){ set = new Set(); _remoteActiveNotes.set(playerId, set); }
        set.add(midi);
        _remoteNoteTimestamps.set(playerId, Date.now());
        _detectAndRenderChords();
        _ensureDecayTimer();
    }

    function _remoteNoteOff(playerId, midi){
        if(!playerId || playerId === mpSelfId) return;
        const set = _remoteActiveNotes.get(playerId);
        if(!set) return;
        set.delete(midi);
        _detectAndRenderChords();
    }

    function _clearRemoteNotes(playerId){
        if(playerId){
            _remoteActiveNotes.delete(playerId);
            _remoteNoteTimestamps.delete(playerId);
            // Clean up key color tracking for this player
            if(typeof _keyColorMap !== 'undefined'){
                _keyColorMap.forEach((holders, midi) => {
                    if(holders.has(playerId)){
                        holders.delete(playerId);
                        if(holders.size === 0) _keyColorMap.delete(midi);
                        const el = noteElementMap.get(midi);
                        if(el) _applyKeyColor(el, _resolveKeyColor(midi));
                    }
                });
            }
        } else {
            _remoteActiveNotes.clear();
            _remoteNoteTimestamps.clear();
            // Clear all remote color entries
            if(typeof _keyColorMap !== 'undefined'){
                _keyColorMap.forEach((holders, midi) => {
                    holders.forEach((color, hid) => { if(hid !== _KEY_SELF) holders.delete(hid); });
                    if(holders.size === 0) _keyColorMap.delete(midi);
                    const el = noteElementMap.get(midi);
                    if(el) _applyKeyColor(el, _resolveKeyColor(midi));
                });
            }
        }
        // Instant clear display
        var el1 = document.getElementById('chordPrimary');
        var el2 = document.getElementById('chordSecondary');
        if(el1){ el1.classList.remove('show'); el1.textContent = ''; el1.style.color = ''; }
        if(el2){ el2.classList.remove('show'); el2.textContent = ''; el2.style.color = ''; }
    }

    // Hook is done via direct injection in playRemoteNote (see noteOn/noteOff branches)

    function clearRoomSubscriptions(){
        if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
        if(eventUnsubscribe){ eventUnsubscribe(); eventUnsubscribe = null; }
        if(streamAddedUnsubscribe){ streamAddedUnsubscribe(); streamAddedUnsubscribe = null; }
        if(streamChangedUnsubscribe){ streamChangedUnsubscribe(); streamChangedUnsubscribe = null; }
        if(roomPlayersUnsubscribe){ roomPlayersUnsubscribe(); roomPlayersUnsubscribe = null; }
        if(roomModerationUnsubscribe){ roomModerationUnsubscribe(); roomModerationUnsubscribe = null; }
        _clearRemoteNotes(); // reset chord state on room leave
        if(_mpChordDecayTimer){ clearInterval(_mpChordDecayTimer); _mpChordDecayTimer = 0; }
        _playerSeatCache.clear(); // reset seat cache on room leave
        _playerColorLock.clear(); // reset color lock on room leave
        _mpSelfSeatColor = '';
        if(typeof syncColorPadsToEffectiveColors === 'function') syncColorPadsToEffectiveColors();
    }

    function subscribeRoomData(roomId){
        if(!firebaseReady || !dbApi || !roomId) return;
        clearRoomSubscriptions();
        messages.splice(0, messages.length);
        roomPlayersByRoom[roomId] = roomPlayersByRoom[roomId] || {};
        roomModerationByRoom[roomId] = roomModerationByRoom[roomId] || {};
        const chatQuery = dbApi.query(dbRef(`messages/${roomId}`), dbApi.limitToLast(60));
        chatUnsubscribe = dbApi.onValue(chatQuery, snap => {
            const data = snap.val() || {};
            messages.splice(0, messages.length, ...Object.entries(data).map(([id, value]) => ({
                id,
                playerId:value.playerId,
                text:value.text || '',
                time:value.createdAt ? timeLabel(value.createdAt) : (value.time || timeLabel()),
                replyTo:value.replyTo || null,
                createdAt:value.createdAt || 0
            })).sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)));
            renderMessages();
        });
        roomPlayersUnsubscribe = dbApi.onValue(dbRef(`roomPlayers/${roomId}`), snap => {
            roomPlayersLoaded = true;
            roomPlayersByRoom[roomId] = snap.val() || {};
            // Lock a DISTINCT colour for every active player. roomColorIndexMap
            // guarantees uniqueness (seat-based when seats are healthy, else
            // join-order rank), so the lock self-heals away from the "everyone
            // resolves to seat 1 → all red" failure mode on each snapshot.
            const live = roomPlayersByRoom[roomId];
            if(live){
                const idxMap = roomColorIndexMap();
                Object.entries(live).forEach(([key, data]) => {
                    const pid = String(data?.id || key);
                    const seat = Number(data?.seat || 0);
                    if(seat >= 1) _playerSeatCache.set(pid, seat);
                    const cIdx = idxMap.get(pid);
                    if(typeof cIdx === 'number' && cIdx >= 0){
                        const color = MP_PLAYER_COLORS[cIdx];
                        _playerColorLock.set(pid, color); // overwrite: corrects stale/duplicate colours
                        if(pid === String(mpSelfId || '')){
                            _mpSelfSeatColor = color;
                            if(typeof syncColorPadsToEffectiveColors === 'function') syncColorPadsToEffectiveColors();
                        }
                    }
                });
            }
            // Clear sprite/rgb caches so falling notes pick up corrected colors
            if(typeof _solidRgbCache !== 'undefined' && _solidRgbCache) _solidRgbCache.clear();
            if(typeof clearEffectSpriteCache === 'function') clearEffectSpriteCache();
            if(_roomPlayersReadyResolve){ _roomPlayersReadyResolve(); _roomPlayersReadyResolve = null; }
            reconcileRoomPresence(rooms.find(room => room.id === roomId) || currentRoom);
            refreshAll();
            scheduleWarmRemoteInstruments(900);
        });
        roomModerationUnsubscribe = dbApi.onValue(dbRef(`moderation/${roomId}`), snap => {
            roomModerationByRoom[roomId] = snap.val() || {};
            refreshAll();
        });
        streamSeqByPlayer.clear();
        remotePerformanceByPlayer.clear();
        lastRemoteEventTime = Date.now();
        roomStreamJoinCutoff = Date.now();
        activeEventRoomId = roomId;
        const streamRef = dbRef(`streams/${roomId}`);
        streamAddedUnsubscribe = dbApi.onChildAdded(streamRef, snap => playRoomStream(snap.key, snap.val()));
        streamChangedUnsubscribe = dbApi.onChildChanged(streamRef, snap => playRoomStream(snap.key, snap.val()));
        eventUnsubscribe = () => {
            if(streamAddedUnsubscribe){ streamAddedUnsubscribe(); streamAddedUnsubscribe = null; }
            if(streamChangedUnsubscribe){ streamChangedUnsubscribe(); streamChangedUnsubscribe = null; }
        };
    }

    async function setModeration(playerId, updates){
        if(!currentRoom || !playerId) return;
        if(firebaseReady && dbApi){
            try{ await dbApi.update(dbRef(`moderation/${currentRoom.id}/${playerId}`), updates); }
            catch(e){ showToast('Moderation action unavailable.', { type:'error', title:'Online Room' }); }
        }else{
            Object.assign(getState(playerId), updates);
            refreshAll();
        }
    }

    async function kickBanPlayer(player){
        if(!canModeratePlayer(player)) return;
        await setModeration(player.id, { banned:true, muteChat:true, muteInstrument:true });
        if(firebaseReady && dbApi && currentRoom){
            try{ await dbApi.remove(dbRef(`roomPlayers/${currentRoom.id}/${player.id}`)); }catch(e){}
            try{ await dbApi.update(dbRef(`users/${player.id}`), { room:null, updatedAt:Date.now() }); }catch(e){}
        }else{
            player.room = null;
        }
        closeProfile();
        refreshAll();
    }

    function refreshChatViewport(){
        if(chatViewportRaf) cancelAnimationFrame(chatViewportRaf);
        chatViewportRaf = requestAnimationFrame(() => {
            chatViewportRaf = 0;
            const vv = window.visualViewport;
            const height = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
            const inset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
            document.documentElement.style.setProperty('--mp-chat-vh', `${height}px`);
            document.documentElement.style.setProperty('--mp-chat-keyboard-inset', `${inset}px`);
            renderChatPreview();
        });
    }

    function setChatKeyboardActive(active){
        document.body.classList.toggle('mp-chat-keyboard', !!active);
        lockUiLayout(active ? 900 : 260);
        refreshChatViewport();
    }

    function bindDragScroll(element, axis){
        if(!element) return;
        let active = false, start = 0, scroll = 0, moved = false;
        element.addEventListener('pointerdown', event => {
            if(event.button && event.button !== 0) return;
            active = true; moved = false;
            start = axis === 'x' ? event.clientX : event.clientY;
            scroll = axis === 'x' ? element.scrollLeft : element.scrollTop;
            element.setPointerCapture?.(event.pointerId);
        });
        element.addEventListener('pointermove', event => {
            if(!active) return;
            const point = axis === 'x' ? event.clientX : event.clientY;
            const delta = point - start;
            if(Math.abs(delta) < 4 && !moved) return;
            moved = true;
            if(axis === 'x') element.scrollLeft = scroll - delta;
            else element.scrollTop = scroll - delta;
            event.preventDefault();
        }, { passive:false });
        const end = () => { active = false; window.setTimeout(() => { moved = false; }, 0); };
        element.addEventListener('pointerup', end);
        element.addEventListener('pointercancel', end);
        element.addEventListener('click', event => {
            if(moved){ event.preventDefault(); event.stopPropagation(); }
        }, true);
    }

    function isolate(element){
        if(!element) return;
        ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','wheel','mousedown','mouseup','click'].forEach(type => {
            element.addEventListener(type, event => event.stopPropagation(), { passive:type !== 'touchmove' && type !== 'wheel' });
        });
    }

    async function applyAuthenticatedUser(authUser){
        if(!authUser || !dbApi || !fsApi || !fsDb) return null;
        if(currentAuthUser && currentAuthUser.uid === authUser.uid && players.some(player => player.id === authUser.uid)) return currentUser();
        currentAuthUser = authUser;
        mpSelfId = authUser.uid;
        // Keep a previously-resolved real name so a transient auth refresh with an
        // empty displayName never downgrades the user to a fallback ("Papiano User").
        const prevValidName = (players.find(player => player.id === authUser.uid) || {}).name || '';
        purgeLocalGuestPlayers();
        loadRemoteMixer();
        const homeProfile = await ensureHomeProfile(authUser, {
            name:authUser.displayName || prevValidName || fallbackName(),
            photoURL:authUser.photoURL || '',
            badgeId:'common',
            uid:mpSelfId
        });
        const self = upsertPlayer({
            id:mpSelfId,
            name:homeProfile.name,
            uid:homeProfile.uid,
            uidLabel:homeProfile.userId,
            userId:homeProfile.userId,
            displayUserId:homeProfile.userId,
            publicId:homeProfile.publicId,
            role:homeProfile.role,
            badgeId:homeProfile.badgeId,
            photoURL:homeProfile.photoURL,
            instrumentKey:currentInstrumentKey(),
            instrument:currentInstrumentName(),
            color:colorFromId(mpSelfId),
            bio:homeProfile.desc,
            likes:homeProfile.likes,
            dislikes:homeProfile.dislikes,
            countryCode:homeProfile.countryCode,
            online:true,
            room:currentRoom ? currentRoom.id : null
        });
        try{
            await dbApi.update(dbRef(`users/${mpSelfId}`), {
                id:self.id,
                name:self.name,
                uidLabel:self.uid,
                userId:self.uid,
                publicId:self.publicId || 0,
                role:self.role,
                badgeId:self.badgeId || 'common',
                photoURL:self.photoURL || '',
                instrumentKey:self.instrumentKey,
                instrument:self.instrument,
                color:self.color,
                bio:self.bio,
                desc:self.bio,
                likes:self.likes || 0,
                dislikes:self.dislikes || 0,
                countryCode:self.countryCode || '',
                online:true,
                room:self.room || null,
                lastSeen:Date.now(),
                lastActive:Date.now(),
                updatedAt:Date.now()
            });
        }catch(e){}
        try{
            userDisconnect?.cancel?.();
            userDisconnect = dbApi.onDisconnect(dbRef(`users/${mpSelfId}`));
            userDisconnect.update({ online:false, room:null, updatedAt:Date.now() });
        }catch(e){}
        try{ friendsUnsubscribe?.(); }catch(e){}
        clearFriendUserSubscriptions();
        friendIds.clear();
        friendProfiles.clear();
        friendsUnsubscribe = attachFirestoreFriends();
        attachBlocksListener();
        startAccountBanWatcher(mpSelfId);
        syncAuthUi();
        attachRoomsListener();
        attachUsersListener();
        mpPlayTimeBaseSeconds = Math.max(0, Number(homeProfile.playTimeSeconds) || 0);
        mpPlayTimePending = 0;
        mpPlayTimeRemoteSyncedAt = 0;
        startMpPlayTimeTracker();
        startGlobalPresenceHeartbeat();
        refreshAll();
        return self;
    }

    function resetAuthenticatedUser(){
        stopGlobalPresenceHeartbeat();
        pauseMpPlayTimeTracker(true);
        mpPlayTimeBaseSeconds = 0;
        mpPlayTimePending = 0;
        currentAuthUser = null;
        mpSelfId = 'local_self';
        try{ friendsUnsubscribe?.(); }catch(e){}
        friendsUnsubscribe = null;
        clearFriendUserSubscriptions();
        detachUsersListener();
        friendIds.clear();
        ensureLocalSelf();
        syncAuthUi();
        refreshAll();
    }

    function attachUsersListener(){
        if(!firebaseReady || !dbApi || usersUnsubscribe) return;
        usersUnsubscribe = dbApi.onValue(dbRef('users'), snap => {
            const data = snap.val() || {};
            const seen = new Set();
            Object.entries(data).forEach(([id, value]) => {
                const userId = String(id || '');
                if(!userId || userId === mpSelfId || isLocalGuestPlayerId(userId)) return;
                const raw = value && typeof value === 'object' ? value : {};
                const player = normalizePlayer(userId, { ...raw, id:userId, online:raw.online === true });
                if(!isAuthenticatedDisplayPlayer(player)) return;
                seen.add(userId);
                upsertPlayer(player);
            });
            // Any player we previously cached but is no longer present in the
            // global users node is treated as offline so the Online list does
            // not keep showing stale entries. Friends and current-room members
            // keep their own presence sources, so leave those untouched.
            players.forEach(player => {
                if(player.id === mpSelfId || seen.has(player.id)) return;
                if(friendIds.has(player.id)) return;
                if(currentRoom && roomPlayersByRoom[currentRoom.id]?.[player.id]) return;
                player.online = false;
            });
            renderSearch();
        }, () => {
            try{ usersUnsubscribe?.(); }catch(e){}
            usersUnsubscribe = null;
        });
    }

    function detachUsersListener(){
        try{ usersUnsubscribe?.(); }catch(e){}
        usersUnsubscribe = null;
    }

    async function processStageIntent(){
        if(!isStagePianoPage() || stageIntentProcessed || !firebaseReady || !dbApi) return;
        const intent = readStageIntent();
        if(!intent){
            stageIntentProcessed = true;
            showToast('Choose a room from Multiplayer Home first.', { type:'info', title:'Stage Piano' });
            window.setTimeout(() => window.location.replace('multiplayer.html'), 900);
            return;
        }
        if(intent.createdAt && Date.now() - Number(intent.createdAt) > 5 * 60 * 1000){
            clearStageIntent();
            stageIntentProcessed = true;
            window.location.replace('multiplayer.html');
            return;
        }
        if((intent.action === 'join' || intent.action === 'quick') && !roomsSnapshotReady) return;
        if(intent.action === 'join' && !rooms.some(room => room.id === intent.roomId)){
            stageIntentProcessed = true;
            clearStageIntent();
            window.location.replace('multiplayer.html');
            return;
        }
        stageIntentProcessed = true;
        clearStageIntent();
        if(intent.action === 'create'){
            if(roomNameInput) roomNameInput.value = String(intent.roomName || '').slice(0, 32);
            if(maxPlayersInput) maxPlayersInput.value = String(Math.min(6, Math.max(2, Number(intent.maxPlayers) || 6)));
            if(roomModeInput) roomModeInput.value = intent.mode === 'Private' ? 'Private' : 'Public';
            if(roomPasswordInput) roomPasswordInput.value = String(intent.password || '').slice(0, 48);
            syncMaxPlayers();
            syncRoomType();
            await createRoom();
            return;
        }
        if(intent.action === 'quick'){ await quickMatch(); return; }
        if(intent.action === 'join'){
            const room = rooms.find(item => item.id === intent.roomId);
            if(!room){ window.location.replace('multiplayer.html'); return; }
            if(!(await requireSignedInAccount())) return;
            if(room.mode === 'Private'){
                if(firebaseReady && dbApi){
                    const result = await callPrivateRoomApi('check', room.id, intent.password || '');
                    if(!result?.ok){ openPasswordModal(room); return; }
                }else if(String(intent.password || '') !== room.password){
                    openPasswordModal(room); return;
                }
            }
            await enterRoom(room);
        }
    }

    function attachRoomsListener(){
        if(!firebaseReady || !dbApi || roomsUnsubscribe) return;
        roomsUnsubscribe = dbApi.onValue(dbRef('rooms'), snap => {
            const data = snap.val() || {};
            const nextRooms = Object.entries(data).map(([id, value]) => normalizeRoom(id, value)).sort((a,b) => {
                const an = Number(a.roomNumber || 0);
                const bn = Number(b.roomNumber || 0);
                if(an && bn && an !== bn) return an - bn;
                if(an) return -1;
                if(bn) return 1;
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
            const liveRooms = [];
            nextRooms.forEach(room => {
                if(isKnownEmptyRoom(room)){
                    deleteEmptyRoom(room);
                    return;
                }
                if(!roomDeleteQueue.has(room.id)) liveRooms.push(room);
            });
            rooms.splice(0, rooms.length, ...liveRooms);
            roomsSnapshotReady = true;
            syncLobbyRoomPlayerSubscriptions();
            cleanupEmptyRooms();
            syncCurrentRoom();
            refreshAll();
            processStageIntent();
        }, () => {
            try{ roomsUnsubscribe?.(); }catch(e){}
            roomsUnsubscribe = null;
            showToast(isSignedIn() ? 'Room list is unavailable right now.' : 'Sign in from Papiano home to load rooms.', { type:isSignedIn() ? 'error' : 'info', title:'Online Room' });
            syncAuthUi();
        });
    }

    function syncLobbyRoomPlayerSubscriptions(){
        if(!firebaseReady || !dbApi) return;
        const ids = new Set(rooms.map(room => room.id));
        lobbyRoomPlayerUnsubscribers.forEach((unsubscribe, roomId) => {
            if(ids.has(roomId)) return;
            try{ unsubscribe(); }catch(e){}
            lobbyRoomPlayerUnsubscribers.delete(roomId);
            delete roomPlayersByRoom[roomId];
            const timer = emptyRoomTimers.get(roomId);
            if(timer) clearTimeout(timer);
            emptyRoomTimers.delete(roomId);
        });
        rooms.forEach(room => {
            if(lobbyRoomPlayerUnsubscribers.has(room.id)) return;
            const unsubscribe = dbApi.onValue(dbRef(`roomPlayers/${room.id}`), snap => {
                roomPlayersByRoom[room.id] = snap.val() || {};
                reconcileRoomPresence(room);
                if(currentRoom && currentRoom.id === room.id) renderRoomChrome();
                scheduleRenderRooms();
            });
            lobbyRoomPlayerUnsubscribers.set(room.id, unsubscribe);
        });
    }

    function syncCurrentRoom(){
        if(!currentRoom) return;
        const updated = rooms.find(room => room.id === currentRoom.id);
        if(updated) currentRoom = updated;
        else if(isInPianoRoom()) leaveRoomToHome();
    }

    function createCompatDatabaseApi(firebaseGlobal){
        return {
            ref(database, path){ return database.ref(path); },
            onValue(ref, callback, reject){ ref.on('value', callback, reject); return () => ref.off('value', callback); },
            onChildAdded(ref, callback, reject){ ref.on('child_added', callback, reject); return () => ref.off('child_added', callback); },
            onChildChanged(ref, callback, reject){ ref.on('child_changed', callback, reject); return () => ref.off('child_changed', callback); },
            set(ref, value){ return ref.set(value); },
            update(ref, value){ return ref.update(value); },
            remove(ref){ return ref.remove(); },
            get(ref){ return ref.once('value'); },
            push(ref, value){ return value === undefined ? ref.push() : ref.push(value); },
            onDisconnect(ref){ return ref.onDisconnect(); },
            runTransaction(ref, update){ return ref.transaction(update).then(result => ({ committed:result.committed, snapshot:result.snapshot })); },
            query(ref, ...ops){ return ops.reduce((query, op) => op ? op(query) : query, ref); },
            limitToLast(count){ return query => query.limitToLast(count); }
        };
    }

    function wrapCompatDoc(snap){
        return { id:snap.id, exists:() => !!snap.exists, data:() => snap.data() || {} };
    }

    function createCompatFirestoreApi(firebaseGlobal){
        const makeOp = (method, args) => ({ method, args });
        return {
            collection(database, ...parts){
                let ref = database.collection(parts[0]);
                for(let i = 1; i < parts.length; i += 2) ref = ref.doc(parts[i]).collection(parts[i + 1]);
                return ref;
            },
            doc(database, ...parts){
                let ref = database.collection(parts[0]).doc(parts[1]);
                for(let i = 2; i < parts.length; i += 2) ref = ref.collection(parts[i]).doc(parts[i + 1]);
                return ref;
            },
            getDoc(ref){ return ref.get().then(wrapCompatDoc); },
            getDocs(query){ return query.get().then(snap => ({ forEach(callback){ snap.forEach(item => callback(wrapCompatDoc(item))); } })); },
            setDoc(ref, data, options){ return options?.merge ? ref.set(data, { merge:true }) : ref.set(data); },
            deleteDoc(ref){ return ref.delete(); },
            addDoc(collectionRef, data){ return collectionRef.add(data); },
            runTransaction(database, handler){ return database.runTransaction(handler); },
            increment(n){ return firebaseGlobal.firestore.FieldValue.increment(n); },
            serverTimestamp(){ return firebaseGlobal.firestore.FieldValue.serverTimestamp(); },
            arrayUnion(...args){ return firebaseGlobal.firestore.FieldValue.arrayUnion(...args); },
            arrayRemove(...args){ return firebaseGlobal.firestore.FieldValue.arrayRemove(...args); },
            onSnapshot(query, onNext, onError){
                if(typeof onError === 'function') return query.onSnapshot(onNext, onError);
                return query.onSnapshot(onNext);
            },
            where(...args){ return makeOp('where', args); },
            orderBy(...args){ return makeOp('orderBy', args); },
            startAt(...args){ return makeOp('startAt', args); },
            endAt(...args){ return makeOp('endAt', args); },
            limit(...args){ return makeOp('limit', args); },
            query(collection, ...ops){
                return ops.reduce((query, op) => op && op.method ? query[op.method](...op.args) : query, collection);
            }
        };
    }

    function initCompatFirebase(firebaseGlobal){
        const app = firebaseGlobal.apps && firebaseGlobal.apps.length ? firebaseGlobal.app() : firebaseGlobal.initializeApp(firebaseConfig);
        authApi = {
            getRedirectResult(auth){ return auth.getRedirectResult(); },
            onAuthStateChanged(auth, callback){ return auth.onAuthStateChanged(callback); }
        };
        firebaseAuth = firebaseGlobal.auth(app);
        dbApi = createCompatDatabaseApi(firebaseGlobal);
        db = firebaseGlobal.database(app);
        fsApi = createCompatFirestoreApi(firebaseGlobal);
        fsDb = firebaseGlobal.firestore(app);
    }

    async function initModularFirebase(){
        const [appMod, authMod, dbMod, firestoreMod] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js'),
            import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
        ]);
        const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
        authApi = authMod;
        firebaseAuth = authMod.getAuth(app);
        dbApi = dbMod;
        db = dbMod.getDatabase(app);
        fsApi = firestoreMod;
        fsDb = firestoreMod.getFirestore(app);
    }

    async function initFirebase(){
        if(firebaseReady) return firebaseInitPromise || Promise.resolve();
        if(firebaseInitPromise) return firebaseInitPromise;
        firebaseStarting = true;
        syncAuthUi();
        firebaseInitPromise = (async () => {
            try{
                if(window.firebase && window.firebase.auth && window.firebase.database && window.firebase.firestore) initCompatFirebase(window.firebase);
                else await initModularFirebase();
                firebaseReady = true;
                try{
                    const redirectResult = await authApi.getRedirectResult(firebaseAuth);
                    if(redirectResult?.user) await applyAuthenticatedUser(redirectResult.user);
                }catch(e){}
                authApi.onAuthStateChanged(firebaseAuth, user => {
                    if(user) applyAuthenticatedUser(user).catch(() => {});
                    else resetAuthenticatedUser();
                });
                syncAuthUi();
                attachRoomsListener();
                attachUsersListener();
                attachRoleRegistryListener();
            }catch(e){
                firebaseReady = false;
                firebaseInitPromise = null;
                showToast('Online connection unavailable.', { type:'error', title:'Papiano' });
                refreshAll();
            }finally{
                firebaseStarting = false;
                syncAuthUi();
            }
        })();
        return firebaseInitPromise;
    }


    syncMaxPlayers();
    syncRoomType();
    syncAuthUi();
    refreshAll();
    bindDragScroll(playerStrip, 'x');
    bindDragScroll(messagesBox, 'y');
    bindDragScroll(searchResults, 'y');
    window.setInterval(updateAllPlayerActivityUi, 15000);
    [layer, chatPanel, chatPreview, playerStrip, profile, reportModal, roomTypeModal, maxPlayersModal, passwordModal, leaveConfirm].forEach(isolate);
    refreshChatViewport();

    roomButton.addEventListener('click', () => {
        if(document.body.classList.contains('mp-room-active')){
            const open = !document.body.classList.contains('mp-chat-open');
            setChatOpen(open, { dismiss:!open });
        }else { showLayer('home'); initFirebase(); }
    });
    topLeaveButton?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); requestLeaveRoom('button'); });
    document.addEventListener('click', event => {
        if(event.target.closest('#mpLeaveTopBtn')){ event.preventDefault(); event.stopPropagation(); requestLeaveRoom('button'); }
    }, true);
    closeButton.addEventListener('click', () => currentScreen === 'home' ? closeLobbyToSolo() : showLayer('home'));
    chatClose.addEventListener('click', () => setChatOpen(false, { dismiss:true }));
    chatPreview?.addEventListener('click', event => {
        const trigger = event.target.closest('[data-mp-open-chat]');
        if(!trigger) return;
        event.preventDefault();
        setChatOpen(true);
    });
    chatInput?.addEventListener('focus', () => setChatKeyboardActive(true));
    chatInput?.addEventListener('input', updateChatCounter);
    chatInput?.addEventListener('blur', () => window.setTimeout(() => setChatKeyboardActive(false), 140));
    updateChatCounter();
    window.addEventListener('resize', refreshChatViewport, { passive:true });
    window.addEventListener('orientationchange', refreshChatViewport, { passive:true });
    window.visualViewport?.addEventListener('resize', () => {
        if(document.activeElement === chatInput) lockUiLayout(900);
        refreshChatViewport();
    }, { passive:true });
    window.visualViewport?.addEventListener('scroll', refreshChatViewport, { passive:true });
    profileClose.addEventListener('click', closeProfile);
    blockAction?.addEventListener('click', () => toggleBlockedPlayer(selectedPlayer));
    reportAction?.addEventListener('click', () => openReportModal(selectedPlayer));
    reportClose?.addEventListener('click', closeReportModal);
    reportCancel?.addEventListener('click', closeReportModal);
    reportSubmit?.addEventListener('click', submitPlayerReport);
    reportReasons?.addEventListener('click', event => {
        const button = event.target.closest('[data-report-reason]');
        if(!button) return;
        selectedReportReason = button.dataset.reportReason || 'Other';
        syncReportReasonButtons();
    });
    profileLikeButton?.addEventListener('click', () => castProfileVote('like'));
    profileDislikeButton?.addEventListener('click', () => castProfileVote('dislike'));
    friendAction?.addEventListener('click', () => toggleFriend(selectedPlayer));
    replyClear.addEventListener('click', () => setReply(null));
    statusFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            mpSearchStatusFilter = button.dataset.mpStatusFilter === 'friends' ? 'friends' : 'online';
            renderSearch();
        });
    });
    maxPlayersButton?.addEventListener('click', openMaxPlayersModal);
    maxPlayersClose?.addEventListener('click', closeMaxPlayersModal);
    maxPlayersModal?.addEventListener('click', event => { const choice = event.target.closest('[data-mp-max-choice]'); if(choice) setMaxPlayers(choice.dataset.mpMaxChoice); });
    roomTypeButton?.addEventListener('click', openRoomTypeModal);
    roomTypeClose?.addEventListener('click', closeRoomTypeModal);
    roomTypeModal?.addEventListener('click', event => { const choice = event.target.closest('[data-mp-room-type-choice]'); if(choice) setRoomType(choice.dataset.mpRoomTypeChoice); });
    passwordClose?.addEventListener('click', closePasswordModal);
    passwordCancel?.addEventListener('click', closePasswordModal);
    passwordSubmit?.addEventListener('click', submitPasswordModal);
    leaveYes?.addEventListener('click', leaveRoomToHome);
    leaveNo?.addEventListener('click', stayInPianoRoom);
    passwordInput?.addEventListener('keydown', event => { if(event.key === 'Enter') submitPasswordModal(); });

    layer.addEventListener('click', async event => {
        const go = event.target.closest('[data-mp-go]');
        const join = event.target.closest('[data-mp-join]');
        const create = event.target.closest('[data-mp-create]');
        const quick = event.target.closest('[data-mp-quick]');
        const player = event.target.closest('[data-mp-player]');
        if(go){
            if(go.dataset.mpGo === 'create') await openCreateScreen();
            else { if(go.dataset.mpGo !== 'home') initFirebase(); showLayer(go.dataset.mpGo); }
        }
        else if(join){
            if(isHomeMultiplayerPage()) openStagePiano({ action:'join', roomId:join.dataset.mpJoin });
            else await joinRoom(join.dataset.mpJoin);
        }
        else if(create){
            if(isHomeMultiplayerPage()) openStagePiano(getCreateRoomIntent());
            else await createRoom();
        }
        else if(quick){
            if(isHomeMultiplayerPage()) openStagePiano({ action:'quick' });
            else await quickMatch();
        }
        else if(player) openProfile(player.dataset.mpPlayer);
    });

    playerStrip.addEventListener('click', event => {
        const player = event.target.closest('[data-mp-player]');
        if(player) openProfile(player.dataset.mpPlayer);
    });

    function handleMessageAction(event){
        const row = event.target.closest('[data-mp-message]');
        if(!row) return;
        const message = messages.find(item => item.id === row.dataset.mpMessage);
        if(message) setReply(message);
    }

    messagesBox.addEventListener('click', handleMessageAction);
    chatForm.addEventListener('submit', event => { event.preventDefault(); addMessage(chatInput.value); });
    chatInput?.addEventListener('keydown', event => {
        if(event.key === 'Enter' && !event.shiftKey){
            event.preventDefault();
            addMessage(chatInput.value);
        }
    });

    profileVolume?.addEventListener('input', () => {
        if(!selectedPlayer) return;
        setRemoteMixer(selectedPlayer.id, { volume:(Number(profileVolume.value) || 0) / 100 });
    });
    profilePersonalMute?.addEventListener('click', () => {
        if(!selectedPlayer) return;
        const mixer = getRemoteMixer(selectedPlayer.id);
        setRemoteMixer(selectedPlayer.id, { muted:!mixer.muted });
    });

    kickBan.addEventListener('click', () => kickBanPlayer(selectedPlayer));
    muteChat.addEventListener('click', () => {
        if(!canModeratePlayer(selectedPlayer)) return;
        const s = getState(selectedPlayer.id);
        setModeration(selectedPlayer.id, { muteChat:!s.muteChat });
    });
    muteInst.addEventListener('click', () => {
        if(!canModeratePlayer(selectedPlayer)) return;
        const s = getState(selectedPlayer.id);
        setModeration(selectedPlayer.id, { muteInstrument:!s.muteInstrument });
    });

    document.addEventListener('keydown', event => {
        if(event.key !== 'Escape') return;
        if(leaveConfirm?.classList.contains('show')) stayInPianoRoom();
        else if(reportModal?.classList.contains('show')) closeReportModal();
        else if(roomTypeModal?.classList.contains('show')) closeRoomTypeModal();
        else if(maxPlayersModal?.classList.contains('show')) closeMaxPlayersModal();
        else if(passwordModal?.classList.contains('show')) closePasswordModal();
        else if(profile.classList.contains('show')) closeProfile();
        else if(document.body.classList.contains('mp-chat-open')) setChatOpen(false);
        else if(document.body.classList.contains('mp-lobby-open') && currentScreen !== 'home') showLayer('home');
    });

    window.addEventListener('popstate', event => {
        if(leaveConfirm?.classList.contains('show')){ stayInPianoRoom(); return; }
        if(reportModal?.classList.contains('show')){ closeReportModal(); return; }
        if(roomTypeModal?.classList.contains('show')){ closeRoomTypeModal(); return; }
        if(maxPlayersModal?.classList.contains('show')){ closeMaxPlayersModal(); return; }
        if(passwordModal?.classList.contains('show')){ closePasswordModal(); return; }
        if(profile?.classList.contains('show')){ closeProfile(); return; }
        if(document.body.classList.contains('mp-chat-open')){ setChatOpen(false); if(isInPianoRoom()) armPianoHistory(); return; }
        if(isInPianoRoom()){
            event.preventDefault?.();
            mpHistoryArmed = false;
            armPianoHistory();
            openLeaveConfirm('history');
            return;
        }
        if(document.body.classList.contains('mp-lobby-open')){
            if(currentScreen !== 'home'){
                showLayer('home', { skipHistory:true });
                replaceMpHistory('multiHome');
            } else {
                // Already on the multiplayer home: the phone back button should
                // leave the multiplayer page and return to the main app.
                window.location.assign('/');
            }
        }
    });

    window.addEventListener('beforeunload', () => {
        try{ mpPersistPlayTime(true); }catch(e){}
        try{ writeSelfUser({ online:false, room:null }); }catch(e){}
    });
    // pagehide is more reliable than beforeunload on mobile Chrome/Safari
    window.addEventListener('pagehide', () => {
        try{ mpPersistPlayTime(true); }catch(e){}
        try{ writeSelfUser({ online:false, room:null }); }catch(e){}
    });

    document.addEventListener('visibilitychange', () => {
        if(document.hidden){ pauseMpPlayTimeTracker(true); return; }
        if(!isSignedIn()) return;
        startMpPlayTimeTracker();
        // Returning from background / another app: re-assert presence immediately so
        // a valid player isn't left stale (and pruned as a ghost), and resume the
        // heartbeat that the browser throttled while hidden.
        if(currentRoom && isInPianoRoom() && typeof startRoomPresenceHeartbeat === 'function') startRoomPresenceHeartbeat();
        if(typeof touchGlobalPresence === 'function') touchGlobalPresence();
    });

    function isSolo(){ return typeof window !== 'undefined' && window.PAPIANO_SOLO === true; }
    function bootSoloPiano(){
        // Pure solo piano: no Firebase, no multiplayer home, no chat. A local
        // "room" lets the existing piano UI render; every Firebase call guards on
        // firebaseReady (which stays false), so they all no-op. Leave -> index.
        document.body.classList.add('solo-mode');
        mpSelfId = 'local_self';
        currentRoom = { id:'solo', name:'Solo', max:1, ownerId:'local_self', hostId:'local_self', type:'public', count:1 };
        currentScreen = 'pianoMulti';
        startBackgroundSoundfont();
        setRoomActive(true, { skipHistory:true });
        setPianoInputReady(true);
        if(typeof forceBootVisible === 'function') forceBootVisible();
    }
    // Solo build — loaded ONLY by solo.html. This is a standalone copy of the
    // piano engine that only ever runs solo (no Firebase, rooms or chat).
    // Multiplayer has its OWN copy in js/multiplayer/piano.js, so editing one
    // never affects the other.
    window.PAPIANO_SOLO = true;
    bootSoloPiano();
})();
