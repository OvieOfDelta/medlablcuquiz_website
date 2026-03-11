/* ================================================================
   QUIZ DATA
   ================================================================ */
let quizData = [];

const badgeData = {
    "Chemical Pathologist": "🧪",
    "Histopathologist":     "🥼",
    "Hematologist":         "🩸",
    "Microbiologist":       "🔬",
    "Laboratory Management":"🛡️"
};

/* ================================================================
   GLOBAL STATE
   ================================================================ */
let user       = null;
let authMode   = 'login';
let customImg  = null;
let currentQ   = [];
let qIdx       = 0;
let score      = 0;
let timer      = null;
let mistakes   = [];
let currentCat = '';
let currentSub = '';
let currentSsc = '';

/* ================================================================
   INITIALIZATION
   ================================================================ */
async function init() {
    const savedTheme = localStorage.getItem('medlab_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-icon').innerText = savedTheme === 'dark' ? '☀️' : '🌙';

    try {
        const response = await fetch('questions.json');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        quizData = await response.json();
        console.log('questions.json loaded — ' + quizData.length + ' questions ready.');
    } catch (err) {
        console.error('Failed to load questions.json:', err);
        alert('Could not load quiz questions.\n\nMake sure questions.json is in the same folder and refresh.');
        return;
    }
    // Auth state handled by Firebase onAuthStateChanged in firebase.js
}

init();

/* ================================================================
   THEME
   ================================================================ */
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('medlab_theme', next);
    document.getElementById('theme-icon').innerText = next === 'dark' ? '☀️' : '🌙';
}


/* ================================================================
   TOAST NOTIFICATION
   ================================================================ */
let toastTimer = null;

function showToast(msg, type = 'error', duration = 3000) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    // Clear any running timer
    if (toastTimer) clearTimeout(toastTimer);

    // Reset classes
    toast.className = '';
    toast.innerText = msg;

    // Force reflow so animation restarts if called twice quickly
    void toast.offsetWidth;

    toast.classList.add('show', 'toast-' + type);

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/* ================================================================
   AUTH UI
   ================================================================ */
function setAuthMode(mode) {
    authMode = mode;
    const regExtra    = document.getElementById('reg-extra');
    const forgotExtra = document.getElementById('forgot-extra');
    const passIn      = document.getElementById('p-in');
    const msg         = document.getElementById('auth-msg');
    const mainBtn     = document.getElementById('auth-main-btn');
    const btnReg      = document.getElementById('btn-reg');
    const btnForgot   = document.getElementById('btn-forgot');
    const btnLogin    = document.getElementById('btn-login');

    regExtra.classList.add('hidden');
    forgotExtra.classList.add('hidden');
    passIn.classList.remove('hidden');
    btnLogin.classList.add('hidden');
    btnReg.classList.remove('hidden');
    btnForgot.classList.remove('hidden');
    msg.innerText = '';

    if (mode === 'register') {
        msg.innerText     = 'Create your account';
        mainBtn.innerText = 'Register';
        regExtra.classList.remove('hidden');
        btnReg.classList.add('hidden');
        btnLogin.classList.remove('hidden');
    } else if (mode === 'forgot') {
        msg.innerText     = 'Recover your password';
        mainBtn.innerText = 'Recover';
        passIn.classList.add('hidden');
        forgotExtra.classList.remove('hidden');
        btnForgot.classList.add('hidden');
        btnLogin.classList.remove('hidden');
    } else {
        msg.innerText     = 'Login to track your trophies';
        mainBtn.innerText = 'Enter';
        btnLogin.classList.add('hidden');
    }
}

function handleAuth() {
    if (authMode === 'login')    { window.fbLogin();    return; }
    if (authMode === 'register') { window.fbRegister(); return; }
    if (authMode === 'forgot')   { window.fbForgot();   return; }
}

/* ================================================================
   LOGIN LOADER
   ================================================================ */
const loaderMessages = [
    'Verifying credentials…',
    'Loading your stats…',
    'Fetching leaderboard…',
    'Preparing dashboard…',
    'Almost there…'
];

