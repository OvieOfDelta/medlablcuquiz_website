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
    const username   = document.getElementById('u-in').value.trim();
    const password   = document.getElementById('p-in').value.trim();
    const hint       = document.getElementById('hint-in').value.trim();
    const av         = document.getElementById('avatar-in').value;
    const codeInput  = document.getElementById('invite-code-in');
    window._pendingInviteCode = codeInput ? codeInput.value.trim().toUpperCase() : null;
    if (!username) { showToast('Please enter a username.', 'error'); return; }
    if (!password) { showToast('Please enter a password.', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

    const fakeEmail = username.toLowerCase().replace(/\s+/g, '_') + '@medlabquiz.local';

    try {
        showToast('Creating account…', 'info', 5000);
        const cred = await createUserWithEmailAndPassword(firebase_auth, fakeEmail, password);
        const uid  = cred.user.uid;
        const finalAvatar = (av === 'custom' && window.customImg) ? window.customImg : av;

        const inviteCode = generateInviteCode(username);
        await setDoc(doc(db_fire, 'users', uid), {
            username,
            hint,
            avatar:      finalAvatar || '👤',
            high:        0,
            streak:      0,
            lastLogin:   null,
            mastery:     {},
            badges:      [],
            inviteCode,
            invitedBy:   window._pendingInviteCode || null,
            inviteCount: 0,
            notifications: []
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

    // Load challenge notifications
    window.fbLoadChallengeBanner();
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

/* ================================================================
   SHARING & CHALLENGES — Firebase Functions
   ================================================================ */

/* ── Generate a unique invite code for new users ─────────────
   Format: USERNAME-XXXX (4 random digits)
   Stored on the user's Firestore document
   ──────────────────────────────────────────────────────────── */
async function generateInviteCode(username) {
    const digits = Math.floor(1000 + Math.random() * 9000);
    const code   = username.toUpperCase().replace(/\s+/g,'').slice(0,6) + '-' + digits;
    return code;
}

/* ── Ensure every user has an invite code (called on register) */
async function ensureInviteCode(uid, username) {
    const d = window.userDoc;
    if (!d.inviteCode) {
        d.inviteCode     = await generateInviteCode(username);
        d.inviteCount    = 0;     // how many people used their code
        d.invitedBy      = null;  // who invited them
        await window.saveUserDoc();
    }
}

/* ── Load all players the current user can challenge ────────── */
window.fbLoadChallengeablePlayers = async function(topic) {
    const list    = document.getElementById('challenge-player-list');
    const myName  = window.userDoc ? window.userDoc.username : '';
    const myScore = score; // current game score from script.js

    try {
        const snap = await getDocs(collection(db_fire, 'users'));
        const players = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.username && data.username !== myName) {
                players.push({ uid: d.id, name: data.username, avatar: data.avatar || '👤' });
            }
        });

        list.innerHTML = '';

        if (players.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:0.85rem;">No other players yet!</p>';
            return;
        }

        players.forEach(p => {
            const item = document.createElement('div');
            item.className = 'challenge-player-item';
            const avatarHtml = p.avatar.length > 10
                ? '<img src="' + p.avatar + '" class="avatar-img" style="width:28px;height:28px; margin-right:8px;">'
                : '<span style="margin-right:8px;">' + p.avatar + '</span>';
            item.innerHTML =
                '<span>' + avatarHtml + p.name + '</span>' +
                '<button class="btn primary sm" style="width:auto; margin:0; padding:8px 14px;" ' +
                'onclick="window.fbSendChallenge(\'' + p.name + '\', \'' + topic + '\', ' + myScore + '); closeChallengeModal();">' +
                'Challenge ⚔️</button>';
            list.appendChild(item);
        });

    } catch (err) {
        list.innerHTML = '<p style="color:var(--danger); font-size:0.85rem;">Could not load players: ' + err.message + '</p>';
    }
};

/* ── Send a challenge to another player ─────────────────────── */
window.fbSendChallenge = async function(targetUsername, topic, challengerScore) {
    const myName = window.userDoc ? window.userDoc.username : '';
    if (!myName) return;

    try {
        // Find the target user's document
        const snap = await getDocs(collection(db_fire, 'users'));
        let targetUid  = null;

        snap.forEach(d => {
            if (d.data().username === targetUsername) targetUid = d.id;
        });

        if (!targetUid) {
            showToast('Player not found.', 'error');
            return;
        }

        // Write challenge document to Firestore
        const challengeId = myName + '_' + targetUsername + '_' + Date.now();
        await setDoc(doc(db_fire, 'challenges', challengeId), {
            from:        myName,
            to:          targetUsername,
            toUid:       targetUid,
            topic:       topic,
            score:       challengerScore,
            status:      'pending',   // pending | accepted | beaten
            createdAt:   Date.now()
        });

        showToast('Challenge sent to ' + targetUsername + '! ⚔️', 'success', 3000);

    } catch (err) {
        showToast('Could not send challenge. Try again.', 'error');
    }
};

/* ── Load challenges for current user (sent TO them) ────────── */
window.fbLoadChallenges = async function() {
    const el     = document.getElementById('challenges-list');
    const myName = window.userDoc ? window.userDoc.username : '';
    if (!myName) return;

    try {
        // Load challenges sent to me
        const snap = await getDocs(collection(db_fire, 'challenges'));
        const mine = [];

        snap.forEach(d => {
            const data = d.data();
            if (data.to === myName && data.status === 'pending') {
                mine.push({ id: d.id, ...data });
            }
        });

        // Also load challenges I sent
        const sent = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.from === myName) {
                sent.push({ id: d.id, ...data });
            }
        });

        el.innerHTML = '';

        if (mine.length === 0 && sent.length === 0) {
            el.innerHTML = '<p style="font-size:0.85rem; color:var(--muted); text-align:center; padding:10px;">No active challenges</p>';
            return;
        }

        // ── Challenges received ──
        if (mine.length > 0) {
            const heading = document.createElement('p');
            heading.style.cssText = 'font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:var(--muted); margin-bottom:8px;';
            heading.innerText = 'Challenges Received';
            el.appendChild(heading);

            mine.forEach(c => {
                const item = document.createElement('div');
                item.className = 'active-challenge-item';
                item.innerHTML =
                    '<b>⚔️ ' + c.from + '</b> challenged you on <b>' + c.topic + '</b>!<br>' +
                    '<span style="color:var(--muted); font-size:0.8rem;">Their score: ' + c.score + ' pts — can you beat it?</span><br>' +
                    '<button class="btn primary sm" style="margin-top:8px; width:auto; padding:8px 14px;" ' +
                    'onclick="acceptChallenge(\'' + c.id + '\', \'' + c.topic + '\')">Accept ⚔️</button>';
                el.appendChild(item);
            });
        }

        // ── Challenges sent ──
        if (sent.length > 0) {
            const heading2 = document.createElement('p');
            heading2.style.cssText = 'font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:var(--muted); margin:12px 0 8px;';
            heading2.innerText = 'Challenges Sent';
            el.appendChild(heading2);

            sent.forEach(c => {
                const item = document.createElement('div');
                item.className = 'active-challenge-item';
                const statusIcon = c.status === 'beaten' ? '😅 Beaten by' : c.status === 'accepted' ? '🎯 Accepted by' : '⏳ Waiting for';
                item.innerHTML =
                    statusIcon + ' <b>' + c.to + '</b> on <b>' + c.topic + '</b><br>' +
                    '<span style="color:var(--muted); font-size:0.8rem;">Your score to beat: ' + c.score + ' pts</span>';
                el.appendChild(item);
            });
        }

    } catch (err) {
        el.innerHTML = '<p style="color:var(--danger); font-size:0.85rem;">Could not load challenges.</p>';
    }
};

