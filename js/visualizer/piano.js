/* ═══════════════════════════════════════════════════════════════
   Papiano — Piano Visualizer / Stage Logic
   js/visualizer/piano.js

   Based on the Solo piano engine.
   Adds: MIDI file playback with play/pause/stop controls in top bar.
   ═══════════════════════════════════════════════════════════════ */

/* ── Boot / Loading helpers ───────────────────────────────────── */
function forceBootVisible() {
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    if (app) app.classList.add('fade-in');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        loadingScreen.setAttribute('aria-hidden', 'true');
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 120);
    }
}
window.addEventListener('error', () => setTimeout(forceBootVisible, 0));
window.addEventListener('unhandledrejection', () => setTimeout(forceBootVisible, 0));
setTimeout(forceBootVisible, 5200);

/* ── Toast ────────────────────────────────────────────────────── */
function showToast(message, opts) {
    opts = opts || {};
    const type = opts.type || 'info';
    const title = opts.title || (type === 'error' ? 'Error' : type === 'success' ? 'Done' : 'Notice');
    const duration = opts.duration || (type === 'error' ? 5000 : 3200);
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const icon = type === 'error' ? '!' : type === 'success' ? '\u2713' : 'i';
    const el = document.createElement('div');
    el.className = 'toast t-' + type;
    el.innerHTML =
        '<div class="toast-icon">' + icon + '</div>' +
        '<div class="toast-body"><div class="toast-title"></div><div class="toast-msg"></div></div>' +
        '<div class="toast-bar" style="animation-duration:' + duration + 'ms;"></div>';
    el.querySelector('.toast-title').textContent = title;
    el.querySelector('.toast-msg').textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    let done = false;
    const dismiss = () => {
        if (done) return; done = true;
        el.classList.remove('show');
        el.classList.add('hide');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 360);
    };
    el.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
}

/* ── Audio Context ────────────────────────────────────────────── */
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = (() => {
    try { return new AudioContextClass({ latencyHint: 'interactive' }); }
    catch (e) { return new AudioContextClass(); }
})();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 1.0;
const masterLimiter = audioCtx.createDynamicsCompressor();
try {
    masterLimiter.threshold.value = -3.0;
    masterLimiter.knee.value = 0.0;
    masterLimiter.ratio.value = 20.0;
    masterLimiter.attack.value = 0.003;
    masterLimiter.release.value = 0.25;
} catch (e) {}
masterGain.connect(masterLimiter);
masterLimiter.connect(audioCtx.destination);

/* ── SoundFont Loader ─────────────────────────────────────────── */
let sfBuffers = {};
let loadedSfKey = null;
const activeNotes = new Map();

function midiNoteToName(midi) {
    const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const oct = Math.floor(midi / 12) - 1;
    return names[midi % 12] + oct;
}

function loadSoundfontWithProgress(sfKey, url, onProgress, onDone) {
    if (loadedSfKey === sfKey && Object.keys(sfBuffers).length > 0) {
        if (onDone) onDone(true);
        return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
        const sfData = window.MIDI && window.MIDI.Soundfont;
        const key = sfData && Object.keys(sfData)[0];
        if (key && sfData[key]) {
            const pianoData = sfData[key];
            const notes = Object.keys(pianoData);
            let decoded = 0;
            const total = notes.length;
            const targetBuffers = {};
            if (total === 0) { if (onDone) onDone(false); return; }
            notes.forEach(note => {
                try {
                    const dataUri = pianoData[note];
                    const b64 = dataUri && dataUri.split(',')[1];
                    if (!b64) { decoded++; checkDone(); return; }
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    audioCtx.decodeAudioData(bytes.buffer.slice(0),
                        buf => { targetBuffers[note] = buf; decoded++; if (onProgress) onProgress(decoded, total); checkDone(); },
                        () => { decoded++; checkDone(); }
                    );
                } catch (e) { decoded++; checkDone(); }
            });
            function checkDone() {
                if (decoded >= total) {
                    sfBuffers = targetBuffers;
                    loadedSfKey = sfKey;
                    if (onDone) onDone(Object.keys(sfBuffers).length > 0);
                }
            }
        } else {
            if (onDone) onDone(false);
        }
    };
    script.onerror = () => { if (onDone) onDone(false); };
    if (!window.MIDI) window.MIDI = {};
    window.MIDI.Soundfont = {};
    document.head.appendChild(script);
}

