# Papiano — Audit Menyeluruh Codebase

**Tanggal:** 2026-06-16
**Tujuan audit:** Produk profesional, Lighthouse hijau 90++ di semua device, tanpa lag/jank, latency sangat rendah.
**Metode:** 5 audit mendalam paralel (Home/Solo JS, Multiplayer engine, CSS, Auth/Security, HTML/a11y/SEO) + verifikasi independen (git history, diff, grep) oleh auditor utama.
**Cakupan:** SEMUA file diperiksa — `index.html`, `solo.html`, `multiplayer.html`, `admin.html`, seluruh `css/*`, seluruh `js/**`, `vercel.json`, `stamp-version.js`, `version.json`. Tidak ada yang terlewat.

Label tiap temuan: **SAFE** = perbaikan mekanis berisiko rendah · **RISK** = butuh kehati-hatian / bisa mengubah perilaku / butuh testing.

---

## Ringkasan Eksekutif

Codebase ini **secara umum berkualitas baik** — terutama engine audio/multiplayer (`js/multiplayer/app.js`) yang ditulis tangan dengan arsitektur matang (AudioContext reuse, voice limiting, rAF batching, performance governors). Namun ada **3 tema kritis** yang harus diselesaikan untuk mencapai tujuan "profesional + 90+ hijau + low latency":

1. **🔴 KEAMANAN — Tidak ada Firebase Security Rules sama sekali di repo.** Semua otorisasi (admin, moderasi, role, password room, reset massal) ditegakkan **hanya di JavaScript client**. Akibatnya: user biasa bisa menjadikan dirinya admin (`badgeId:'dev'`), membaca password room privat dari DevTools, dan kick/ban siapa pun. Ini risiko dominan dan tidak bisa diperbaiki dari frontend saja.

2. **🟠 PERFORMA/LATENCY — Hot-path realtime melakukan render ulang penuh + ada protokol note yang bisa kehilangan event.** `refreshAll()` & chat me-`innerHTML` ulang seluruh DOM tiap snapshot Firebase; broadcast note pakai `set()` satu slot yang bisa menimpa event saat permainan cepat (note nyangkut). Plus animasi `filter:blur()` tanpa henti, `will-change` permanen, dan CSS 170KB mentah.

3. **🟡 DUPLIKASI & DEAD CODE — `solo.html` ≈ `multiplayer.html` 99.7% identik (78KB), ~440KB file mati ter-deploy, edit-modal.js tidak terpakai.** Beban maintenance ganda + bytes sia-sia + risiko drift.

**Kabar baik:** Tidak ada secret server yang bocor (hanya config Firebase/Supabase publik yang memang by-design). XSS sudah ditangani benar (`escapeHtml` konsisten). Engine multiplayer **bersih dari jejak AI**.

---

## Dashboard Severity (≈ 70 temuan)

| Severity | Jumlah | Inti |
|---|---|---|
| 🔴 **Critical** | ~11 | Otorisasi client-side (no Security Rules), eskalasi admin, password plaintext, presence stuck online, render-ulang unthrottled, duplikasi solo/mp, canonical SEO salah |
| 🟠 **High** | ~20 | Protokol note bisa drop, no reconnect/offline UI, no double-submit guard, tickers 1s re-render, edit-modal mati→prompt(), CSS mentah 170KB, no `<h1>`, icon button tanpa label, enumeration/email-bomb |
| 🟡 **Medium** | ~20 | Dead code, typo copy-paste, reflow per keystroke, 74 empty catch, no reduced-motion, role fallback bug, no robots/manifest |
| ⚪ **Low** | ~20 | Komentar jejak AI, console.* di produksi, dead guards, var konflik, emoji UI |

---

## TEMA KRITIS #1 — Keamanan: Semua Otorisasi di Client (TIDAK AMAN)

> **Verdict: Model admin/otorisasi saat ini bisa di-bypass oleh user jahat.** Repo TIDAK punya `firestore.rules` / `database.rules.json` / `firebase.json` (dikonfirmasi via `git ls-files`). Selama rules di proyek Firebase live tidak ketat, seluruh model keamanan terbuka.

