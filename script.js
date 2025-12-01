// ==================== FIREBASE SETUP ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAw8Ufc7CE9FYAlKPyi39rjguaMrda7yrU",
  authDomain: "dogs-giveaway.firebaseapp.com",
  databaseURL: "https://dogs-giveaway-default-rtdb.firebaseio.com",
  projectId: "dogs-giveaway",
  storageBucket: "dogs-giveaway.firebasestorage.app",
  messagingSenderId: "998374517562",
  appId: "1:998374517562:web:b17e34afbbb0a14ba8be03",
  measurementId: "G-QFJGE5750C"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==================== STATE VARIABLES ====================
let userId = 'NOT_APP';
let adsWatched = 0;
let target = 1000;
let session = '1';
let prizePool = '$10000';
let coinName = 'DOGS';
let isPlaying = false;
let globalWatched = 0;
let leaderboard = [];
let coinBalance = 0;
let withdrawalMethod = 'binance';
let binanceId = '';
let xrocketUsername = '';
let totalReferred = 0;
let bonusAds = 0;
let minWithdrawal = 100;

// Separate countdown intervals for each ad network
let libtlCountdownInterval = null;
let gigaCountdownInterval = null;

// Ad SDK status tracking
let gigaPubReady = false;
let libtlReady = false;

// ==================== GLOBAL FUNCTIONS ====================
window.copyID = copyID;
window.showPage = showPage;
window.withdraw = withdraw;
window.saveWithdrawalInfo = saveWithdrawalInfo;
window.selectWithdrawalMethod = selectWithdrawalMethod;
window.copyRefLink = copyRefLink;

// ==================== AD SDK INITIALIZATION ====================
function initializeAdSDKs() {
  // Check LibTL availability
  const checkLibTL = setInterval(() => {
    if (typeof window.show_10262019 === 'function') {
      libtlReady = true;
      console.log('✅ LibTL SDK ready');
      clearInterval(checkLibTL);
    }
  }, 500);

  setTimeout(() => {
    clearInterval(checkLibTL);
    if (!libtlReady) {
      console.warn('⚠️ LibTL SDK failed to load');
    }
  }, 10000);

  // Check GigaPub availability
  const checkGigaPub = setInterval(() => {
    if (typeof window.showGiga === 'function') {
      gigaPubReady = true;
      console.log('✅ GigaPub SDK ready');
      clearInterval(checkGigaPub);
    }
  }, 500);

  setTimeout(() => {
    clearInterval(checkGigaPub);
    if (!gigaPubReady) {
      console.warn('⚠️ GigaPub SDK failed to load');
    }
  }, 10000);
}