function playNote(midi, velocity) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const noteName = midiNoteToName(midi);
    const buf = sfBuffers[noteName];
    if (!buf) return;
    // Stop existing note on same key
    stopNote(midi);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const peak = (velocity || 0.8) * 2.25;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peak, now + 0.006);
    src.connect(gainNode);
    gainNode.connect(masterGain);
    src.start();
    activeNotes.set(midi, { src, gainNode });
    // Highlight key
    highlightKey(midi, true);
}

function stopNote(midi) {
    const voice = activeNotes.get(midi);
    if (voice) {
        const now = audioCtx.currentTime;
        try {
            voice.gainNode.gain.cancelScheduledValues(now);
            voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
            voice.gainNode.gain.setTargetAtTime(0.0001, now, 0.08);
            voice.src.stop(now + 0.4);
        } catch (e) {}
        activeNotes.delete(midi);
    }
    highlightKey(midi, false);
}

function stopAllNotes() {
    activeNotes.forEach((voice, midi) => {
        try {
            voice.src.stop();
        } catch (e) {}
        highlightKey(midi, false);
    });
    activeNotes.clear();
}

/* ── Piano Build ──────────────────────────────────────────────── */
const TOTAL_KEYS = 88;
const FIRST_MIDI = 21; // A0
const WHITE_PATTERN = [0, 2, 3, 5, 7, 8, 10]; // C D E F G A B offsets
const BLACK_PATTERN = [1, 4, 6, 9, 11]; // only these pitch classes have black keys: C# D# F# G# A#

let keyElements = {};

function buildPiano() {
    const piano = document.getElementById('piano');
    if (!piano) return;
    piano.innerHTML = '';
    keyElements = {};

    const viewport = document.getElementById('pianoViewport');
    const vw = viewport ? viewport.clientWidth : window.innerWidth;
    // 52 white keys in 88-key piano
    const whiteCount = 52;
    const whiteWidth = vw / whiteCount;
    const blackWidth = whiteWidth * 0.58;

    let whiteIndex = 0;
    const whitePositions = [];

    // First pass: place white keys
    for (let i = 0; i < TOTAL_KEYS; i++) {
        const midi = FIRST_MIDI + i;
        const pitchClass = midi % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(pitchClass);
        if (!isBlack) {
            const el = document.createElement('div');
            el.className = 'white';
            el.dataset.midi = midi;
            el.style.left = (whiteIndex * whiteWidth) + 'px';
            el.style.width = whiteWidth + 'px';
            piano.appendChild(el);
            keyElements[midi] = el;
            whitePositions[midi] = whiteIndex * whiteWidth;
            whiteIndex++;
        }
    }

    // Second pass: place black keys
    for (let i = 0; i < TOTAL_KEYS; i++) {
        const midi = FIRST_MIDI + i;
        const pitchClass = midi % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(pitchClass);
        if (isBlack) {
            // Position black key between the two adjacent white keys
            const prevWhiteMidi = midi - 1;
            const nextWhiteMidi = midi + 1;
            let leftPos;
            if (whitePositions[prevWhiteMidi] !== undefined) {
                leftPos = whitePositions[prevWhiteMidi] + whiteWidth - blackWidth / 2;
            } else if (whitePositions[nextWhiteMidi] !== undefined) {
                leftPos = whitePositions[nextWhiteMidi] - blackWidth / 2;
            } else {
                continue;
            }
            const el = document.createElement('div');
            el.className = 'black';
            el.dataset.midi = midi;
            el.style.left = leftPos + 'px';
            el.style.width = blackWidth + 'px';
            piano.appendChild(el);
            keyElements[midi] = el;
        }
    }

    // Set piano width
    piano.style.width = (whiteCount * whiteWidth) + 'px';
}

function highlightKey(midi, active) {
    const el = keyElements[midi];
    if (el) {
        if (active) el.classList.add('active');
        else el.classList.remove('active');
    }
}

/* ── Falling Notes Canvas ─────────────────────────────────────── */
const falling = [];
let canvasCtx = null;
let canvasEl = null;
let animRunning = false;

function initCanvas() {
    canvasEl = document.getElementById('fx');
    if (!canvasEl) return;
    canvasCtx = canvasEl.getContext('2d');
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
}

function syncCanvasSize() {
    if (!canvasEl) return;
    const stage = document.querySelector('.stage');
    if (!stage) return;
    canvasEl.width = stage.clientWidth;
    canvasEl.height = stage.clientHeight;
}

