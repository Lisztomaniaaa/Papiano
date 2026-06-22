/* ═══════════════════════════════════════════════════════════════
   Papiano — Piano Visualizer / Home Page Logic
   js/visualizer/home.js
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const linkInput = document.getElementById('vizLinkInput');
    const fileInput = document.getElementById('vizFileInput');
    const uploadArea = document.getElementById('vizUploadArea');
    const fileChip = document.getElementById('vizFileChip');
    const fileName = document.getElementById('vizFileName');
    const fileRemoveBtn = document.getElementById('vizFileRemove');
    const startBtn = document.getElementById('vizStartBtn');

    let selectedFile = null;

    // ── Drag-and-drop visual feedback ────────────────────────────
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFileSelect(files[0]);
        });
    }

    // ── File input change ────────────────────────────────────────
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    // ── Remove selected file ─────────────────────────────────────
    if (fileRemoveBtn) {
        fileRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearFile();
        });
    }

    function handleFileSelect(file) {
        const validExtensions = ['.mid', '.midi', '.mp4', '.webm', '.mov', '.avi', '.mkv'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
            showVizToast('Unsupported file type. Use MIDI or video files.', 'error');
            return;
        }
        selectedFile = file;
        if (fileName) fileName.textContent = file.name;
        if (fileChip) fileChip.classList.add('show');
        if (uploadArea) uploadArea.style.display = 'none';
        updateStartButton();
    }

    function clearFile() {
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        if (fileChip) fileChip.classList.remove('show');
        if (uploadArea) uploadArea.style.display = '';
        updateStartButton();
    }

    function updateStartButton() {
        if (!startBtn) return;
        const hasLink = linkInput && linkInput.value.trim().length > 0;
        const hasFile = !!selectedFile;
        startBtn.disabled = !(hasLink || hasFile);
    }

    // ── Link input change ────────────────────────────────────────
    if (linkInput) {
        linkInput.addEventListener('input', updateStartButton);
    }

    // ── Start Play ───────────────────────────────────────────────
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (selectedFile) {
                // Store file reference in sessionStorage metadata + redirect to stage
                try {
                    // For MIDI files, read and store in sessionStorage
                    const ext = selectedFile.name.split('.').pop().toLowerCase();
                    if (ext === 'mid' || ext === 'midi') {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            try {
                                // Store as base64
                                const base64 = btoa(
                                    new Uint8Array(e.target.result)
                                        .reduce((data, byte) => data + String.fromCharCode(byte), '')
                                );
                                sessionStorage.setItem('vizMidiData', base64);
                                sessionStorage.setItem('vizMidiName', selectedFile.name);
                                sessionStorage.removeItem('vizLink');
                                window.location.href = '/visualizer-stage.html';
                            } catch (err) {
                                showVizToast('Failed to read MIDI file.', 'error');
                            }
                        };
                        reader.onerror = () => showVizToast('Failed to read file.', 'error');
                        reader.readAsArrayBuffer(selectedFile);
                    } else {
                        // Video files — store name, URL.createObjectURL won't persist across page nav
                        // For now, store a marker and let stage handle it
                        sessionStorage.setItem('vizVideoName', selectedFile.name);
                        sessionStorage.removeItem('vizMidiData');
                        sessionStorage.removeItem('vizLink');
                        // Use a temporary object URL approach — won't work cross-page,
                        // so the stage will prompt re-upload. Mark intent.
                        sessionStorage.setItem('vizMode', 'video');
                        showVizToast('Video mode coming soon. Use MIDI files for now.', 'info');
                    }
                } catch (err) {
                    showVizToast('Error processing file.', 'error');
                }
            } else if (linkInput && linkInput.value.trim()) {
                // Store link and navigate
                const link = linkInput.value.trim();
                sessionStorage.setItem('vizLink', link);
                sessionStorage.removeItem('vizMidiData');
                sessionStorage.setItem('vizMode', 'link');
                // Link mode (YouTube/TikTok) — future feature
                showVizToast('Link import coming soon. Use MIDI files for now.', 'info');
            }
        });
    }

    // ── Toast helper ─────────────────────────────────────────────
    function showVizToast(message, type) {
        type = type || 'info';
        const wrap = document.getElementById('toastWrap');
        if (!wrap) { alert(message); return; }
        const icon = type === 'error' ? '!' : type === 'success' ? '\u2713' : 'i';
        const title = type === 'error' ? 'Error' : type === 'success' ? 'Done' : 'Notice';
        const duration = type === 'error' ? 4500 : 3000;
        const el = document.createElement('div');
        el.className = 'toast t-' + type;
        el.innerHTML =
            '<div class="toast-icon">' + icon + '</div>' +
            '<div class="toast-body">' +
            '<div class="toast-title">' + title + '</div>' +
            '<div class="toast-msg"></div>' +
            '</div>' +
            '<div class="toast-bar" style="animation-duration:' + duration + 'ms;"></div>';
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

    // ── Init ─────────────────────────────────────────────────────
    updateStartButton();

})();