// ==================== COUNTDOWN TIMERS (SEPARATE FOR EACH AD) ====================
function startLibTLCountdown(seconds, onComplete) {
  let remaining = seconds;
  const btn = document.getElementById('libtlAdBtn');
  
  btn.disabled = true;
  
  const updateCountdown = () => {
    if (remaining <= 0) {
      clearInterval(libtlCountdownInterval);
      libtlCountdownInterval = null;
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#ffffff"></polygon></svg>
        <span>LibTL +1</span>
      `;
      if (onComplete) onComplete();
      return;
    }
    
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#ffffff" stroke-width="2"/></svg>
      <span>${remaining}s</span>
    `;
    remaining--;
  };
  
  updateCountdown();
  libtlCountdownInterval = setInterval(updateCountdown, 1000);
}

function startGigaCountdown(seconds, onComplete) {
  let remaining = seconds;
  const btn = document.getElementById('gigaAdBtn');
  
  btn.disabled = true;
  
  const updateCountdown = () => {
    if (remaining <= 0) {
      clearInterval(gigaCountdownInterval);
      gigaCountdownInterval = null;
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#ffffff"></polygon></svg>
        <span>Giga +2</span>
      `;
      if (onComplete) onComplete();
      return;
    }
    
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#ffffff" stroke-width="2"/></svg>
      <span>${remaining}s</span>
    `;
    remaining--;
  };
  
  updateCountdown();
  gigaCountdownInterval = setInterval(updateCountdown, 1000);
}

// ==================== PRIZE DISTRIBUTION (TOP 10 ONLY) ====================
const PRIZE_RULES = {
  1: 25,    // 🥇 1st: 25%
  2: 15,    // 🥈 2nd: 15%
  3: 12,    // 🥉 3rd: 12%
  4: 10,    // 4th: 10%
  5: 8,     // 5th: 8%
  6: 7,     // 6th: 7%
  7: 6,     // 7th: 6%
  8: 6,     // 8th: 6%
  9: 6,     // 9th: 6%
  10: 5     // 10th: 5%
};

function getPrizePercentage(rank) {
  return PRIZE_RULES[rank] || 0;
}

// ==================== SESSION END & PRIZE DISTRIBUTION ====================
async function endCurrentSession(currentSession, prizePoolAmount, topUsers) {
  const winnersPath = `session${currentSession}_winners`;
  const prizesPath = `session${currentSession}_prizes`;
  const resetAdsUpdates = {};

  const winnersUpdates = {};
  const prizesUpdates = {};

  // 🏆 TOP 10 KO HI PRIZES MILENGE
  const top10 = topUsers.slice(0, 10);
  
  for (let i = 0; i < top10.length; i++) {
    const user = top10[i];
    const rank = i + 1;
    const pct = getPrizePercentage(rank);
    
    if (pct > 0) {
      winnersUpdates[user.userId] = rank;
      const prize = (prizePoolAmount * pct) / 100;
      prizesUpdates[user.userId] = parseFloat(prize.toFixed(2));

      // User ke coin balance me prize add karo
      const balanceRef = ref(db, `users/${user.userId}/CoinBalance`);
      const balanceSnap = await get(balanceRef);
      const current = balanceSnap.exists() ? balanceSnap.val() : 0;
      await set(balanceRef, parseFloat((current + prize).toFixed(2)));
    }
  }

  // 🔁 SABHI USERS KE ADS RESET KARO (0 SET KARO)
  for (const user of topUsers) {
    resetAdsUpdates[`users/${user.userId}/AdsWatched`] = 0;
  }

  // Final batch update - Atomic operation
  await update(ref(db), {
    [winnersPath]: winnersUpdates,
    [prizesPath]: prizesUpdates,
    session: (parseInt(currentSession) + 1).toString(),
    session_ended: null,
    ...resetAdsUpdates
  });

  console.log(`✅ Session ${currentSession} khatam! Top 10 ko prizes mile. Sabhi ads reset.`);
}

async function checkAndEndSessionIfComplete() {
  if (globalWatched >= target) {
    const lockRef = ref(db, 'session_ended');
    const snap = await get(lockRef);
    
    if (!snap.exists()) {
      await set(lockRef, true);

      const dbSnap = await get(ref(db, 'users'));
      let users = [];
      
      if (dbSnap.exists()) {
        const raw = dbSnap.val();
        users = Object.entries(raw).map(([uid, data]) => ({
          userId: uid,
          ads: data.AdsWatched || 0
        }));
      }

      users.sort((a, b) => b.ads - a.ads);
      const prizeNum = parseFloat(prizePool.replace(/[^0-9.]/g, '')) || 10000;

      await endCurrentSession(session, prizeNum, users);
      showToast(`🎉 Session ${session} khatam! Prizes distribute ho gaye. Naya session load ho raha...`);
      setTimeout(() => window.location.reload(), 3000);
    }
  }
}

// ==================== REFERRAL SYSTEM ====================
function generateRefLink() {
  return `https://t.me/DogsGiveaway_bot/Dgiveaway?startapp=${userId}`;
}

async function loadReferralData() {
  const refRef = ref(db, `referrals/${userId}`);
  const snap = await get(refRef);
  
  if (snap.exists()) {
    const data = snap.val();
    totalReferred = data.totalReferred || 0;
    bonusAds = data.bonusAds || 0;
  } else {
    totalReferred = 0;
    bonusAds = 0;
  }
  
  updateReferralUI();
}

async function processReferral(referrerId, newUserId) {
  if (!referrerId || !newUserId || referrerId === newUserId) return;

  // Check agar pehle se reward mila hai
  const recordRef = ref(db, `referrals/${referrerId}/referred/${newUserId}`);
  const recordSnap = await get(recordRef);
  if (recordSnap.exists()) return;

  // New user ne kam se kam 1 ad dekha ho
  const newUserRef = ref(db, `users/${newUserId}`);
  const newUserSnap = await get(newUserRef);
  if (!newUserSnap.exists() || (newUserSnap.val().AdsWatched || 0) < 1) return;

  // Referrer ko 10 bonus ads do
  const referrerUserRef = ref(db, `users/${referrerId}`);
  const refSnap = await get(referrerUserRef);
  
  if (refSnap.exists()) {
    const currentAds = refSnap.val().AdsWatched || 0;
    await update(referrerUserRef, { AdsWatched: currentAds + 10 });
  }

  // Referral stats update karo
  const refStatsRef = ref(db, `referrals/${referrerId}`);
  const statsSnap = await get(refStatsRef);
  const currentStats = statsSnap.exists() ? statsSnap.val() : { totalReferred: 0, bonusAds: 0 };
  
  await update(refStatsRef, {
    totalReferred: (currentStats.totalReferred || 0) + 1,
    bonusAds: (currentStats.bonusAds || 0) + 10
  });

  // Mark as processed
  await set(recordRef, { timestamp: Date.now() });
  console.log(`✅ Referral processed: ${newUserId} → ${referrerId} (+10 ads)`);
}

function getReferrerFromUrl() {
  // Telegram WebApp start parameter check
  if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
    return window.Telegram.WebApp.initDataUnsafe.start_param;
  }
  
  // URL path check
  const pathParts = window.location.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && lastPart.startsWith('TG_')) {
    return lastPart;
  }
  
  // URL query parameter check
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ref') || urlParams.get('startapp');
}