function showLoginLoader(callback) {
    const loader = document.getElementById('login-loader');
    const textEl = document.getElementById('loader-text');
    const barEl  = document.getElementById('loader-bar');

    const newBar = barEl.cloneNode(true);
    barEl.parentNode.replaceChild(newBar, barEl);

    let msgIdx = 0;
    textEl.innerText = loaderMessages[msgIdx];
    const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % loaderMessages.length;
        textEl.innerText = loaderMessages[msgIdx];
    }, 380);

    loader.classList.remove('hidden', 'fade-out');

    setTimeout(() => {
        clearInterval(msgInterval);
        textEl.innerText = 'Welcome! ✅';
        loader.classList.add('fade-out');
        setTimeout(() => {
            loader.classList.add('hidden');
            callback();
        }, 500);
    }, 1800);
}

/* ================================================================
   IMAGE UPLOAD & COMPRESSION
   ================================================================ */
function toggleCustomFile() {
    const isCustom = document.getElementById('avatar-in').value === 'custom';
    document.getElementById('file-reg').classList.toggle('hidden', !isCustom);
}

function handleImageUpload(input, previewId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas    = document.createElement('canvas');
            const MAX_WIDTH = 150;
            const scale     = Math.min(1, MAX_WIDTH / img.width);
            canvas.width    = img.width  * scale;
            canvas.height   = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            customImg = canvas.toDataURL('image/jpeg', 0.7);
            const preview = document.getElementById(previewId);
            preview.src = customImg;
            preview.classList.remove('hidden');
        };
    };
    reader.readAsDataURL(file);
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function showMain() { window.fbShowMain(); }

/* ================================================================
   NAVIGATION
   ================================================================ */
function showSubMenu(cat) {
    currentCat = cat;
    hideAll();
    document.getElementById('sub-s').classList.remove('hidden');
    document.getElementById('sub-title').innerText = cat;

    const list = document.getElementById('sub-list-dynamic');
    list.innerHTML = '';

    const subs = [...new Set(quizData.filter(q => q.c === cat).map(q => q.sc))];
    subs.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'sub-item';
        item.innerHTML = '<div class="sub-item-title"><span>' + sub + '</span><span>➔</span></div>';
        item.onclick = () => showSubSubMenu(cat, sub);
        list.appendChild(item);
    });
}

function showSubSubMenu(cat, sub) {
    currentSub = sub;
    hideAll();
    document.getElementById('sub-s').classList.remove('hidden');
    document.getElementById('sub-title').innerText = cat + ' › ' + sub;

    const list = document.getElementById('sub-list-dynamic');
    list.innerHTML = '';

    const sscs = [...new Set(quizData.filter(q => q.c === cat && q.sc === sub).map(q => q.ssc))];
    const d    = window.userDoc || {};

    sscs.forEach(ssc => {
        const total    = quizData.filter(q => q.ssc === ssc).length;
        const mastered = (d.mastery && d.mastery[ssc]) ? d.mastery[ssc].length : 0;
        const pct      = total > 0 ? Math.round((mastered / total) * 100) : 0;

        const item = document.createElement('div');
        item.className = 'sub-item';
        item.innerHTML =
            '<div class="sub-item-title">' +
                '<span>' + ssc + '</span>' +
                '<span style="color:var(--accent); font-size:0.85rem;">' + pct + '%</span>' +
            '</div>' +
            '<div class="progress-container" style="margin-top:8px;">' +
                '<div class="progress-fill" style="width:' + pct + '%;"></div>' +
            '</div>';
        item.onclick = () => startQuiz(cat, sub, ssc);
        list.appendChild(item);
    });

    const backBtn = document.createElement('button');
    backBtn.className = 'btn secondary sm';
    backBtn.style.marginTop = '4px';
    backBtn.innerText = '← Back to ' + cat;
    backBtn.onclick = () => showSubMenu(cat);
    list.appendChild(backBtn);
}

/* ================================================================
   GAME ENGINE
   ================================================================ */
function startQuiz(cat, sub, ssc) {
    currentCat = cat; currentSub = sub; currentSsc = ssc;
    currentQ   = quizData
        .filter(q => q.c === cat && q.sc === sub && q.ssc === ssc)
        .sort(() => Math.random() - 0.5);

    if (currentQ.length === 0) { alert('No questions found for this topic.'); return; }

    qIdx = 0; score = 0; mistakes = [];
    hideAll();
    document.getElementById('game-s').classList.remove('hidden');
    showQ();
}