/* ── Accept a challenge (starts the quiz on that topic) ──────── */
window.acceptChallenge = async function(challengeId, topic) {
    // Mark as accepted in Firestore
    try {
        await setDoc(doc(db_fire, 'challenges', challengeId), { status: 'accepted' }, { merge: true });
    } catch (e) {}

    closeChallengeModal();
    showToast('Challenge accepted! Find ' + topic + ' in the menu to play.', 'info', 4000);
    backToMain();
};

/* ── Check for incoming challenges on login — show dashboard banner ─ */
window.fbCheckIncomingChallenges = async function() {
    const myName = window.userDoc ? window.userDoc.username : '';
    if (!myName) return;

    try {
        const snap = await getDocs(collection(db_fire, 'challenges'));
        const pending = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.to === myName && data.status === 'pending') pending.push(data);
        });

        if (pending.length === 0) return;

        // Inject challenge banner above rank card on dashboard
        const mainScreen = document.getElementById('main-s');
        const rankCard   = mainScreen.querySelector('.rank-card');

        // Remove any old banners first
        mainScreen.querySelectorAll('.challenge-banner').forEach(b => b.remove());

        pending.forEach(c => {
            const banner = document.createElement('div');
            banner.className = 'challenge-banner';
            banner.innerHTML =
                '<div class="challenge-banner-title">⚔️ New Challenge!</div>' +
                '<p><b>' + c.from + '</b> challenged you on <b>' + c.topic + '</b> — beat their score of <b>' + c.score + ' pts!</b></p>' +
                '<button class="btn primary sm" style="margin-top:10px; width:auto; padding:8px 16px;" onclick="showShare()">View Challenge</button>';
            mainScreen.insertBefore(banner, rankCard);
        });

    } catch (e) {}
};