// ==================== FIREBASE DATA LOAD & SAVE ====================
async function loadFromFirebase() {
  const dbRef = ref(db);
  const snapshot = await get(dbRef);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    session = data.session || '1';
    target = data.Target || 1000;
    prizePool = data.price_pool || '$10000';
    coinName = data.coin || 'DOGS';
    minWithdrawal = data.minimum_withdrawal || 100;

    // UI update karo
    document.getElementById('prizePoolDisplay').textContent = prizePool;
    document.getElementById('coinNameDisplay').textContent = coinName;
    document.getElementById('coinBalanceLabel').textContent = coinName;
    document.getElementById('sessionDisplay').textContent = `(Session: ${session})`;
    document.getElementById('target').textContent = target;
    document.getElementById('minWithdrawDisplay').textContent = `${minWithdrawal} ${coinName}`;

    const users = data.users || {};
    const userEntry = users[userId];
    
    adsWatched = userEntry ? userEntry.AdsWatched || 0 : 0;
    coinBalance = userEntry ? userEntry.CoinBalance || 0 : 0;
    binanceId = userEntry ? userEntry.BinanceId || '' : '';
    xrocketUsername = userEntry ? userEntry.XRocketUsername || '' : '';
    withdrawalMethod = userEntry ? userEntry.WithdrawalMethod || 'binance' : 'binance';

    document.getElementById('adsview').textContent = adsWatched;
    document.getElementById('balanceDisplay').textContent = `${coinBalance.toFixed(2)} ${coinName}`;
    
    // Withdrawal info load karo
    const binanceInput = document.getElementById('binanceIdInput');
    const xrocketInput = document.getElementById('xrocketUsernameInput');
    if (binanceInput && binanceId) binanceInput.value = binanceId;
    if (xrocketInput && xrocketUsername) xrocketInput.value = xrocketUsername;
    
    selectWithdrawalMethod(withdrawalMethod);

    // Leaderboard data
    leaderboard = Object.entries(users).map(([uid, info]) => ({
      userId: uid,
      ads: info.AdsWatched || 0
    }));
    
    globalWatched = leaderboard.reduce((sum, u) => sum + u.ads, 0);
    await loadReferralData();
    
  } else {
    // Initial setup agar data nahi hai
    await set(ref(db, 'session'), '1');
    await set(ref(db, 'Target'), 1000);
    await set(ref(db, 'price_pool'), '$10000');
    await set(ref(db, 'coin'), 'DOGS');
    await set(ref(db, 'minimum_withdrawal'), 100);
  }
}