| # | File:Line | Masalah | Fix | Label |
|---|---|---|---|---|
| S1 | (repo) tidak ada `*.rules` | Tidak ada Security Rules — semua write (roles, moderation, donations, profiles.badgeId) lewat SDK client dengan kredensial user sendiri | Tulis & deploy Firestore + RTDB Rules; kunci field privat; admin via **custom claims** (`request.auth.token.admin`) | **RISK** |
| S2 | `js/app.js:1460-1492` | User bisa `set({badgeId:'dev', ownedRoles:['dev']})` ke profil sendiri → lolos cek admin di `admin.html:478` → **panel admin penuh**. Komentar "ownedRoles NEVER written from client" adalah jaminan semu (cek jalan di browser attacker) | Rules larang client menulis `badgeId`/`roleId`/`ownedRoles`; pakai custom claims, bukan `badgeId==='dev'` | **RISK** |
| S3 | `admin.html:468-500` | Gate admin hanya cek `ADMIN_EMAILS.has(email)` / `badgeId==='dev'` di browser, lalu tampilkan panel; semua write privileged langsung ke Firestore | Allowlist email pindah ke custom claims server; jangan percaya client | **RISK** |
| S4 | `js/multiplayer/app.js:6737, 8684` | Password room privat disimpan **plaintext** di `rooms/{id}`, di-broadcast ke SEMUA client via `onValue`, gate = string compare client. Siapa pun baca password di DevTools | Simpan hash bersalt / node `roomSecrets` write-only; gate join via Cloud Function/Rules | **RISK** |
| S5 | `js/multiplayer/app.js:7608-7613, 9821, 9833` | Wewenang moderasi/host dihitung client (`currentRoom.ownerUid === uid`). `currentRoom` variabel JS yang bisa diubah → self-promote / ban siapa pun | Tegakkan di RTDB Rules (`auth.uid === rooms/{id}/ownerUid`) | **RISK** |
| S6 | `js/app.js:83-86` | Supabase publishable key + URL di bundle. Key memang publik, TAPI bucket avatar/chat-image harus dilindungi **Storage RLS** server, bukan validasi client (bypassable) | Verifikasi RLS Supabase: batasi upload ke user terautentikasi + path `{uid}/` + size/MIME | **RISK** (backend) |
| S7 | `js/auth-email.js:154,204,304,478,568` | Enumeration: `fetchSignInMethodsForEmail` + pesan beda ("sudah terdaftar" / "pakai Google") → attacker bisa enumerasi akun & provider | Aktifkan **Email Enumeration Protection** di Firebase; pesan generic | **RISK** |
| S8 | `js/auth-email.js:278, 560` | Tidak ada throttle pada resend-verification & reset-password → bisa spam inbox korban / habiskan kuota email | Cooldown 30-60s + countdown; aktifkan **App Check** | **RISK** |
| S9 | `js/app.js` (auth bootstrap) | Tidak ada gate `emailVerified` — akun belum verifikasi tetap bisa pakai fitur (chat/multiplayer) | Cek `currentUser.emailVerified` + Rules `request.auth.token.email_verified == true` | **RISK** |
| S10 | `admin.html:856-902` | "Reset Zone" (wipe semua roles & profil) hanya dijaga `confirm()` + cek admin client → DoS/penghancuran data jika gate dibypass | Pindah ke Cloud Function ber-verifikasi claim + audit log | **RISK** |
| S11 | `js/multiplayer/app.js:9309, 9527` | Mute hanya kooperatif client — client modif bisa terus broadcast | RTDB rule tolak write ke `streams/{room}/{uid}` saat di-mute | **RISK** |
| S12 | `js/app.js:2811` | `imageURL` chat dirender tanpa allowlist `isSafeImage()` (avatar pakai, chat tidak) → bisa pixel pelacak/SSRF beacon ambil IP penonton | Lewatkan semua `<img src>` ke `isSafeImage()`, fallback ke inisial | **SAFE** |
| S13 | `js/auth-email.js:26-30,190-193` | Validasi domain email hanya di client (bypassable; tidak jalan di path Google) | Enforce di Cloud Function `beforeCreate`, atau anggap UX-only | **RISK** |