function showQ() {
    clearInterval(timer);
    const q = currentQ[qIdx];

    document.getElementById('q-text').innerText     = q.q;
    document.getElementById('game-stats').innerText = 'Q ' + (qIdx + 1) + ' / ' + currentQ.length;
    document.getElementById('game-progress').style.width = ((qIdx) / currentQ.length * 100) + '%';

    const opts = document.getElementById('opt-container');
    opts.innerHTML = '';
    q.o.forEach(o => {
        const b = document.createElement('button');
        b.className = 'btn secondary animate-pop';
        b.innerText = o;
        b.onclick   = () => handleAnswer(o);
        opts.appendChild(b);
    });

    const timeVal = parseInt(document.getElementById('diff-select').value);
    const timerEl = document.getElementById('timer-disp');

    if (timeVal > 0) {
        let t = timeVal;
        timerEl.innerText = t + 's';
        timer = setInterval(() => {
            t--;
            timerEl.innerText = t + 's';
            if (t <= 0) handleAnswer(null);
        }, 1000);
    } else {
        timerEl.innerText = '🧘 ∞';
    }
}

function handleAnswer(o) {
    clearInterval(timer);
    const q     = currentQ[qIdx];
    const isZen = parseInt(document.getElementById('diff-select').value) === 0;

    if (o === q.a) {
        if (!isZen) { score++; updateMastery(q); }
    } else {
        mistakes.push({ q: q.q, a: q.a, given: o, ex: q.ex || null });
    }

    qIdx++;
    qIdx < currentQ.length ? showQ() : endQuiz();
}

function endQuiz() {
    clearInterval(timer);
    hideAll();
    document.getElementById('res-s').classList.remove('hidden');

    const total    = currentQ.length;
    const answered = score + mistakes.length;
    const skipped  = total - answered;
    let fullyCompleted = false;

    if (answered === 0) {
        document.getElementById('res-score').innerText = '—';
        document.getElementById('res-sub').innerText   = 'No questions were answered.';
        document.getElementById('mistake-list').innerHTML =
            '<p style="text-align:center; color:var(--muted); padding:10px;">Start answering questions to see your results here.</p>';
        return;
    }

    const isZenResult = parseInt(document.getElementById('diff-select').value) === 0;

    if (isZenResult) {
        document.getElementById('res-score').innerText = '🧘';
        document.getElementById('res-sub').innerText   =
            'Zen Practice — ' + answered + ' of ' + total + ' completed · Not scored';
    } else {
        document.getElementById('res-score').innerText = score + ' / ' + total;
        fullyCompleted = answered === total;
        let subMsg = '';
        if (fullyCompleted) {
            if (score === total)                      subMsg = 'Perfect Score! 🎉';
            else if (score >= Math.ceil(total * 0.7)) subMsg = 'Great work! 👏';
            else                                      subMsg = 'Keep practising! 💪';
        } else {
            subMsg = answered + ' of ' + total + ' answered · ' + skipped + ' skipped';
        }
        document.getElementById('res-sub').innerText = subMsg;
    }

    if (!isZenResult) {
        window.fbSaveHighScore(score);
        window.fbCheckChallengeResult(score); // check if active challenge was beaten
    }

    const list = document.getElementById('mistake-list');
    list.innerHTML = '';

    if (mistakes.length === 0 && fullyCompleted) {
        list.innerHTML = '<p style="text-align:center; padding:10px;">No mistakes — flawless! 🏆</p>';
    } else if (mistakes.length > 0) {
        const heading = document.createElement('h3');
        heading.style.marginBottom = '10px';
        heading.innerText = 'Review Incorrect Answers:';
        list.appendChild(heading);

        mistakes.forEach(m => {
            const div = document.createElement('div');
            div.className = 'mistake-item';
            div.innerHTML =
                '<span>' + m.q + '</span><br>' +
                '<b>✅ ' + m.a + '</b>' +
                (m.ex ? '<div class="explanation">' + m.ex + '</div>' : '');
            list.appendChild(div);
        });
    }
}

function finishAndReturn() { showSubSubMenu(currentCat, currentSub); }

/* ================================================================
   MASTERY / LEADERBOARD / TROPHIES / SETTINGS
   — All delegate to Firebase functions in firebase.js
   ================================================================ */
function updateMastery(q)  { window.fbUpdateMastery(q); }
function showLeaderboard()  { window.fbShowLeaderboard(); }
function showTrophies()     { window.fbShowTrophies(); }
function updateSettings()   { window.fbUpdateSettings(); }
function resetData()        { window.fbResetData(); }

function showSettings() {
    hideAll();
    document.getElementById('settings-s').classList.remove('hidden');
    const d = window.userDoc || {};
    if (d.avatar && d.avatar.length <= 10) {
        const sel = document.getElementById('set-avatar');
        for (let opt of sel.options) {
            if (opt.value === d.avatar) { sel.value = d.avatar; break; }
        }
    }
}