function saveUserAds() {
  set(ref(db, `users/${userId}/AdsWatched`), adsWatched);
}

// ==================== REALTIME LISTENERS ====================
function setupRealtimeListeners() {
  // Target listener
  onValue(ref(db, 'Target'), (s) => {
    if (s.exists()) {
      target = s.val();
      document.getElementById('target').textContent = target;
      updateDisplay();
    }
  });

  // Session listener
  onValue(ref(db, 'session'), (s) => {
    if (s.exists()) {
      const newSession = s.val();
      if (newSession !== session) {
        session = newSession;
        document.getElementById('sessionDisplay').textContent = `(Session: ${session})`;
        showToast(`🎊 Naya session shuru: ${session}`);
      }
    }
  });

  // Prize pool listener
  onValue(ref(db, 'price_pool'), (s) => {
    if (s.exists()) {
      prizePool = s.val();
      document.getElementById('prizePoolDisplay').textContent = prizePool;
    }
  });

  // Coin name listener
  onValue(ref(db, 'coin'), (s) => {
    if (s.exists()) {
      coinName = s.val();
      document.getElementById('coinNameDisplay').textContent = coinName;
      document.getElementById('coinBalanceLabel').textContent = coinName;
      document.getElementById('minWithdrawDisplay').textContent = `${minWithdrawal} ${coinName}`;
      document.getElementById('balanceDisplay').textContent = `${coinBalance.toFixed(2)} ${coinName}`;
    }
  });

  // Min withdrawal listener
  onValue(ref(db, 'minimum_withdrawal'), (s) => {
    if (s.exists()) {
      minWithdrawal = s.val();
      document.getElementById('minWithdrawDisplay').textContent = `${minWithdrawal} ${coinName}`;
    }
  });

  // Users listener (realtime updates)
  onValue(ref(db, 'users'), (s) => {
    if (s.exists()) {
      const users = s.val();
      leaderboard = Object.entries(users).map(([uid, info]) => ({
        userId: uid,
        ads: info.AdsWatched || 0
      }));
      
      globalWatched = leaderboard.reduce((sum, u) => sum + u.ads, 0);
      
      const userEntry = users[userId];
      if (userEntry) {
        // Balance update
        const newBalance = userEntry.CoinBalance || 0;
        if (newBalance !== coinBalance) {
          coinBalance = newBalance;
          document.getElementById('balanceDisplay').textContent = `${coinBalance.toFixed(2)} ${coinName}`;
        }
        
        // Binance ID update
        const newBinanceId = userEntry.BinanceId || '';
        if (newBinanceId !== binanceId) {
          binanceId = newBinanceId;
          const binanceInput = document.getElementById('binanceIdInput');
          if (binanceInput) binanceInput.value = binanceId;
        }
        
        // xRocket username update
        const newXRocket = userEntry.XRocketUsername || '';
        if (newXRocket !== xrocketUsername) {
          xrocketUsername = newXRocket;
          const xrocketInput = document.getElementById('xrocketUsernameInput');
          if (xrocketInput) xrocketInput.value = xrocketUsername;
        }
      }
      
      updateDisplay();
      updateYouPage();
      
      if (document.getElementById('rankPage').classList.contains('active')) {
        updateLeaderboard();
      }
      if (document.getElementById('referPage').classList.contains('active')) {
        updateReferralUI();
      }
    }
  });
}

