/* ================================================================
   FIREBASE.JS — All Firebase operations for Medical Lab Quiz
   Loaded as <script type="module"> in index.html
   ================================================================ */

import { initializeApp }
    from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs }
    from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

/* ── Config ──────────────────────────────────────────────────── */
const firebaseConfig = {
    apiKey:            "AIzaSyA6UtSUqHH4oIqGFVQRxNo9sE2kY-tT_6E",
    authDomain:        "medlablcuquiz.firebaseapp.com",
    projectId:         "medlablcuquiz",
    storageBucket:     "medlablcuquiz.firebasestorage.app",
    messagingSenderId: "216644964020",
    appId:             "1:216644964020:web:2c07580eafdde4bd6991e1"
};

const app           = initializeApp(firebaseConfig);
const firebase_auth = getAuth(app);
const db_fire       = getFirestore(app);

/* Expose auth instance so logout() in script.js can sign out */
window.firebase_auth = firebase_auth;

/* ================================================================
   LOAD & SAVE USER DOCUMENT
   ================================================================ */
window.loadUserDoc = async function(uid) {
    const snap = await getDoc(doc(db_fire, 'users', uid));
    if (snap.exists()) {
        window.userDoc      = snap.data();
        window.userDoc._uid = uid;
        return window.userDoc;
    }
    return null;
};

window.saveUserDoc = async function() {
    if (!window.userDoc || !window.userDoc._uid) return;
    const uid  = window.userDoc._uid;
    const data = { ...window.userDoc };
    delete data._uid;
    await setDoc(doc(db_fire, 'users', uid), data);
};

/* ================================================================
   AUTH — REGISTER
   ================================================================ */