/* ── Mark challenge as beaten when the challenged player scores higher */
window.fbCheckChallengeBeaten = async function(topic, newScore) {
    const myName = window.userDoc ? window.userDoc.username : '';
    if (!myName) return;

    try {
        const snap = await getDocs(collection(db_fire, 'challenges'));
        snap.forEach(async d => {
            const data = d.data();
            if (data.to === myName && data.topic === topic &&
                data.status === 'accepted' && newScore > data.score) {
                await setDoc(doc(db_fire, 'challenges', d.id), { status: 'beaten' }, { merge: true });
                showToast('You beat ' + data.from + "'s challenge on " + topic + '! 🏆', 'success', 4000);
            }
        });
    } catch (e) {}
};

/* ── Add Challenge button to leaderboard rows ────────────────── */
const _origFbShowLeaderboard = window.fbShowLeaderboard;
window.fbShowLeaderboard = async function() {
    await _origFbShowLeaderboard();

    // Add ⚔️ Challenge button to each ranked player row
    const myName = window.userDoc ? window.userDoc.username : '';
    document.querySelectorAll('.lead-row').forEach(row => {
        const nameSpan = row.querySelector('span');
        if (!nameSpan) return;
        const rowText  = nameSpan.innerText;
        if (rowText.includes('(You)') || rowText.includes('Not Yet')) return;

        // Extract just the username (strip medal/avatar text)
        const parts    = rowText.trim().split(' ');
        const username = parts[parts.length - 1];
        if (!username || username === myName) return;

        const btn = document.createElement('button');
        btn.className   = 'challenge-btn';
        btn.innerText   = '⚔️';
        btn.title       = 'Challenge ' + username;
        btn.onclick     = (e) => {
            e.stopPropagation();
            currentSsc = '';
            document.getElementById('challenge-topic').innerText = 'General';
            document.getElementById('challenge-modal').classList.remove('hidden');
            window.fbLoadChallengeablePlayers('General');
        };
        row.appendChild(btn);
    });
};

/* ── Hook into fbShowMain to check for challenges ────────────── */
const _origFbShowMain = window.fbShowMain;
window.fbShowMain = async function() {
    await _origFbShowMain();
    await window.fbCheckIncomingChallenges();
};

/* ── Hook into fbSaveHighScore to check if challenge beaten ──── */
const _origFbSaveHighScore = window.fbSaveHighScore;
window.fbSaveHighScore = async function(s) {
    await _origFbSaveHighScore(s);
    const topic = currentSsc || currentSub || currentCat || '';
    if (topic) await window.fbCheckChallengeBeaten(topic, s);
};

/* ── Ensure invite code is generated on register ─────────────── */
const _origFbRegister = window.fbRegister;
window.fbRegister = async function() {
    // We patch saveUserDoc to add invite code after user is created
    const _origSave = window.saveUserDoc;
    window.saveUserDoc = async function() {
        if (window.userDoc && !window.userDoc.inviteCode && window.userDoc._uid) {
            window.userDoc.inviteCode  = await generateInviteCode(window.userDoc.username || 'USER');
            window.userDoc.inviteCount = 0;
            window.userDoc.invitedBy   = null;
        }
        await _origSave();
        window.saveUserDoc = _origSave; // restore
    };
    await _origFbRegister();
};

/* ================================================================
   SHARING — Generate unique invite code on register
   ================================================================ */
function generateInviteCode(username) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + suffix;
}

/* ================================================================
   SHARING — Show Share Screen
   ================================================================ */
window.fbShowShare = async function() {
    hideAll();
    document.getElementById('share-s').classList.remove('hidden');

    const d    = window.userDoc || {};
    const code = d.inviteCode || '——';
    document.getElementById('invite-code-display').innerText = code;
    document.getElementById('share-link-display').innerText  =
        'ovieofDelta.github.io/OvieOfDelta_website';

    await window.fbLoadChallenges();
};

/* ================================================================
   SHARING — Load all challenges for current user
   ================================================================ */