// ==================== UI HELPER FUNCTIONS ====================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function copyID() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(userId).then(() => showToast('✅ User ID copy ho gaya!'));
  } else {
    showToast('User ID: ' + userId);
  }
}

function copyRefLink() {
  const link = generateRefLink();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => showToast('✅ Invite link copy ho gaya!'));
  } else {
    showToast('Link: ' + link);
  }
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  if (page === 'win') {
    document.getElementById('winPage').classList.add('active');
    document.querySelectorAll('.nav-item')[0].classList.add('active');
  } else if (page === 'you') {
    document.getElementById('youPage').classList.add('active');
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    updateYouPage();
  } else if (page === 'rank') {
    document.getElementById('rankPage').classList.add('active');
    document.querySelectorAll('.nav-item')[2].classList.add('active');
    updateLeaderboard();
  } else if (page === 'refer') {
    document.getElementById('referPage').classList.add('active');
    document.querySelectorAll('.nav-item')[3].classList.add('active');
    updateReferralUI();
  }
}

function updateDisplay() {
  const remaining = Math.max(target - globalWatched, 0);
  document.getElementById('remaining').textContent = remaining;
  document.getElementById('watched').textContent = globalWatched;
  
  const progressPercent = Math.min((globalWatched / target) * 100, 100);
  document.getElementById('progress').style.width = `${progressPercent}%`;
}

function updateYouPage() {
  document.getElementById('youAdsWatched').textContent = adsWatched;
  
  const total = globalWatched || 1;
  const prob = (adsWatched / total) * 100;
  document.getElementById('probability').textContent = `${Math.min(prob, 100).toFixed(1)}%`;
  document.getElementById('probFill').style.width = `${Math.min(prob, 100)}%`;
  
  const rank = leaderboard.filter(u => u.ads > adsWatched).length + 1;
  document.getElementById('globalRank').textContent = rank;
}

function updateReferralUI() {
  document.getElementById('totalReferred').textContent = totalReferred;
  document.getElementById('bonusAds').textContent = bonusAds;
  document.getElementById('refLinkInput').value = generateRefLink();
}

function updateLeaderboard() {
  const list = document.getElementById('rankList');
  list.innerHTML = '';
  
  const sortedUsers = [...leaderboard].sort((a, b) => b.ads - a.ads).slice(0, 20);
  
  sortedUsers.forEach((user, i) => {
    const total = globalWatched || 1;
    const prob = ((user.ads / total) * 100).toFixed(1);
    const isMe = user.userId === userId;
    
    let medalClass = '';
    if (i === 0) medalClass = 'gold';
    else if (i === 1) medalClass = 'silver';
    else if (i === 2) medalClass = 'bronze';
    
    const el = document.createElement('div');
    el.className = `rank-item${isMe ? ' highlight' : ''}`;
    el.innerHTML = `
      <div class="rank-number ${medalClass}">${i + 1}</div>
      <div class="rank-info">
        <div class="rank-name">${user.userId}${isMe ? ' (You)' : ''}</div>
        <div class="rank-stats">Win Probability: ${prob}%</div>
      </div>
      <div class="rank-ads">${user.ads}</div>
    `;
    list.appendChild(el);
  });
}

// ==================== WITHDRAWAL METHOD ====================
function selectWithdrawalMethod(method) {
  withdrawalMethod = method;
  
  // Tabs update
  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-method') === method) {
      tab.classList.add('active');
    }
  });
  
  // Input sections show/hide
  document.getElementById('binanceInput').style.display = method === 'binance' ? 'block' : 'none';
  document.getElementById('xrocketInput').style.display = method === 'xrocket' ? 'block' : 'none';
  
  // Firebase me save karo
  set(ref(db, `users/${userId}/WithdrawalMethod`), method);
}