function addFallingNote(midi, duration) {
    const viewport = document.getElementById('pianoViewport');
    const vw = viewport ? viewport.clientWidth : window.innerWidth;
    const whiteWidth = vw / 52;
    const blackWidth = whiteWidth * 0.58;

    const pitchClass = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pitchClass);

    // Calculate x position based on key
    const el = keyElements[midi];
    if (!el) return;
    const left = parseFloat(el.style.left);
    const width = isBlack ? blackWidth : whiteWidth;

    const speed = 3; // pixels per frame
    const heightPx = Math.max(20, (duration || 300) * speed * 0.06);

    falling.push({
        x: left,
        w: width,
        y: -heightPx,
        h: heightPx,
        speed: speed,
        color: isBlack ? 'rgba(120,220,255,0.7)' : 'rgba(91,198,242,0.85)',
        alive: true
    });

    if (!animRunning) startFallingLoop();
}

function startFallingLoop() {
    animRunning = true;
    requestAnimationFrame(drawFalling);
}

function drawFalling() {
    if (!canvasCtx || !canvasEl) { animRunning = false; return; }
    const W = canvasEl.width;
    const H = canvasEl.height;
    canvasCtx.clearRect(0, 0, W, H);

    let alive = false;
    for (let i = 0; i < falling.length; i++) {
        const n = falling[i];
        if (!n.alive) continue;
        n.y += n.speed;
        if (n.y > H) { n.alive = false; continue; }
        alive = true;
        canvasCtx.fillStyle = n.color;
        canvasCtx.beginPath();
        const r = 4;
        const x = n.x, y = n.y, w = n.w, h = n.h;
        canvasCtx.moveTo(x + r, y);
        canvasCtx.lineTo(x + w - r, y);
        canvasCtx.quadraticCurveTo(x + w, y, x + w, y + r);
        canvasCtx.lineTo(x + w, y + h - r);
        canvasCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        canvasCtx.lineTo(x + r, y + h);
        canvasCtx.quadraticCurveTo(x, y + h, x, y + h - r);
        canvasCtx.lineTo(x, y + r);
        canvasCtx.quadraticCurveTo(x, y, x + r, y);
        canvasCtx.fill();
    }

    // Cleanup dead notes
    if (falling.length > 200) {
        for (let i = falling.length - 1; i >= 0; i--) {
            if (!falling[i].alive) falling.splice(i, 1);
        }
    }

    if (alive || midiPlaying) requestAnimationFrame(drawFalling);
    else animRunning = false;
}