window.fbLoadChallenges = async function() {
    const list  = document.getElementById('challenges-list');
    const myName = window.userDoc ? window.userDoc.username : '';
    if (!myName) return;

    try {
        const snap = await getDocs(collection(db_fire, 'challenges'));
        const all  = [];
        snap.forEach(d => {
            const ch = d.data();
            ch._id = d.id;
            if (ch.from === myName || ch.to === myName) all.push(ch);
        });

        list.innerHTML = '';

        if (all.length === 0) {
            list.innerHTML = '<p style="color:var(--muted); font-size:0.9rem; text-align:center; padding:10px;">No active challenges yet.<br>Finish a quiz and challenge a friend! ⚔️</p>';
            return;
        }

        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        all.forEach(ch => {
            const isIncoming = ch.to === myName;
            const card = document.createElement('div');
            card.className = 'challenge-card' + (isIncoming ? ' incoming' : '');

            let statusBadge = '';
            if (ch.status === 'pending') statusBadge = '<span class="ch-badge pending">⏳ Pending</span>';
            else if (ch.status === 'beaten') statusBadge = '<span class="ch-badge beaten">🏆 Beaten!</span>';
            else if (ch.status === 'expired') statusBadge = '<span class="ch-badge expired">💨 Expired</span>';

            if (isIncoming) {
                card.innerHTML =
                    '<div class="ch-header">' + statusBadge + '<span class="ch-tag incoming-tag">INCOMING</span></div>' +
                    '<b>' + ch.from + '</b> challenges you on <b>' + ch.topic + '</b><br>' +
                    '<span style="color:var(--danger); font-weight:800;">Beat their score: ' + ch.score + '</span>' +
                    (ch.status === 'pending'
                        ? '<button class="btn primary sm" style="margin-top:10px; width:100%;" onclick="acceptChallenge(\'' + ch._id + '\',\'' + ch.from + '\',\'' + ch.topic + '\',\'' + ch.cat + '\',\'' + ch.sub + '\',\'' + ch.ssc + '\')">⚔️ Accept &amp; Play</button>'
                        : '');
            } else {
                card.innerHTML =
                    '<div class="ch-header">' + statusBadge + '<span class="ch-tag outgoing-tag">OUTGOING</span></div>' +
                    'You challenged <b>' + ch.to + '</b> on <b>' + ch.topic + '</b><br>' +
                    '<span style="color:var(--muted); font-size:0.85rem;">Your score: ' + ch.score + '</span>';
            }

            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = '<p style="color:var(--danger); font-size:0.85rem; text-align:center;">Could not load challenges.</p>';
    }
};

/* ================================================================
   SHARING — Show challenge modal (pick a player to challenge)
   ================================================================ */
window.fbShowChallengeModal = async function() {
    const myName = window.userDoc ? window.userDoc.username : '';
    const topic  = window.currentSsc || window.currentSub || '';
    const cat    = window.currentCat || '';
    const sub    = window.currentSub || '';
    const ssc    = window.currentSsc || '';
    const score  = window.score || 0;

    if (!topic) {
        showToast('Finish a quiz first to challenge someone!', 'error');
        return;
    }

    // Build player list from Firestore
    try {
        const snap    = await getDocs(collection(db_fire, 'users'));
        const players = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.username && data.username !== myName) players.push(data.username);
        });

        if (players.length === 0) {
            showToast('No other players registered yet.', 'info');
            return;
        }

        // Build modal
        let existing = document.getElementById('challenge-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id    = 'challenge-modal';
        modal.className = 'challenge-modal-overlay';
        modal.innerHTML =
            '<div class="challenge-modal-box">' +
                '<h3>⚔️ Challenge a Friend</h3>' +
                '<p style="color:var(--muted); font-size:0.85rem; margin-bottom:14px;">Topic: <b>' + topic + '</b> · Your score: <b>' + score + '</b></p>' +
                '<label class="field-label">Choose a player</label>' +
                '<select id="challenge-target" style="margin-bottom:14px;">' +
                    players.map(p => '<option value="' + p + '">' + p + '</option>').join('') +
                '</select>' +
                '<button class="btn primary" onclick="window.fbSendChallenge(\'' + cat + '\',\'' + sub + '\',\'' + ssc + '\',' + score + ')">Send Challenge ⚔️</button>' +
                '<button class="btn secondary" style="margin-top:8px;" onclick="document.getElementById(\'challenge-modal\').remove()">Cancel</button>' +
            '</div>';

        document.body.appendChild(modal);

    } catch (err) {
        showToast('Could not load players.', 'error');
    }
};

/* ================================================================
   SHARING — Send a challenge
   ================================================================ */