async function saveWithdrawalInfo(method) {
  if (method === 'binance') {
    const input = document.getElementById('binanceIdInput');
    const id = input.value.trim();
    
    if (!id) return showToast('❌ Binance ID daliye');
    if (id.length < 5) return showToast('❌ Invalid Binance ID');
    
    try {
      await set(ref(db, `users/${userId}/BinanceId`), id);
      binanceId = id;
      showToast('✅ Binance ID save ho gaya!');
    } catch (e) {
      showToast('❌ Save nahi hua');
    }
    
  } else if (method === 'xrocket') {
    const input = document.getElementById('xrocketUsernameInput');
    let username = input.value.trim();
    
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    
    if (!username) return showToast('❌ Telegram username daliye');
    if (username.length < 3) return showToast('❌ Invalid username');
    
    try {
      await set(ref(db, `users/${userId}/XRocketUsername`), username);
      xrocketUsername = username;
      showToast('✅ xRocket username save ho gaya!');
    } catch (e) {
      showToast('❌ Save nahi hua');
    }
  }
}

// ==================== AD PLAYBACK ====================
async function playLibTLAd() {
  return new Promise((resolve, reject) => {
    if (!libtlReady || typeof window.show_10262019 !== 'function') {
      reject(new Error('LibTL SDK ready nahi hai'));
      return;
    }

    try {
      const result = window.show_10262019();
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        setTimeout(resolve, 2000);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function playGigaPubAd() {
  return new Promise((resolve, reject) => {
    if (!gigaPubReady || typeof window.showGiga !== 'function') {
      reject(new Error('GigaPub SDK ready nahi hai'));
      return;
    }

    console.log('🎬 GigaPub ad shuru ho raha...');
    
    window.showGiga()
      .then(() => {
        console.log('✅ GigaPub ad complete');
        resolve();
      })
      .catch(e => {
        console.error('❌ GigaPub ad error:', e);
        reject(e);
      });
  });
}

async function playAd(adType) {
  if (isPlaying) {
    showToast('⏳ Current ad complete hone do');
    return;
  }

  // Specific ad ka countdown check karo
  if (adType === 'LibTL' && libtlCountdownInterval) {
    showToast('⏳ LibTL countdown khatam hone do');
    return;
  }

  if (adType === 'Giga' && gigaCountdownInterval) {
    showToast('⏳ Giga countdown khatam hone do');
    return;
  }

  // SDK readiness check
  if (adType === 'LibTL' && !libtlReady) {
    showToast('⚠️ LibTL ad abhi ready nahi. Wait karo...');
    return;
  }
  
  if (adType === 'Giga' && !gigaPubReady) {
    showToast('⚠️ GigaPub ad abhi ready nahi. Wait karo...');
    return;
  }

  isPlaying = true;
  
  document.getElementById('adScreen').innerHTML = `
    <div style="font-weight:700;font-size:13px;text-align:center;">
      <div style="margin-bottom:10px;">Loading ${adType} Ad...</div>
      <div style="font-size:11px;color:var(--muted);">Please wait</div>
    </div>
  `;

  try {
    let adsToAdd = 1;
    
    if (adType === 'LibTL') {
      await playLibTLAd();
      adsToAdd = 1;
    } else if (adType === 'Giga') {
      await playGigaPubAd();
      adsToAdd = 2;
    }

    // Ad successfully complete
    adsWatched += adsToAdd;
    document.getElementById('adsview').textContent = adsWatched;
    saveUserAds();

    const existing = leaderboard.find(u => u.userId === userId);
    if (existing) existing.ads = adsWatched;
    else leaderboard.push({ userId, ads: adsWatched });

    globalWatched = leaderboard.reduce((sum, u) => sum + u.ads, 0);
    updateDisplay();
    updateYouPage();
    showToast(`✅ Ad dekha gaya! +${adsToAdd} 🎥`);
    
    // Ad screen reset
    document.getElementById('adScreen').innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24">
        <polygon points="6,4 20,12 6,20" fill="#111111"></polygon>
      </svg>
    `;
    
    isPlaying = false;
    
    // Countdown shuru karo
    if (adType === 'LibTL') {
      startLibTLCountdown(10, async () => {
        await checkAndEndSessionIfComplete();
      });
    } else if (adType === 'Giga') {
      startGigaCountdown(10, async () => {
        await checkAndEndSessionIfComplete();
      });
    }

  } catch (error) {
    console.error(`${adType} ad error:`, error);
    showToast(`❌ ${adType} ad fail. Dobara try karo.`);
    
    document.getElementById('adScreen').innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24">
        <polygon points="6,4 20,12 6,20" fill="#111111"></polygon>
      </svg>
    `;
    isPlaying = false;
  }
}

// ==================== WITHDRAWAL FUNCTION ====================
async function withdraw() {
  const MIN = minWithdrawal;
  
  // Withdrawal info saved hai ya nahi check karo
  if (withdrawalMethod === 'binance' && !binanceId) {
    return showToast('❌ Pehle Binance ID save karo');
  }
  
  if (withdrawalMethod === 'xrocket' && !xrocketUsername) {
    return showToast('❌ Pehle Telegram username save karo');
  }
  
  if (coinBalance < MIN) {
    return showToast(`❌ Minimum withdrawal: ${MIN} ${coinName}`);
  }
  
  const withdrawalInfo = withdrawalMethod === 'binance' 
    ? `Binance ID: ${binanceId}` 
    : `xRocket (@${xrocketUsername})`;
  
  if (!confirm(`Withdraw ${coinBalance.toFixed(2)} ${coinName} via ${withdrawalMethod === 'binance' ? 'Binance' : 'xRocket'}?

${withdrawalInfo}

Processing: 24-48h?`)) {
    return;
  }

  try {
    const wid = `${userId}_${Date.now()}`;
    const withdrawalData = {
      userId,
      amount: parseFloat(coinBalance.toFixed(2)),
      coin: coinName,
      method: withdrawalMethod,
      timestamp: Date.now(),
      status: 'pending',
      session,
      dateCreated: new Date().toISOString()
    };
    
    // Method-specific info add karo
    if (withdrawalMethod === 'binance') {
      withdrawalData.binanceId = binanceId;
    } else if (withdrawalMethod === 'xrocket') {
      withdrawalData.xrocketUsername = xrocketUsername;
    }
    
    await set(ref(db, `withdrawals/${wid}`), withdrawalData);
    await set(ref(db, `users/${userId}/CoinBalance`), 0);
    
    coinBalance = 0;
    document.getElementById('balanceDisplay').textContent = `0.00 ${coinName}`;
    showToast('✅ Withdrawal request submit!');
    setTimeout(() => showToast('⏳ Processing: 24-48 hours'), 3000);
    
  } catch (e) {
    console.error('Withdrawal error:', e);
    showToast('❌ Withdrawal fail ho gaya');
  }
}

// ==================== EVENT LISTENERS ====================
document.getElementById('libtlAdBtn').addEventListener('click', () => playAd('LibTL'));
document.getElementById('gigaAdBtn').addEventListener('click', () => playAd('Giga'));

// ==================== INITIALIZATION ====================
async function init() {
  console.log('🚀 DogsGiveaway initialize ho raha...');
  
  // Telegram WebApp integration
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    if (tg.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      userId = `TG_${u.id}`;
    }
  }

  document.getElementById('userIdDisplay').textContent = userId;
  document.getElementById('userIdProfile').textContent = userId;

  // Ad SDKs initialize karo
  initializeAdSDKs();

  // Referral process karo
  const referrerId = getReferrerFromUrl();
  if (referrerId && referrerId !== userId) {
    console.log('Referral process:', referrerId, '→', userId);
    await processReferral(referrerId, userId);
  }

  // Firebase se data load karo
  await loadFromFirebase();
  setupRealtimeListeners();
  updateDisplay();
  updateYouPage();

  console.log('✅ Ready! Session:', session, '| User:', userId);
  console.log('📊 LibTL Ready:', libtlReady, '| GigaPub Ready:', gigaPubReady);
}

// App load hone par init run karo
window.addEventListener('load', init);