/* ── MIDI Parser (minimal) ────────────────────────────────────── */
// Lightweight MIDI file parser — handles format 0 & 1
function parseMidi(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    let pos = 0;

    function readStr(len) {
        let s = '';
        for (let i = 0; i < len; i++) s += String.fromCharCode(data[pos++]);
        return s;
    }
    function read16() { return (data[pos++] << 8) | data[pos++]; }
    function read32() { return (data[pos++] << 24) | (data[pos++] << 16) | (data[pos++] << 8) | data[pos++]; }
    function readVarLen() {
        let val = 0;
        let byte;
        do {
            byte = data[pos++];
            val = (val << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        return val;
    }

    // Header
    const headerTag = readStr(4);
    if (headerTag !== 'MThd') throw new Error('Not a valid MIDI file');
    const headerLen = read32();
    const format = read16();
    const numTracks = read16();
    const ticksPerBeat = read16();
    pos = 8 + headerLen;

    const tracks = [];

    for (let t = 0; t < numTracks; t++) {
        const trackTag = readStr(4);
        const trackLen = read32();
        if (trackTag !== 'MTrk') { pos += trackLen; continue; }

        const trackEnd = pos + trackLen;
        const events = [];
        let runningStatus = 0;

        while (pos < trackEnd) {
            const delta = readVarLen();
            let statusByte = data[pos];
            if (statusByte & 0x80) {
                pos++;
                if (statusByte < 0xf0) runningStatus = statusByte;
            } else {
                statusByte = runningStatus;
            }

            const type = statusByte & 0xf0;

            if (statusByte === 0xff) {
                // Meta event
                const metaType = data[pos++];
                const metaLen = readVarLen();
                if (metaType === 0x51) {
                    // Tempo
                    const tempo = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
                    events.push({ delta, type: 'tempo', tempo });
                }
                pos += metaLen;
            } else if (statusByte === 0xf0 || statusByte === 0xf7) {
                // SysEx
                const sysLen = readVarLen();
                pos += sysLen;
            } else if (type === 0x90) {
                // Note On
                const note = data[pos++];
                const vel = data[pos++];
                events.push({ delta, type: vel > 0 ? 'noteOn' : 'noteOff', note, velocity: vel / 127 });
            } else if (type === 0x80) {
                // Note Off
                const note = data[pos++];
                pos++; // velocity (ignored)
                events.push({ delta, type: 'noteOff', note, velocity: 0 });
            } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
                pos += 2;
            } else if (type === 0xc0 || type === 0xd0) {
                pos += 1;
            } else {
                // Unknown, try to skip
                pos++;
            }
        }
        pos = trackEnd;
        tracks.push(events);
    }

    return { format, numTracks, ticksPerBeat, tracks };
}

// Convert parsed MIDI to a flat timeline of absolute-time events (in ms)
function midiToTimeline(parsed) {
    const ticksPerBeat = parsed.ticksPerBeat;
    const timeline = [];

    for (const track of parsed.tracks) {
        let tickTime = 0;
        let msPerTick = (500000 / ticksPerBeat) / 1000; // default 120 BPM

        for (const ev of track) {
            tickTime += ev.delta;
            const timeMs = tickTime * msPerTick;

            if (ev.type === 'tempo') {
                msPerTick = (ev.tempo / ticksPerBeat) / 1000;
            } else if (ev.type === 'noteOn' || ev.type === 'noteOff') {
                timeline.push({
                    time: tickTime,
                    ms: 0, // will recalc below
                    type: ev.type,
                    note: ev.note,
                    velocity: ev.velocity
                });
            }
        }
    }

    // Recalculate ms with proper tempo changes
    // Collect all tempo events across all tracks
    const tempoMap = [];
    for (const track of parsed.tracks) {
        let tick = 0;
        for (const ev of track) {
            tick += ev.delta;
            if (ev.type === 'tempo') tempoMap.push({ tick, tempo: ev.tempo });
        }
    }
    tempoMap.sort((a, b) => a.tick - b.tick);
    if (tempoMap.length === 0) tempoMap.push({ tick: 0, tempo: 500000 });

    // Build tempo timeline
    function tickToMs(targetTick) {
        let currentTick = 0;
        let currentMs = 0;
        let currentTempo = 500000;
        let tempoIdx = 0;

        while (tempoIdx < tempoMap.length && tempoMap[tempoIdx].tick <= targetTick) {
            const t = tempoMap[tempoIdx];
            const dtick = t.tick - currentTick;
            currentMs += dtick * (currentTempo / ticksPerBeat) / 1000;
            currentTick = t.tick;
            currentTempo = t.tempo;
            tempoIdx++;
        }
        const dtick = targetTick - currentTick;
        currentMs += dtick * (currentTempo / ticksPerBeat) / 1000;
        return currentMs;
    }

    for (const ev of timeline) {
        ev.ms = tickToMs(ev.time);
    }

    timeline.sort((a, b) => a.ms - b.ms);
    return timeline;
}

/* ── MIDI Playback Engine ─────────────────────────────────────── */
let midiTimeline = null;
let midiPlaying = false;
let midiPaused = false;
let midiStartTime = 0;
let midiPauseTime = 0;
let midiEventIndex = 0;
let midiDuration = 0;
let midiAnimFrame = null;
let midiFileName = '';

const vizControls = document.getElementById('vizMidiControls');
const vizPlayBtn = document.getElementById('vizPlayBtn');
const vizPauseBtn = document.getElementById('vizPauseBtn');
const vizStopBtn = document.getElementById('vizStopBtn');
const vizProgress = document.getElementById('vizMidiProgress');

function showMidiControls() {
    if (vizControls) vizControls.classList.add('show');
}
function hideMidiControls() {
    if (vizControls) vizControls.classList.remove('show');
}

function loadMidiFromBase64(base64, name) {
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const parsed = parseMidi(bytes.buffer);
        midiTimeline = midiToTimeline(parsed);
        midiDuration = midiTimeline.length > 0 ? midiTimeline[midiTimeline.length - 1].ms : 0;
        midiFileName = name || 'MIDI File';
        showMidiControls();
        showToast('MIDI loaded: ' + midiFileName, { type: 'success' });
        updateProgress(0);
    } catch (e) {
        showToast('Failed to parse MIDI file.', { type: 'error' });
        console.error('MIDI parse error:', e);
    }
}

function startMidiPlayback() {
    if (!midiTimeline || midiTimeline.length === 0) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (midiPaused) {
        // Resume
        const elapsed = midiPauseTime - midiStartTime;
        midiStartTime = performance.now() - elapsed;
        midiPaused = false;
    } else {
        // Start from beginning
        midiEventIndex = 0;
        midiStartTime = performance.now();
        stopAllNotes();
    }
    midiPlaying = true;
    if (vizPlayBtn) vizPlayBtn.classList.add('playing');
    if (!animRunning) startFallingLoop();
    midiTick();
}