window.fbSendChallenge = async function(cat, sub, ssc, score) {
    const myName = window.userDoc ? window.userDoc.username : '';
    const target = document.getElementById('challenge-target')?.value;
    if (!target) return;

    const topic = ssc || sub || cat;

    try {
        const chalId = myName + '_' + target + '_' + Date.now();
        await setDoc(doc(db_fire, 'challenges', chalId), {
            from:      myName,
            to:        target,
            topic,
            cat,
            sub,
            ssc,
            score,
            status:    'pending',
            createdAt: Date.now()
        });

        document.getElementById('challenge-modal')?.remove();
        showToast('Challenge sent to ' + target + '! ⚔️', 'success', 3500);

    } catch (err) {
        showToast('Could not send challenge.', 'error');
    }
};

/* ================================================================
   SHARING — Accept a challenge (launches the quiz on that topic)
   ================================================================ */
window.acceptChallenge = function(chalId, from, topic, cat, sub, ssc) {
    window._activeChallengeId = chalId;
    window._activeChallengeFrom = from;
    window._activeChallengeScore = null; // will be set in endQuiz via fbCheckChallengeResult
    showToast('Starting challenge vs ' + from + '! Good luck! ⚔️', 'info', 2500);
    setTimeout(() => startQuiz(cat, sub, ssc), 600);
};

/* ================================================================
   SHARING — After quiz, check if active challenge was beaten
   ================================================================ */
window.fbCheckChallengeResult = async function(finalScore) {
    const chalId = window._activeChallengeId;
    if (!chalId) return;

    const myName = window.userDoc ? window.userDoc.username : '';

    try {
        const snap = await getDoc(doc(db_fire, 'challenges', chalId));
        if (!snap.exists()) return;
        const ch = snap.data();

        if (finalScore > ch.score) {
            // Beaten — update status
            await setDoc(doc(db_fire, 'challenges', chalId), { ...ch, status: 'beaten', beatenBy: myName, beatenScore: finalScore });
            showToast('You beat the challenge! 🏆 ' + ch.from + ' will be notified.', 'success', 4000);

            // Leave a notification on the challenger's userDoc
            const challengerSnap = await getDocs(collection(db_fire, 'users'));
            challengerSnap.forEach(async d => {
                if (d.data().username === ch.from) {
                    const cData = d.data();
                    const notifs = cData.notifications || [];
                    notifs.unshift({
                        msg: myName + ' beat your challenge on ' + ch.topic + '! (' + finalScore + ' vs ' + ch.score + ')',
                        seen: false,
                        ts:   Date.now()
                    });
                    await setDoc(doc(db_fire, 'users', d.id), { ...cData, notifications: notifs.slice(0, 10) });
                }
            });
        } else {
            showToast('Good try! You didn\'t beat ' + ch.from + '\'s score of ' + ch.score + ' this time.', 'info', 4000);
        }
    } catch (err) {
        // silently fail — don't disrupt the results screen
    }

    window._activeChallengeId   = null;
    window._activeChallengeFrom = null;
};

/* ================================================================
   SHARING — Load challenge notifications on dashboard
   ================================================================ */
window.fbLoadChallengeBanner = async function() {
    const myName = window.userDoc ? window.userDoc.username : '';
    const banner = document.getElementById('challenge-banner');
    if (!banner || !myName) return;

    try {
        // Pending incoming challenges
        const snap    = await getDocs(collection(db_fire, 'challenges'));
        const pending = [];
        snap.forEach(d => {
            const ch = d.data();
            if (ch.to === myName && ch.status === 'pending') pending.push(ch);
        });

        // Unseen notifications
        const notifs = (window.userDoc.notifications || []).filter(n => !n.seen);

        if (pending.length === 0 && notifs.length === 0) {
            banner.classList.add('hidden');
            return;
        }

        banner.classList.remove('hidden');
        banner.innerHTML = '';

        notifs.forEach(n => {
            const el = document.createElement('div');
            el.className = 'challenge-notif';
            el.innerHTML = '🏆 ' + n.msg;
            banner.appendChild(el);
        });

        if (pending.length > 0) {
            const el = document.createElement('div');
            el.className = 'challenge-notif incoming-notif';
            el.innerHTML =
                '⚔️ You have <b>' + pending.length + '</b> pending challenge' + (pending.length > 1 ? 's' : '') + '! ' +
                '<button class="btn primary sm" style="margin-left:8px;" onclick="showShare()">View →</button>';
            banner.appendChild(el);
        }

    } catch (err) { /* silent */ }
};