**✅ Sudah AMAN (diverifikasi, bukan false alarm):** Firebase apiKey publik by-design (admin.html:395, app.js:74, mp:6091); XSS chat/DM/admin/multiplayer aman (`escapeHtml`/`safeColor`/`linkifyText` konsisten); tidak ada service-account/private key/OAuth secret di client.

---

## TEMA KRITIS #2 — Performa & Latency (Hot-path realtime)

| # | File:Line | Masalah | Fix | Label |
|---|---|---|---|---|
| P1 | `js/multiplayer/app.js:9429-9522` | **Broadcast note pakai `set()` 1 slot/player** yang ditimpa tiap flush 18ms. RTDB hanya jamin "latest" → flush cepat bisa menimpa sebelum terkirim → **noteOn/noteOff hilang, note nyangkut** saat passage cepat/chord. Sweeper 10s hanya tambal | Ganti ke `push()` + `onChildAdded` (append-only log) atau sertakan rolling-buffer N event terakhir tiap write | **RISK** (ubah protokol, sender+receiver bareng) |
| P2 | `js/multiplayer/app.js:8657` (caller 9797/9802/10105) | `refreshAll()` rebuild 4 surface innerHTML (rooms+chrome+messages+search) tiap snapshot, **unthrottled** → jank main-thread tepat saat latency penting | Coalesce ke 1 `requestAnimationFrame` debounced (`scheduleRenderRooms` sudah ada sbg pola) | **SAFE** |
| P3 | `js/multiplayer/app.js:9755-9765` | Chat `onValue` re-render SEMUA pesan (`innerHTML`) tiap ada 1 pesan + scroll reset | Append node baru saja (keyed by id), simpan set id terender | **SAFE** |
| P4 | `js/app.js:1834-1885` & `:1106` | Dua `setInterval` 1 detik selalu jalan; leaderboard rebuild `innerHTML` 10 row+gambar tiap menit (flicker, GC churn); ticker playtime tiap detik | Update text node yang berubah saja; stop saat sub-page hidden | **RISK** |
| P5 | `js/multiplayer/app.js:8024-8025` | `resizeChatInput()` set height lalu baca `scrollHeight` (forced reflow) tiap keystroke | Cache / ukur via mirror; debounce | **SAFE** |
| P6 | `js/multiplayer/app.js:7944-7946` (`renderChatPreview` 7963) | `getBoundingClientRect()` piano/strip dibaca di jalur render chat tiap snapshot | Cache geometri (invalidate saat resize/orientation saja) | **SAFE** |
| P7 | `js/app.js:361-365` | `autoGrowChatInput` read-after-write reflow tiap keystroke (+ counter di event sama) | rAF-batch / cap recalculation | **RISK** |
| P8 | `js/app.js:2021-2044` | `renderFriendRowsImmediate` teardown penuh + `insertBefore` per-row (layout thrash N insert) | Build ke `DocumentFragment`, insert sekali; atau diff by `data-uid` | **RISK** |
| P9 | `css/multiplayer.css` (`#piano`:359, `#activeKeyLayer`:1951, `#saberLine`:141) | `will-change:transform` **permanen** pada elemen yang selalu ada → tahan layer GPU sepanjang sesi (boros memori, bisa perlambat mobile low-end) | Hapus pada `#piano`/`#activeKeyLayer`, atau toggle via `body.playing` saat animasi aktif saja | **RISK** |
| P10 | `css/multiplayer.css` (20× `backdrop-filter`) | Blur pada panel chat/modal besar & elemen scroll → penyebab utama jank compositor mobile | Drop blur pada `.mp-chat-preview-item`; gate modal blur di `@media(min-width:900px)`; solid bg di coarse pointer | **RISK** |
| P11 | `css/multiplayer.css` (raw 169KB) | `multiplayer.html`/`solo.html` muat CSS **mentah tanpa minify** (komentar+indentasi); render-blocking | Buat `multiplayer.min.css`, tambahkan ke daftar stamp; ganti `?v=dev` | **SAFE** |
| P12 | `js/multiplayer/app.js:1637` | `updateKeyHitCache()` re-query `getElementById('pianoWrap')` + rect tiap invalidasi | Cache referensi `pianoWrap` (statis pasca buildDOM) | **SAFE** |
| P13 | `js/app.js:1199-1207` (`filterThemedPicker` 1253) | List negara (~80) rebuild `innerHTML` tiap keystroke tanpa debounce | Debounce ~120ms (pola `scheduleProfileSearch` sudah ada) | **SAFE** |
| P14 | ~440KB file mati ter-deploy (lihat Tema #3) | Bytes publik sia-sia, cached `immutable` 1 tahun | Hentikan deploy file sumber | **SAFE** |
| P15 | `js/multiplayer/app.js` (10485 baris 1 file) | 8 subsistem dalam 1 IIFE; coupling via `typeof X!=='undefined'` lintas 5000 baris → rapuh, anti tree-shaking. Tidak menambah latency runtime, tapi mahal di maintenance | Pecah ke ES modules (audio/ render/ input/ net/) | **RISK** |

---

## TEMA KRITIS #3 — Duplikasi & Dead Code

| # | File:Line | Masalah | Fix | Label |
|---|---|---|---|---|
| D1 | `solo.html` vs `multiplayer.html` | **99.7% identik** — hanya 3 baris beda (title L6, `solo-mode` class L35, `window.PAPIANO_SOLO=true` L36). 78KB digandakan; JS sudah branch `isSolo` runtime | Satu template fisik; bedakan via `location.pathname` (rewrite Vercel) atau generate saat build di `stamp-version.js` | **RISK** |
| D2 | `css/base.css`, `components.css`, `pages.css`, `responsive.css` | **Orphan stale** — tidak dimuat HTML mana pun & divergen dari produksi (badge rarity lama, `.icons-ready` gate yang sudah dibuang). Edit di sini = nol efek + reintroduksi bug | Hapus, ATAU bangun build nyata yang generate `bundle.css` dari file ini. Pilih satu | **RISK** |
| D3 | `outputDirectory:"."` → ~440KB dead | `bundle.css` (141KB, kembaran mentah `bundle.min.css`) + 4 css orphan + `app.js`/`sdk-loader.js`/`updater.js` (kembaran mentah `.min.js`) semua ter-publish & cached 1 tahun | Build ke `dist/`, atau hapus sumber dari output | **SAFE** |
| D4 | `js/edit-modal.js` (seluruh file) | `window.__papianoEditModal` **tidak pernah dirujuk** di mana pun; sementara `app.js:3187` pakai `prompt()` native untuk edit pesan | Wire modal: `await window.__papianoEditModal.show(...)` ganti `prompt()` — sekaligus fix UI/UX #UX1 | **SAFE** |
| D5 | `js/app.js:3249` | `deleteMessageForAll()` 0 pemanggil | Hapus | **SAFE** |
| D6 | `js/app.js:794-796` | `safeUserId(uid)` abaikan param, selalu return `'#—'` | Ganti call dengan literal / drop param | **SAFE** |
| D7 | `css/bundle.css:1075-1093` | `.nav-tab-action.active .nav-pill-wrapper` didefinisikan **9×**; `:1075`(white) & `:1086`(accent) sama-sama `!important` di top-level → `:1075` mati | Hapus blok mati `:1075-1082` | **RISK** (cascade) |
| D8 | `css/bundle.css:707-751, 789-907` | Dua `@media(min-width:768px)` duplikat me-restyle `.reference-article-box` (tersebar di 7 blok) | Merge blok media duplikat | **RISK** |
| D9 | `css/multiplayer.css:~1875-1925` | Dua blok `#piano .white.active`/`.black.active` byte-identik (~1KB) | Hapus blok kedua | **SAFE** |
| D10 | `css/bundle.css:296-308` | `animation-delay` yatim setelah `animation:none` (11 deklarasi mati) | Hapus | **SAFE** |
| D11 | `css/bundle.css:596` | `@media(hover:hover){}` kosong | Hapus | **SAFE** |
| D12 | `css/bundle.css:16` | `.app-container::after{content:none}` self-null | Hapus | **SAFE** |
| D13 | `js/app.js:2144` vs `:2153` | Komputasi `localReadMs`/`updatedMs` ganda di `getRoomUnreadForMe` | Hoist ke atas fungsi | **SAFE** |

---

## Temuan per Kategori (mapping ke 10 poin permintaan)

### 1. Bug Code (runtime)
- 🔴 `js/app.js:646-662, 3911-3964` — **Presence stuck `online:true` selamanya setelah logout**. `logoutPapianoAccount()` tak reset `_mpPresenceRef`, tak set offline, tak cancel interval 30s → user logout/terhapus tetap "online" ke semua orang. **RISK**
- 🟠 `js/app.js:478-483` — `setAuthEntryMode(mode)` abaikan argumen, hardcode `'signin'` → jalur sign-up tak terjangkau. **RISK**
- 🟡 `js/app.js:1344` — typo copy-paste `profile.roleId || profile.roleId || ...` (harusnya `|| profile.badgeId`). **SAFE**
- 🟡 `admin.html:830-831` — donasi fallback `Object.keys(allRoles)[0]` bisa memberi role `admin`/`dev` sembarang ke donatur. **RISK**
- 🟡 `js/auth-email.js:451-557` — `deletePapianoAccount` tombstone profil SEBELUM `user.delete()`; jika delete gagal → **self-lockout** dengan pesan menyesatkan. **RISK**
- 🟡 `js/auth-email.js:209` — `setTimeout(authShowScreen('signin'),1600)` bisa menyentak user dari layar lain. **RISK**
- 🟡 `js/app.js:1682` — sub-page disisipkan sbg `firstChild` mendahului top bar → ubah tab/focus order, andalkan z-index. **RISK**
- ⚪ `js/multiplayer/app.js:7831` — guard mati di `renderSearch` (token dicek tepat setelah assign, selalu false). **SAFE**
- ⚪ `js/multiplayer/app.js:1804-1828` — `markFallingReleased` pilih note terakhir (bisa stop instance salah saat dua tekan midi sama). **SAFE**

### 2. Error Code (throw/silent fail/unhandled)
- 🟠 `js/app.js:3967-3993` — callback `onAuthStateChanged` `async` tapi rejection-nya unhandled → user bisa terjebak spinner tanpa toast saat Firestore transient error. **RISK**
- 🟠 `js/multiplayer/app.js:9755, 9767, 9800, 10129, 6415, 6438` — 6 listener `onValue` kritis **tanpa error callback** → permission error/reconnect gagal senyap, tanpa re-subscribe. **SAFE**
- 🟡 `js/multiplayer/app.js` — **~74 `catch{}` kosong** → kegagalan write (note stream 9441, seat claim 8835) tak terlihat user/log. **SAFE**
- 🟡 `js/app.js:2939-2956, 3414-3431` — loop batch Firestore tanpa recovery partial-failure → chat bisa inkonsisten "deletedForAll". **RISK**
- ⚪ `js/app.js:2575`, `js/sdk-loader.js:36` — `console.warn/error` di kode produksi (ding Lighthouse best-practices). **SAFE**

### 3. Trash + Duplikasi
→ Lihat **Tema Kritis #3** (D1-D13) — duplikasi solo/mp, orphan CSS, dead files, edit-modal mati, fungsi tak terpakai.

### 4. Jejak AI (mark tulisan AI)
- 🔴 **TERLIHAT DI UI LIVE** — `index.html:56` mencantumkan **"ChatGPT, Deepseek, KIRO, Claude"** sebagai contributor di halaman About. Ini jejak AI paling kentara, tampil ke user.
- ⚪ `js/app.js` — komentar over-explanatory bergaya AI di: `:99-100, :111-112, :150-152, :218-219, :274-276, :658-660 (NOTE:), :804-805, :910-913, :1037-1040, :1136-1138, :1460-1474, :1659-1675, :2334-2344, :2739-2762, :3152-3163, :3553-3555, :3833-3838`.
- ⚪ `js/auth-email.js:1-4` (header deps), `:451-454` ("complete override … to fix: 1. 2. 3.").
- ⚪ `admin.html:448,450,452-453,472,475,625,636,638` — narasi "names match their actual contents" dll; emoji `🎹 🚫 ⚠`.
- ⚪ `index.html:4` — banner bertanggal `/* === Email Auth UI 2026-06-11 === */`.
- ⚪ CSS — banner `===`: `bundle.css:1176, 1227, 1323-1328`; `multiplayer.css:4811-4817, 4951`. Komentar Indonesia campur Inggris (jejak multi-author/AI): `multiplayer.css:1845, 4824, 4903, 4921, 4981`; `bundle.css:1178, 1183, 1196, 1202, 1331, 1419`. Fix bertanggal: `bundle.css:1118, 1123, 1133, 1401`.
- ⚠️ `js/app.js:1460-1474` — komentar **menyesatkan**: klaim "ownedRoles NEVER written from client" seakan jaminan keamanan, padahal tak ada penegakan server.
- ✅ `js/multiplayer/app.js` — **NOL jejak AI** (bersih, tulisan tangan; 0 `console.*`, 0 TODO/emoji).
- **Fix umum:** pangkas komentar narasi saat minify; ganti/hapus kredit AI di UI; reword komentar `ownedRoles`. **SAFE**

### 5. Error Logic (js/css/html/auth)
- 🟠 `js/app.js:316-320` — `closeAccountRestrictionModal()` selalu buka ulang popup auth → user restricted terus dipantul ke login. **RISK**
- 🟡 `js/auth-email.js:163-169` — credential link Google ditelan `catch(_){}` lalu di-null tanpa syarat → linking gagal senyap, state desync. **RISK**
- 🟠 (auth) — tak ada gate `emailVerified` (lihat S9). **RISK**
- 🟡 `js/multiplayer/app.js:6974` vs `:7876` — threshold presence beda (room 45s vs global 180s) → user bisa "in-room tapi offline". **SAFE**
- 🟡 HTML — jumlah `role="dialog"` ≠ `aria-modal`; `aria-modal` diabaikan tanpa role tepat. **SAFE**
- ⚪ `css/multiplayer.css:50` vs `:4820` — `--piano-height` konflik 25vh/26vh; fallback literal tak sinkron. **SAFE**

### 6. Efisiensi
→ Lihat **Tema Kritis #2** (P1-P15).

### 7. Animasi Bug
- 🔴 `css/multiplayer.css` (seluruh) — **0 `prefers-reduced-motion`** padahal ada **7 animasi infinite** (`saberWaveFlow` :204/228, `spin` :830/831, `corePulse` :835, `rec-btn-pulse` :2107, `rec-dot-blink` :2142) → boros baterai/CPU, langgar WCAG 2.3.3. Infra `body.saber-motion-off`/`perf-lite` ada tapi tak di-wire ke preferensi OS. **SAFE**
- 🔴 `css/multiplayer.css:204, 228` — `#saberLine::before/::after` animasi `background-position` pada layer **`filter:blur(8px)`** infinite = repaint full-frame, biaya paint terbesar di layar piano. **RISK**
- 🟡 `css/multiplayer.css:2107-2112` — `rec-btn-pulse` animasi `box-shadow` (repaint tiap frame). **SAFE**
- 🟡 `css/multiplayer.css:104` — `transition:all` pada `.top` (bisa animasikan properti layout tak sengaja). **SAFE**
- ⚪ `js/app.js:1538-1553, 3859-3874` — ripple `getBoundingClientRect()` di `pointerdown` = forced reflow di jalur kritis input (tambah latency tap). **RISK**
- ⚪ `js/app.js:3845-3852` — carousel `setInterval` tetap tick saat off-screen (tab lain). **SAFE**
- ⚪ `js/multiplayer/app.js:2331` — `getKeyStageGeom(midi)` dihitung ulang per emitter per frame. **SAFE**

### 8. UI/UX / toast / popup
- 🟠 `js/app.js:1449-1499, 3086-3175` — **tak ada double-submit guard** pada Save-profile (tanpa busy flag sama sekali) & Send-message (hanya cooldown toast). **SAFE**
- 🟠 `js/multiplayer/app.js:8886, 8911, 8948` — **tak ada in-flight guard** enter/join/quickMatch/create room → double-tap mobile picu flow join 2× (race seat/presence). **SAFE**
- 🟠 `js/multiplayer/app.js` — **tak ada `.info/connected` monitor / banner reconnect / backoff** → saat socket drop, user tak diberi tahu; remote baru lihat hilang setelah timeout 45s. Gap UX terbesar untuk produk realtime. **SAFE**
- 🟠 `js/app.js:3187` — **`prompt()` native** untuk edit pesan (blocking, tak profesional, diblok di sebagian PWA). Pakai `edit-modal.js` yang sudah ada. **SAFE**
- 🟠 `index.html` — **13 icon button tanpa `aria-label`** (toggle password, back ×8, menu, send) → screen reader baca "button". **SAFE**
- 🟠 `index.html` — **11 label form tak terasosiasi** (hanya 5/16 pakai `for=`; input auth tanpa `aria-label`). **SAFE**
- 🟡 4 halaman — tak ada `<noscript>` fallback (app 100% JS). **SAFE**
- 🟡 `admin.html:144,153,303` & solo/mp close buttons — emoji/glyph sebagai ikon tanpa label. **SAFE**
- ⚪ `js/auth-email.js:278-292` — tombol resend tanpa loading/disabled state (double-submit). **SAFE**
- ⚪ `index.html:56` — overlay boot disembunyikan via `setTimeout 8000ms` → worst-case user lihat spinner 8 detik bila auth gagal. **RISK**
- ⚪ banyak `catch(()=>{})` tanpa feedback retry pada aksi user-initiated. **SAFE/RISK**

### 9. Logical Fallacy / Abuse / API di Frontend
→ Lihat **Tema Kritis #1** (S1-S13). Inti: menyembunyikan tombol/disable input **bukan** proteksi; semua keputusan keamanan di frontend bisa dibypass. Proteksi nyata WAJIB di Firebase Security Rules + custom claims + App Check.

### 10. Lain-lain (SEO / a11y / Build / Config)
**SEO:**
- 🔴 `solo.html:14,17,18,23` — `canonical`/`og:url` menunjuk `/multiplayer` → Google anggap solo duplikat → **de-index**. Title tab "Solo" tapi share "Multiplayer". **SAFE**
- 🟠 `index.html`, `solo.html`, `multiplayer.html` — **0 heading `<h1>`** di semua halaman pemain → sinyal SEO lemah + tak ada outline a11y. **SAFE**
- 🟡 `admin.html:6` — tanpa `<meta robots noindex>` → login admin bisa terindeks. **SAFE**
- 🟡 root — tak ada `robots.txt`, `sitemap.xml`, `manifest.json` (tak installable/PWA). **SAFE**

**Build/Config:**
- 🟡 Versi aset tak konsisten: `index.html` `?v=20260613`, multiplayer `?v=dev`. `stamp-version.js` me-rewrite keduanya ke commit-SHA saat build (jadi **bukan** stale-cache di produksi), tapi footgun bila file diserve tanpa build. **SAFE**
- 🟡 Minify **manual tanpa pengaman CI** — `app.min.js`/`bundle.min.css` saat ini sinkron, tapi rawan drift di masa depan. **SAFE**
- 🟡 `font-display` tak konsisten antar halaman (`optional` vs `swap`); Material-Symbols `font-display:block` bisa FOIT ikon ≤3s. **SAFE**

**A11y (verifikasi perilaku JS):**
- 🟡 5 `role="button"` non-`<button>` — pastikan `tabindex="0"` + handler Enter/Space + focus visible. **SAFE** verifikasi / **RISK** bila refactor.
- 🟡 Modal — pastikan focus-trap + Esc-close + restore focus (JS-driven). **RISK**.
- ⚪ `index.html` — 3 `<img src="">` kosong (memicu request redundant + warning). **SAFE**

---

## Roadmap Lighthouse 90+ Hijau (semua device)

**Performance:**
1. Minify `multiplayer.css` + stop deploy ~440KB dead files (P11, P14, D3) → lolos audit "Minify CSS" & "Reduce unused CSS".
2. Throttle `refreshAll()` + chat incremental (P2, P3) + stop 1s tickers re-render (P4) → turunkan TBT/INP (jank main-thread).
3. Tame paint screen piano: hapus `will-change` permanen (P9), kurangi `backdrop-filter` (P10), reduced-motion (Animasi). → naikkan FPS mobile.
4. Tambah `preconnect`/`dns-prefetch` gstatic/jsdelivr/firebase; `font-display:swap` konsisten → perbaiki LCP/CLS.

**Accessibility:** `aria-label` 13 icon button + asosiasi 11 label form + tambah `<h1>` per halaman + reduced-motion → lompatan skor a11y terbesar.

**Best Practices:** hapus `console.*` produksi (Error #2); ganti `prompt()` (UX8); `<img src="">` (LAIN-10).

**SEO:** fix canonical solo (LAIN-10 🔴) + `<h1>` + `robots noindex` admin + `robots.txt`/`sitemap.xml`/`manifest.json`.

---

## Rencana Aksi Bertahap

### 🟢 BATCH SAFE (quick wins, risiko rendah — bisa langsung dikerjakan)
Dampak besar ke skor 90+ & profesionalitas, perilaku tak berubah:
- Wire `edit-modal.js`, buang `prompt()` (D4/UX) · hapus dead code D5,D6,D9-D13 · hapus console.* · fix typo Bug-1344
- `aria-label` icon buttons + asosiasi label + `<h1>` + `<noscript>` (UI/UX, a11y)
- Fix canonical/OG `solo.html` + `robots noindex` admin + `robots.txt`/`sitemap.xml`/`manifest.json` (SEO)
- Minify `multiplayer.css` + hapus deploy file dead (Perf P11/P14)
- Throttle `refreshAll`/chat (P2/P3) · cache geometri/ref (P5/P6/P12) · debounce picker (P13)
- `prefers-reduced-motion` (Animasi 🔴 SAFE) · double-submit & in-flight guards (UI/UX) · error callbacks listener + toast koneksi (Error)
- Gate `imageURL` via `isSafeImage` (S12) · pangkas komentar/kredit jejak AI (Kategori 4)

### 🟠 BATCH RISK (butuh review + testing per item)
- **Keamanan (PRIORITAS TERTINGGI):** tulis Firebase Security Rules + custom claims + App Check (S1-S5, S10) · hash password room (S4) · verifikasi RLS Supabase (S6) · enumeration/throttle (S7-S9)
- **Perf protokol:** ganti broadcast note `set()`→`push()` (P1) · `will-change`/`backdrop-filter` tuning ukur di device (P9/P10) · saber blur (Animasi)
- **Struktur:** de-dup `solo.html`/`multiplayer.html` (D1) · resolusi orphan CSS (D2) · pecah `multiplayer/app.js` ke modules (P15)
- **Bug perilaku:** presence-on-logout (Bug 🔴) · setAuthEntryMode · closeAccountRestrictionModal · delete-account ordering · donation role fallback

---

## Lampiran — Status File (lengkap, tak ada yang terlewat)

| File | Baris | Status audit |
|---|---|---|
| `index.html` | ~63 (long) | ✅ a11y/SEO/perf/AI-trace |
| `solo.html` | 1047 | ✅ 99.7% dup multiplayer.html |
| `multiplayer.html` | 1047 | ✅ master dari pasangan dup |
| `admin.html` | 933 | ✅ security/AI-trace/a11y |
| `css/bundle.min.css` | (shipped) | ✅ sinkron dgn bundle.css |
| `css/bundle.css` | 1577 | ✅ dead-deploy, dedup |
| `css/multiplayer.css` | 5022 | ✅ perf/animasi/AI-trace |
| `css/base/components/pages/responsive.css` | — | ✅ orphan stale (dead) |
| `js/app.js` | 4029 | ✅ bug/logic/perf/AI-trace |
| `js/app.min.js` | (shipped) | ✅ sinkron dgn app.js |
| `js/multiplayer/app.js` | 10485 | ✅ engine realtime, hot-path |
| `js/multiplayer/init.js` | 44 | ✅ bersih |
| `js/auth-email.js` | 582 | ✅ security/logic |
| `js/edit-modal.js` | 52 | ✅ DEAD (tak terpakai) |
| `js/sdk-loader.js` / `.min` | 54 | ✅ bersih (console.error :36) |
| `js/updater.js` / `.min` | 48 | ✅ interval app-lifetime OK |
| `vercel.json` | 121 | ✅ cache/headers OK |
| `stamp-version.js` | 28 | ✅ versioning OK |

---
*Audit ini analisis saja — tidak ada file yang diubah. Semua sitasi `file:line` terverifikasi.*