/* ================================================================
   SHARE & INVITE
   ================================================================ */
const QUIZ_URL = 'https://ovieofDelta.github.io/OvieOfDelta_website';

function showShare() { window.fbShowShare(); }

function copyInviteCode() {
    const code = document.getElementById('invite-code-display').innerText;
    if (!code || code === '——') { showToast('No invite code yet.', 'error'); return; }
    navigator.clipboard.writeText(code)
        .then(() => showToast('Invite code copied! 📋', 'success'))
        .catch(() => showToast('Could not copy. Please copy manually.', 'error'));
}

function copyQuizLink() {
    navigator.clipboard.writeText(QUIZ_URL)
        .then(() => showToast('Quiz link copied! 📋', 'success'))
        .catch(() => showToast('Could not copy. Please copy manually.', 'error'));
}

function nativeShare() {
    const d = window.userDoc || {};
    const shareData = {
        title: 'Med Lab Quiz — NIMELSSA LCU',
        text: 'I've been using this quiz to prepare for MCQs — try it out! 🧪',
        url:  QUIZ_URL
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => copyQuizLink());
    } else {
        copyQuizLink();
    }
}

function shareScore() {
    const scoreEl = document.getElementById('res-score');
    const subEl   = document.getElementById('res-sub');
    const score   = scoreEl ? scoreEl.innerText : '?';
    const topic   = window.currentSsc || window.currentSub || 'Medical Lab';
    const d       = window.userDoc || {};
    const rank    = d.high >= 20 ? '💎 Diamond' : d.high >= 10 ? '🥇 Gold' :
                    d.high >= 5  ? '🥈 Silver'  : d.high >= 1  ? '🥉 Bronze' : '🎯 Unranked';

    const text =
        '🧪 Med Lab Quiz — NIMELSSA LCU
' +
        'I scored ' + score + ' on ' + topic + '!
' +
        rank + ' | 🔥 ' + (d.streak || 0) + ' day streak
' +
        'Challenge me → ' + QUIZ_URL;

    if (navigator.share) {
        navigator.share({ title: 'My Med Lab Score', text, url: QUIZ_URL })
            .catch(() => {
                navigator.clipboard.writeText(text)
                    .then(() => showToast('Score card copied! Paste anywhere to share 📋', 'success', 4000));
            });
    } else {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Score card copied! Paste anywhere to share 📋', 'success', 4000))
            .catch(() => showToast('Could not copy automatically.', 'error'));
    }
}

function challengeFromResult() {
    window.fbShowChallengeModal();
}

/* ================================================================
   UTILITY
   ================================================================ */
function hideAll() {
    clearInterval(timer);
    ['auth-s','main-s','sub-s','game-s','res-s','lead-s','trophy-s','settings-s','share-s']
        .forEach(id => document.getElementById(id).classList.add('hidden'));
}

function backToMain() { showMain(); }

/* ================================================================
   LOGOUT
   ================================================================ */
function logout() {
    clearInterval(timer);

    const loader  = document.getElementById('logout-loader');
    const textEl  = document.getElementById('logout-text');
    const barEl   = document.getElementById('logout-bar');

    const messages = ['Signing you out…', 'Clearing session…', 'See you soon! 👋'];
    let msgIdx = 0;
    textEl.innerText = messages[0];

    loader.classList.add('active');
    setTimeout(() => barEl.classList.add('draining'), 50);

    const msgInterval = setInterval(() => {
        msgIdx = Math.min(msgIdx + 1, messages.length - 1);
        textEl.innerText = messages[msgIdx];
    }, 400);

    setTimeout(() => {
        clearInterval(msgInterval);
        textEl.innerText = 'Logged out ✅';

        setTimeout(() => {
            user           = null;
            window.userDoc = null;
            customImg      = null;
            if (window.firebase_auth) window.firebase_auth.signOut();

            hideAll();
            document.getElementById('auth-s').classList.remove('hidden');
            setAuthMode('login');
            document.getElementById('u-in').value = '';
            document.getElementById('p-in').value = '';

            loader.classList.remove('active');
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.classList.remove('fade-out');
                barEl.classList.remove('draining');
            }, 400);
        }, 500);
    }, 1200);
}

/* ================================================================
   SHARE & INVITE SYSTEM
   ================================================================ */