function pauseMidiPlayback() {
    if (!midiPlaying) return;
    midiPlaying = false;
    midiPaused = true;
    midiPauseTime = performance.now();
    if (vizPlayBtn) vizPlayBtn.classList.remove('playing');
    if (midiAnimFrame) cancelAnimationFrame(midiAnimFrame);
    stopAllNotes();
}

function stopMidiPlayback() {
    midiPlaying = false;
    midiPaused = false;
    midiEventIndex = 0;
    if (vizPlayBtn) vizPlayBtn.classList.remove('playing');
    if (midiAnimFrame) cancelAnimationFrame(midiAnimFrame);
    stopAllNotes();
    updateProgress(0);
}

function midiTick() {
    if (!midiPlaying) return;
    const elapsed = performance.now() - midiStartTime;

    while (midiEventIndex < midiTimeline.length) {
        const ev = midiTimeline[midiEventIndex];
        if (ev.ms > elapsed) break;

        if (ev.type === 'noteOn' && ev.velocity > 0) {
            playNote(ev.note, ev.velocity);
            // Calculate note duration for falling note
            let dur = 300;
            for (let j = midiEventIndex + 1; j < midiTimeline.length; j++) {
                const next = midiTimeline[j];
                if (next.note === ev.note && (next.type === 'noteOff' || (next.type === 'noteOn' && next.velocity === 0))) {
                    dur = next.ms - ev.ms;
                    break;
                }
            }
            addFallingNote(ev.note, dur);
        } else if (ev.type === 'noteOff' || (ev.type === 'noteOn' && ev.velocity === 0)) {
            stopNote(ev.note);
        }
        midiEventIndex++;
    }

    updateProgress(elapsed);

    if (midiEventIndex >= midiTimeline.length && elapsed > midiDuration + 2000) {
        stopMidiPlayback();
        showToast('Playback complete.', { type: 'success' });
        return;
    }

    midiAnimFrame = requestAnimationFrame(midiTick);
}

function updateProgress(elapsedMs) {
    if (!vizProgress) return;
    const cur = formatTime(elapsedMs);
    const total = formatTime(midiDuration);
    vizProgress.textContent = cur + ' / ' + total;
}

function formatTime(ms) {
    const sec = Math.floor((ms || 0) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ── Button Events ────────────────────────────────────────────── */
if (vizPlayBtn) vizPlayBtn.addEventListener('click', startMidiPlayback);
if (vizPauseBtn) vizPauseBtn.addEventListener('click', pauseMidiPlayback);
if (vizStopBtn) vizStopBtn.addEventListener('click', stopMidiPlayback);

/* ── SoundFont Boot ───────────────────────────────────────────── */
function startBackgroundSoundfont() {
    const chip = document.getElementById('bootSfChip');
    const txt = document.getElementById('bootSfChipText');
    const bar = document.getElementById('bootSfChipBar');
    const setTxt = s => { if (txt) txt.textContent = s; };
    const setBar = p => { if (bar) bar.style.width = Math.max(0, Math.min(100, p)) + '%'; };
    if (chip) chip.classList.add('show');
    setTxt('Loading sound');
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
                // Try loading MIDI from session
                loadMidiFromSession();
            } else {
                setTxt('Sound unavailable');
                setTimeout(() => { if (chip) chip.classList.remove('show'); }, 2600);
            }
        }
    );
    setTimeout(() => { if (chip) chip.classList.remove('show'); }, 15000);
}

/* ── Load MIDI from sessionStorage ────────────────────────────── */
function loadMidiFromSession() {
    const midiData = sessionStorage.getItem('vizMidiData');
    const midiName = sessionStorage.getItem('vizMidiName');
    if (midiData) {
        loadMidiFromBase64(midiData, midiName);
    }
}

/* ── Logo Toggle (hide/show UI) ───────────────────────────────── */
const logoToggle = document.getElementById('logoToggle');
if (logoToggle) {
    logoToggle.addEventListener('click', () => {
        document.body.classList.toggle('hide-ui');
    });
}

/* ── Fullscreen ───────────────────────────────────────────────── */
const fsBtn = document.getElementById('fsBtn');
if (fsBtn) {
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });
}

/* ── Init ─────────────────────────────────────────────────────── */
window.addEventListener('load', () => {
    const app = document.getElementById('app');
    const loadingScreen = document.getElementById('loadingScreen');
    if (app) app.classList.add('fade-in');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        loadingScreen.setAttribute('aria-hidden', 'true');
        loadingScreen.style.display = 'none';
    }
    buildPiano();
    initCanvas();
    startBackgroundSoundfont();
});

window.addEventListener('resize', () => {
    buildPiano();
    syncCanvasSize();
});