window.fbRegister = async function() {
    const username = document.getElementById('u-in').value.trim();
    const password = document.getElementById('p-in').value.trim();
    const hint     = document.getElementById('hint-in').value.trim();
    const av       = document.getElementById('avatar-in').value;
    if (!username) { showToast('Please enter a username.', 'error'); return; }
    if (!password) { showToast('Please enter a password.', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

    const fakeEmail = username.toLowerCase().replace(/\s+/g, '_') + '@medlabquiz.local';

    try {
        showToast('Creating account…', 'info', 5000);
        const cred = await createUserWithEmailAndPassword(firebase_auth, fakeEmail, password);
        const uid  = cred.user.uid;
        const finalAvatar = (av === 'custom' && window.customImg) ? window.customImg : av;

        await setDoc(doc(db_fire, 'users', uid), {
            username,
            hint,
            avatar:    finalAvatar || '👤',
            high:      0,
            streak:    0,
            lastLogin: null,
            mastery:   {},
            badges:    []
        });

        window.customImg = null;
        showToast('Account created! Please log in. ✅', 'success', 3500);
        setTimeout(() => setAuthMode('login'), 400);

    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            showToast('Username already taken. Try a different one.', 'error');
        } else if (err.code === 'auth/weak-password') {
            showToast('Password must be at least 6 characters.', 'error');
        } else {
            showToast('Registration failed. Please try again.', 'error');
        }
    }
};

/* ================================================================
   AUTH — LOGIN
   ================================================================ */
window.fbLogin = async function() {
    const username = document.getElementById('u-in').value.trim();
    const password = document.getElementById('p-in').value.trim();


    if (!username) { showToast('Please enter a username.', 'error'); return; }
    if (!password) { showToast('Please enter a password.', 'error'); return; }

    const fakeEmail = username.toLowerCase().replace(/\s+/g, '_') + '@medlabquiz.local';

    try {
        showToast('Signing in…', 'info', 5000);
        await signInWithEmailAndPassword(firebase_auth, fakeEmail, password);
        // onAuthStateChanged fires automatically after this
    } catch (err) {
        showToast('Invalid username or password.', 'error');
    }
};

/* ================================================================
   AUTH — FORGOT PASSWORD (hint check)
   ================================================================ */
window.fbForgot = async function() {
    const username = document.getElementById('u-in').value.trim();
    const hintR    = document.getElementById('hint-recover').value.trim();


    if (!username) { showToast('Please enter your username.', 'error'); return; }

    try {
        showToast('Checking…', 'info', 5000);
        const snap = await getDocs(collection(db_fire, 'users'));
        let found  = null;
        snap.forEach(d => { if (d.data().username === username) found = d.data(); });

        if (found && found.hint === hintR) {
            showToast('Hint matched! ✅ Contact your admin to reset your password.', 'success', 5000);
        } else {
            showToast('Username or security hint is incorrect.', 'error');
        }
    } catch (err) {
        showToast('Could not check. Please try again.', 'error');
    }
};

/* ================================================================
   DASHBOARD — show main with streak & rank
   ================================================================ */
window.fbShowMain = async function() {
    hideAll();
    document.getElementById('main-s').classList.remove('hidden');

    const d = window.userDoc;
    if (!d) { logout(); return; }

    // Streak
    const today = new Date().setHours(0, 0, 0, 0);
    let streakIncreased = false;
    if (!d.lastLogin) {
        d.streak = 1; streakIncreased = true;
    } else if (today === d.lastLogin + 86400000) {
        d.streak++; streakIncreased = true;
    } else if (today > d.lastLogin) {
        d.streak = 1; streakIncreased = false;
    }
    d.lastLogin = today;
    await window.saveUserDoc();

    // Avatar
    const avatarSlot = document.getElementById('display-avatar');
    if (d.avatar && d.avatar.length > 10) {
        avatarSlot.innerHTML = '<img src="' + d.avatar + '" class="avatar-img">';
    } else {
        avatarSlot.innerText = d.avatar || '👤';
    }

    document.getElementById('display-user').innerText = d.username || window.user;

    // High score
    const highEl = document.getElementById('display-high');
    if (!d.high || d.high === 0) {
        highEl.innerHTML = '<span style="color:var(--muted);">No quiz completed yet</span>';
    } else {
        highEl.innerHTML = 'High: <b>' + d.high + '</b> pts';
    }

    // Rank
    let rank, rankProgress;
    if (!d.high || d.high === 0) {
        rank = '🎯 Unranked'; rankProgress = 0;
    } else if (d.high >= 20) {
        rank = '💎 Diamond'; rankProgress = 100;
    } else if (d.high >= 10) {
        rank = '🥇 Gold'; rankProgress = Math.round((d.high / 20) * 100);
    } else if (d.high >= 5) {
        rank = '🥈 Silver'; rankProgress = Math.round((d.high / 20) * 100);
    } else {
        rank = '🥉 Bronze'; rankProgress = Math.round((d.high / 20) * 100);
    }
    document.getElementById('display-rank').innerText     = rank;
    document.getElementById('rank-progress').style.width  = rankProgress + '%';

    // Streak flame
    const streakEl = document.getElementById('display-streak');
    streakEl.innerText = d.streak || 0;
    streakEl.classList.toggle('streak-flame', streakIncreased);
};

/* ================================================================
   MASTERY & BADGES
   ================================================================ */
window.fbUpdateMastery = async function(q) {
    const d = window.userDoc;
    if (!d.mastery)        d.mastery = {};
    if (!d.mastery[q.ssc]) d.mastery[q.ssc] = [];

    if (!d.mastery[q.ssc].includes(q.q)) {
        d.mastery[q.ssc].push(q.q);
    }

    const totalInSub  = quizData.filter(i => i.sc === q.sc).length;
    const sscsInSub   = [...new Set(quizData.filter(i => i.sc === q.sc).map(i => i.ssc))];
    let masteredCount = 0;
    sscsInSub.forEach(s => masteredCount += (d.mastery[s] ? d.mastery[s].length : 0));

    if (masteredCount >= totalInSub && !d.badges.includes(q.sc)) {
        d.badges.push(q.sc);
        setTimeout(() => alert('🏅 Badge unlocked: ' + q.sc + '!'), 400);
    }

    await window.saveUserDoc();
};

/* ================================================================
   SAVE HIGH SCORE
   ================================================================ */
window.fbSaveHighScore = async function(score) {
    const d = window.userDoc;
    if (score > (d.high || 0)) {
        d.high = score;
        await window.saveUserDoc();
    }
};

/* ================================================================
   LEADERBOARD — reads all users from Firestore
   ================================================================ */
window.fbShowLeaderboard = async function() {
    hideAll();
    document.getElementById('lead-s').classList.remove('hidden');

    const list = document.getElementById('lead-list');
    list.innerHTML = '<p style="text-align:center; color:var(--muted);">Loading leaderboard…</p>';

    try {
        const snap   = await getDocs(collection(db_fire, 'users'));
        const ranked = [];
        snap.forEach(d => {
            const data = d.data();
            ranked.push({ name: data.username || d.id, score: data.high || 0, avatar: data.avatar || '👤' });
        });
        ranked.sort((a, b) => b.score - a.score);
        list.innerHTML = '';

        if (ranked.length === 0) {
            list.innerHTML = '<p style="text-align:center;">No players yet!</p>';
            return;
        }

        const myName   = window.userDoc ? window.userDoc.username : '';
        const played   = ranked.filter(p => p.score > 0);
        const unranked = ranked.filter(p => p.score === 0);

        played.forEach((p, i) => {
            const row        = document.createElement('div');
            row.className    = 'lead-row' + (p.name === myName ? ' me' : '');
            const medal      = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
            const avatarHtml = p.avatar.length > 10
                ? '<img src="' + p.avatar + '" class="avatar-img" style="width:28px;height:28px;">'
                : p.avatar;
            row.innerHTML = '<span>' + medal + ' ' + avatarHtml + ' ' + p.name + (p.name === myName ? ' (You)' : '') + '</span><b>' + p.score + ' pts</b>';
            list.appendChild(row);
        });

        if (unranked.length > 0) {
            const divider = document.createElement('div');
            divider.style.cssText = 'text-align:center; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--muted); padding:12px 0 6px; border-top:1px dashed var(--border); margin-top:8px;';
            divider.innerText = '— Not Yet Ranked —';
            list.appendChild(divider);

            unranked.forEach(p => {
                const row        = document.createElement('div');
                row.className    = 'lead-row' + (p.name === myName ? ' me' : '');
                row.style.opacity = '0.6';
                const avatarHtml = p.avatar.length > 10
                    ? '<img src="' + p.avatar + '" class="avatar-img" style="width:28px;height:28px;">'
                    : p.avatar;
                row.innerHTML = '<span>🎯 ' + avatarHtml + ' ' + p.name + (p.name === myName ? ' (You)' : '') + '</span><b style="color:var(--muted); font-size:0.8rem;">No quiz completed</b>';
                list.appendChild(row);
            });
        }

    } catch (err) {
        list.innerHTML = '<p style="text-align:center; color:var(--danger);">Could not load leaderboard: ' + err.message + '</p>';
    }
};

/* ================================================================
   TROPHIES
   ================================================================ */
window.fbShowTrophies = async function() {
    hideAll();
    document.getElementById('trophy-s').classList.remove('hidden');

    const grid = document.getElementById('badge-grid');
    const d    = window.userDoc || {};
    grid.innerHTML = '';

    Object.keys(badgeData).forEach(name => {
        const owned = d.badges && d.badges.includes(name);
        const card  = document.createElement('div');
        card.className = 'badge-card' + (owned ? ' owned' : '');
        card.innerHTML =
            '<div style="font-size:2.5rem; filter:' + (owned ? 'none' : 'grayscale(1) opacity(0.25)') + '; margin-bottom:8px;">' + badgeData[name] + '</div>' +
            '<b>' + name + '</b>' +
            '<div style="font-size:0.72rem; color:var(--muted); margin-top:4px;">' + (owned ? '✅ Unlocked' : 'Locked') + '</div>';
        grid.appendChild(card);
    });
};

/* ================================================================
   SETTINGS — save avatar & password
   ================================================================ */
window.fbUpdateSettings = async function() {
    const d  = window.userDoc;
    const np = document.getElementById('set-pass').value.trim();
    const av = document.getElementById('set-avatar').value;

    if (window.customImg) d.avatar = window.customImg;
    else                  d.avatar = av;

    await window.saveUserDoc();

    if (np) {
        if (np.length < 6) {
            showToast('New password must be at least 6 characters.', 'error');
            return;
        }
        if (firebase_auth.currentUser) {
            try {
                await firebase_auth.currentUser.updatePassword(np);
            } catch (e) {
                showToast('Profile saved but password update failed.\nPlease log out and back in first.', 'error', 4000);
                return;
            }
        }
    }

    window.customImg = null;
    showToast('Settings saved! ✅', 'success');
    window.fbShowMain();
};

/* ================================================================
   RESET PROGRESS
   ================================================================ */
window.fbResetData = async function() {
    if (!confirm('This will wipe your mastery progress and badges. Continue?')) return;
    const d   = window.userDoc;
    d.mastery = {};
    d.badges  = [];
    d.high    = 0;
    await window.saveUserDoc();
    showToast('Progress reset.', 'info');
    window.fbShowMain();
};

/* ================================================================
   AUTH STATE OBSERVER
   Fires on every page load — if user is already signed in,
   loads their data and goes straight to dashboard
   ================================================================ */
onAuthStateChanged(firebase_auth, async (fbUser) => {
    if (fbUser) {
        const data = await window.loadUserDoc(fbUser.uid);
        if (data) {
            window.user = data.username;
            showLoginLoader(() => window.fbShowMain());
        }
    }
    // Not signed in — auth screen is shown by default in HTML
});