const QUIZ_URL = 'https://ovieofDelta.github.io/OvieOfDelta_website/medlabquiz.html';

/* ── Show Share screen ─────────────────────────────────────── */
function showShare() {
    hideAll();
    document.getElementById('share-s').classList.remove('hidden');

    // Show quiz URL
    document.getElementById('share-url-display').innerText = QUIZ_URL;

    // Show invite code
    const d = window.userDoc || {};
    document.getElementById('my-invite-code').innerText = d.inviteCode || '—';

    // Load active challenges
    loadActiveChallenges();
}

/* ── Copy quiz link to clipboard ───────────────────────────── */
function copyQuizLink() {
    navigator.clipboard.writeText(QUIZ_URL).then(() => {
        showToast('Quiz link copied! 📋', 'success');
    }).catch(() => {
        showToast('Could not copy. Long-press the link to copy manually.', 'info', 4000);
    });
}

/* ── Copy invite code ──────────────────────────────────────── */
function copyInviteCode() {
    const code = (window.userDoc || {}).inviteCode;
    if (!code || code === '—') {
        showToast('No invite code yet. Try refreshing.', 'info');
        return;
    }
    const text = 'Join me on MedLab Quiz! Use my invite code: ' + code + '\n\nPlay here: ' + QUIZ_URL;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Invite message copied! 📋', 'success');
    }).catch(() => {
        showToast('Copy failed. Your code is: ' + code, 'info', 5000);
    });
}

/* ── Share result after quiz ───────────────────────────────── */
function shareResult() {
    const scoreEl  = document.getElementById('res-score').innerText;
    const d        = window.userDoc || {};
    const rank     = d.high >= 20 ? '💎 Diamond'
                   : d.high >= 10 ? '🥇 Gold'
                   : d.high >= 5  ? '🥈 Silver'
                   : d.high > 0   ? '🥉 Bronze'
                   : '🎯 Unranked';
    const streak   = d.streak || 0;
    const topic    = currentSsc || currentSub || currentCat || 'MedLab';

    const text =
        '🧪 Med Lab Quiz — NIMELSSA LCU\n' +
        'I just scored ' + scoreEl + ' on ' + topic + '!\n' +
        rank + ' | 🔥 ' + streak + ' day streak\n\n' +
        '👉 Play here: ' + QUIZ_URL;

    // Try native share sheet (mobile) first, fall back to clipboard
    if (navigator.share) {
        navigator.share({
            title: 'Med Lab Quiz Score',
            text:  text,
            url:   QUIZ_URL
        }).catch(() => {}); // user dismissed — no error needed
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Score copied to clipboard! Paste anywhere to share 📋', 'success', 4000);
        }).catch(() => {
            showToast('Could not copy automatically.', 'info');
        });
    }
}

/* ── Show challenge modal from results screen ──────────────── */
function showChallengeModal() {
    if (!currentSsc && !currentSub) {
        showToast('Finish a quiz first to issue a challenge.', 'info');
        return;
    }
    const topic = currentSsc || currentSub;
    document.getElementById('challenge-topic').innerText = topic;
    document.getElementById('challenge-modal').classList.remove('hidden');
    loadChallengePlayerList(topic);
}

function closeChallengeModal() {
    document.getElementById('challenge-modal').classList.add('hidden');
}

/* ── Load player list in challenge modal ───────────────────── */
async function loadChallengePlayerList(topic) {
    const list = document.getElementById('challenge-player-list');
    list.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:0.85rem;">Loading players…</p>';
    await window.fbLoadChallengeablePlayers(topic);
}

/* ── Load active challenges on share screen ────────────────── */
async function loadActiveChallenges() {
    const el = document.getElementById('challenges-list');
    el.innerHTML = '<p style="font-size:0.85rem; color:var(--muted); text-align:center; padding:10px;">Loading…</p>';
    await window.fbLoadChallenges();
}

/* ── Challenge buttons on leaderboard (called from firebase.js) */
function challengeFromLeaderboard(targetUsername, topic) {
    currentSsc = topic;
    currentSub = topic;
    document.getElementById('challenge-topic').innerText = topic || 'General';
    document.getElementById('challenge-modal').classList.remove('hidden');
    window.fbSendChallenge(targetUsername, topic || 'General', 0);
}

// acceptChallenge is defined in firebase.js and exposed via window.acceptChallenge
function acceptChallenge(id, topic) { window.acceptChallenge(id, topic); }
