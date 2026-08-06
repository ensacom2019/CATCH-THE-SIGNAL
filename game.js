import {
  getCurrentProfile,
  getLeaderboard,
  observeAuth,
  saveBestScore,
  signInWithGoogle,
  signOutUser,
} from './firebase.js';

const scoreEl = document.querySelector('#score');
const comboEl = document.querySelector('#combo');
const timeEl = document.querySelector('#time');
const targetLayerEl = document.querySelector('#targetLayer');
const arenaEl = document.querySelector('#arena');
const feedbackEl = document.querySelector('#feedback');
const comboStampEl = document.querySelector('#comboStamp');
const impactLayerEl = document.querySelector('#impactLayer');
const statusEl = document.querySelector('#statusText');
const timingTextEl = document.querySelector('#timingText');
const roundTextEl = document.querySelector('#roundText');
const comboBlockEl = document.querySelector('#comboBlock');
const comboMultiplierEl = document.querySelector('#comboMultiplier');
const startOverlayEl = document.querySelector('#startOverlay');
const endOverlayEl = document.querySelector('#endOverlay');
const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');
restartButton.innerHTML = 'RUN AGAIN <span>GO</span>';
const finalScoreEl = document.querySelector('#finalScore');
const resultTextEl = document.querySelector('#resultText');
const nicknameInput = document.querySelector('#nicknameInput');
const googleSignInButton = document.querySelector('#googleSignInButton');
const submitScoreButton = document.querySelector('#submitScoreButton');
const submitStatusEl = document.querySelector('#submitStatus');
const leaderboardListEl = document.querySelector('#leaderboardList');
const leaderboardStateEl = document.querySelector('#leaderboardState');
const refreshLeaderboardButton = document.querySelector('#refreshLeaderboardButton');

const GAME_SECONDS = 48;
const BEST_KEY = 'nan-signal-hunt-best';
let gameState = 'idle';
let score = 0;
let combo = 0;
let timeLeft = GAME_SECONDS;
let round = 0;
let nextNumber = 1;
let roundSize = 0;
let roundActive = false;
let beatTimer = null;
let nextRoundTimer = null;
let targets = new Map();
let bestComboThisRun = 0;
let currentUser = null;

const bestScore = () => Number(localStorage.getItem(BEST_KEY) || 0);
const formatScore = (value) => String(value).padStart(6, '0');
const getComboMultiplier = (value) => value >= 20 ? 3 : value >= 10 ? 2 : value >= 5 ? 1.5 : 1;

function setSubmitStatus(message, kind = '') {
  submitStatusEl.textContent = message;
  submitStatusEl.className = `submit-status ${kind}`;
}

function renderLeaderboard(entries) {
  leaderboardListEl.replaceChildren();
  if (!entries.length) {
    leaderboardStateEl.textContent = 'NO RECORDS YET / BE THE FIRST';
    return;
  }

  leaderboardStateEl.textContent = `LIVE BOARD / TOP ${entries.length}`;
  entries.forEach((entry) => {
    const row = document.createElement('li');
    row.className = 'leaderboard-entry';
    row.innerHTML = `
      <span class="leaderboard-rank">${String(entry.rank).padStart(2, '0')}</span>
      <span class="leaderboard-name"></span>
      <span class="leaderboard-score">${formatScore(entry.score)}</span>
      <span class="leaderboard-combo">x${entry.combo || 0}</span>
    `;
    row.querySelector('.leaderboard-name').textContent = entry.nickname || 'UNKNOWN HUNTER';
    leaderboardListEl.append(row);
  });
}

async function refreshLeaderboard() {
  leaderboardStateEl.textContent = 'SCANNING RECORDS...';
  try {
    renderLeaderboard(await getLeaderboard());
  } catch (error) {
    console.error(error);
    leaderboardStateEl.textContent = 'RANKING OFFLINE / CHECK FIRESTORE SETUP';
  }
}

async function updateSignedInState(user) {
  currentUser = user;
  submitScoreButton.disabled = !user;
  googleSignInButton.textContent = user ? 'SIGN OUT GOOGLE' : 'SIGN IN WITH GOOGLE';
  if (!user) {
    nicknameInput.value = '';
    setSubmitStatus('GOOGLE LOGIN REQUIRED TO SUBMIT');
    return;
  }

  try {
    const profile = await getCurrentProfile();
    if (profile?.nickname) nicknameInput.value = profile.nickname;
    setSubmitStatus('GOOGLE USER READY TO SUBMIT', 'ready');
  } catch (error) {
    console.error(error);
    setSubmitStatus('LOGIN OK / PROFILE LOAD FAILED', 'error');
  }
}

async function handleGoogleButton() {
  googleSignInButton.disabled = true;
  try {
    if (currentUser) await signOutUser();
    else await signInWithGoogle();
  } catch (error) {
    console.error(error);
    setSubmitStatus(error.code === 'auth/popup-closed-by-user' ? 'LOGIN CANCELLED' : 'GOOGLE LOGIN FAILED', 'error');
  } finally {
    googleSignInButton.disabled = false;
  }
}

async function handleSubmitScore() {
  if (!currentUser) {
    setSubmitStatus('GOOGLE LOGIN REQUIRED TO SUBMIT', 'error');
    return;
  }

  submitScoreButton.disabled = true;
  setSubmitStatus('UPLOADING RUN...');
  try {
    const result = await saveBestScore({ nickname: nicknameInput.value, score, combo: bestComboThisRun });
    setSubmitStatus(result.isBetter ? 'NEW PERSONAL RECORD UPLOADED' : 'PERSONAL BEST KEPT', 'ready');
    await refreshLeaderboard();
  } catch (error) {
    console.error(error);
    const message = error.message === 'NICKNAME_REQUIRED' ? 'NICKNAME MUST BE 2-16 CHARACTERS' : 'UPLOAD FAILED / TRY AGAIN';
    setSubmitStatus(message, 'error');
  } finally {
    submitScoreButton.disabled = false;
  }
}

function renderHud() {
  scoreEl.textContent = formatScore(score);
  comboEl.textContent = `x${combo}`;
  comboMultiplierEl.textContent = `${getComboMultiplier(combo).toFixed(1)}x SCORE`;
  timeEl.textContent = String(timeLeft).padStart(2, '0');
  comboBlockEl.classList.toggle('is-hot', combo >= 5);
  comboBlockEl.classList.toggle('is-fever', combo >= 10);
  comboBlockEl.classList.toggle('is-legend', combo >= 20);
}

function showFeedback(message, kind, anchor = null) {
  if (anchor) {
    const arenaRect = arenaEl.getBoundingClientRect();
    const targetRect = anchor.getBoundingClientRect();
    const x = ((targetRect.left + targetRect.width / 2 - arenaRect.left) / arenaRect.width) * 100;
    const y = ((targetRect.top + targetRect.height / 2 - arenaRect.top) / arenaRect.height) * 100;
    feedbackEl.style.left = `${Math.min(88, Math.max(12, x))}%`;
    feedbackEl.style.top = `${Math.min(82, Math.max(18, y))}%`;
  } else {
    feedbackEl.style.left = '50%';
    feedbackEl.style.top = '51%';
  }
  feedbackEl.className = `feedback ${kind}`;
  feedbackEl.textContent = message;
  requestAnimationFrame(() => feedbackEl.classList.add('show'));
  window.setTimeout(() => { feedbackEl.className = 'feedback'; }, 800);
}

function showComboStamp(message) {
  comboStampEl.className = 'combo-stamp';
  comboStampEl.textContent = message;
  requestAnimationFrame(() => comboStampEl.classList.add('show'));
  window.setTimeout(() => { comboStampEl.className = 'combo-stamp'; }, 850);
}

function spawnImpact(anchor, color = 'var(--blue)') {
  if (!anchor?.getBoundingClientRect) return;
  const arenaRect = arenaEl.getBoundingClientRect();
  const targetRect = anchor.getBoundingClientRect();
  const burst = document.createElement('div');
  const x = targetRect.left + targetRect.width / 2 - arenaRect.left;
  const y = targetRect.top + targetRect.height / 2 - arenaRect.top;
  burst.className = 'impact-burst';
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  burst.style.setProperty('--impact-color', color);
  const particleCount = combo >= 10 ? 14 : combo >= 5 ? 11 : 8;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement('span');
    particle.className = 'impact-particle';
    particle.style.setProperty('--angle', `${index * (360 / particleCount) + (combo * 7 % 20)}deg`);
    particle.style.setProperty('--travel', `${24 + Math.min(combo, 20) * 1.5}px`);
    burst.append(particle);
  }
  impactLayerEl.append(burst);
  arenaEl.classList.remove('impact-flash');
  requestAnimationFrame(() => arenaEl.classList.add('impact-flash'));
  window.setTimeout(() => burst.remove(), 560);
  window.setTimeout(() => arenaEl.classList.remove('impact-flash'), 220);
}

function updateRoundReadout() {
  timingTextEl.textContent = `NEXT SIGNAL ${nextNumber}`;
  roundTextEl.textContent = `ROUND ${String(round).padStart(2, '0')} / ${roundSize}${timeLeft <= 25 ? ' + TRAP' : ''}`;
}

function clearTargets() {
  targetLayerEl.replaceChildren();
  targets.clear();
}

function isFarEnough(candidate, positions) {
  return positions.every((position) => Math.hypot(candidate.x - position.x, candidate.y - position.y) > 92);
}

function createTarget(number, position, isGreen) {
  const target = document.createElement('button');
  target.type = 'button';
  target.className = `target${isGreen ? ' is-green' : ''}`;
  target.dataset.number = String(number);
  target.setAttribute('aria-label', `${number}踰??좏샇`);
  target.style.left = `${position.x}px`;
  target.style.top = `${position.y}px`;
  target.innerHTML = `<span class="target-core"></span><span class="target-ring target-ring-one"></span><span class="target-ring target-ring-two"></span><span class="target-number">${number}</span>`;
  target.addEventListener('click', (event) => {
    event.stopPropagation();
    handleTargetClick(target);
  });
  targetLayerEl.append(target);
  targets.set(number, target);
}

function createTrap(position) {
  const trap = document.createElement('button');
  trap.type = 'button';
  trap.className = 'target is-trap';
  trap.dataset.trap = 'true';
  trap.setAttribute('aria-label', '?⑥젙 ?좏샇');
  trap.style.left = `${position.x}px`;
  trap.style.top = `${position.y}px`;
  trap.innerHTML = '<span class="target-core"></span><span class="target-ring target-ring-one"></span><span class="target-ring target-ring-two"></span><span class="target-number target-trap-mark">횞</span>';
  trap.addEventListener('click', (event) => {
    event.stopPropagation();
    handleTrapClick(trap);
  });
  targetLayerEl.append(trap);
}

function getRandomPosition(rect, positions) {
  const padding = 70;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = {
      x: padding + Math.random() * Math.max(1, rect.width - padding * 2),
      y: padding + Math.random() * Math.max(1, rect.height - padding * 2),
    };
    if (isFarEnough(candidate, positions) || attempt === 79) return candidate;
  }
  return { x: rect.width / 2, y: rect.height / 2 };
}

function spawnTrapIfNeeded() {
  if (gameState !== 'running' || !roundActive || timeLeft > 25 || targetLayerEl.querySelector('.is-trap')) return;
  const rect = arenaEl.getBoundingClientRect();
  const positions = [...targetLayerEl.querySelectorAll('.target:not(.is-trap)')].map((target) => ({
    x: Number.parseFloat(target.style.left) || rect.width / 2,
    y: Number.parseFloat(target.style.top) || rect.height / 2,
  }));
  const trapCount = 1 + Math.floor(Math.random() * 2);
  for (let index = 0; index < trapCount; index += 1) {
    const trapPosition = getRandomPosition(rect, positions);
    positions.push(trapPosition);
    createTrap(trapPosition);
  }
  updateRoundReadout();
  statusEl.textContent = 'TRAP ACTIVE / ORDER LOCKED';
}

function spawnRound() {
  if (gameState !== 'running') return;
  clearTargets();
  round += 1;
  roundSize = 1 + Math.floor(Math.random() * 5);
  nextNumber = 1;
  roundActive = true;
  const rect = arenaEl.getBoundingClientRect();
  const positions = [];
  for (let number = 1; number <= roundSize; number += 1) {
    const candidate = getRandomPosition(rect, positions);
    positions.push(candidate);
    createTarget(number, candidate, number % 2 === 0);
  }
  spawnTrapIfNeeded();
  updateRoundReadout();
  statusEl.textContent = timeLeft <= 25 ? 'TRAP ACTIVE / ORDER LOCKED' : `ROUND ${String(round).padStart(2, '0')} / ORDER LOCKED`;
}

function registerWrongOrder(target) {
  combo = 0;
  statusEl.textContent = `ORDER ERROR / CLICK ${nextNumber}`;
  showFeedback(`NEED ${nextNumber}`, 'miss', target.nodeType ? target : null);
  target.classList.remove('is-miss');
  requestAnimationFrame(() => target.classList.add('is-miss'));
  window.setTimeout(() => target.classList.remove('is-miss'), 220);
  renderHud();
}

function completeRound(lastTarget) {
  roundActive = false;
  const multiplier = getComboMultiplier(combo);
  const bonus = Math.round((100 + Math.min(round, 12) * 10) * multiplier);
  score += bonus;
  statusEl.textContent = `ROUND ${String(round).padStart(2, '0')} CLEAR / NEXT SET`;
  showFeedback(`SET CLEAR +${bonus}`, 'perfect', lastTarget);
  spawnImpact(lastTarget, 'var(--orange)');
  renderHud();
  nextRoundTimer = window.setTimeout(spawnRound, 420);
}

function handleTrapClick(trap) {
  if (gameState !== 'running' || trap.disabled) return;
  trap.disabled = true;
  combo = 0;
  score = Math.max(0, score - 100);
  statusEl.textContent = 'TRAP HIT / COMBO RESET';
  showFeedback('TRAP -100', 'miss', trap);
  spawnImpact(trap, 'var(--red-trap)');
  trap.classList.add('is-trap-hit');
  window.setTimeout(() => trap.remove(), 320);
  renderHud();
}

function handleTargetClick(target) {
  if (gameState !== 'running' || !roundActive) return;
  const number = Number(target.dataset.number);
  if (number !== nextNumber) {
    registerWrongOrder(target);
    return;
  }

  target.classList.add('is-hit');
  target.disabled = true;
  combo += 1;
  bestComboThisRun = Math.max(bestComboThisRun, combo);
  const multiplier = getComboMultiplier(combo);
  const points = Math.round(100 * multiplier);
  score += points;
  nextNumber += 1;
  statusEl.textContent = `SIGNAL ${number} LOCKED / NEXT ${nextNumber <= roundSize ? nextNumber : 'CLEAR'}`;
  showFeedback(`${multiplier > 1 ? `${multiplier}X ` : ''}+${points}`, combo >= 5 ? 'perfect' : 'good', target);
  spawnImpact(target, combo >= 10 ? 'var(--orange)' : 'var(--blue)');
  comboBlockEl.classList.remove('combo-pulse');
  requestAnimationFrame(() => comboBlockEl.classList.add('combo-pulse'));
  if ([5, 10, 20].includes(combo)) {
    showComboStamp(`${combo} COMBO`);
    statusEl.textContent = `${combo} COMBO / ${multiplier}X SCORE`;
  }
  updateRoundReadout();
  renderHud();
  if (nextNumber > roundSize) completeRound(target);
}

function startGame() {
  window.clearInterval(beatTimer);
  window.clearTimeout(nextRoundTimer);
  gameState = 'running';
  score = 0;
  combo = 0;
  bestComboThisRun = 0;
  timeLeft = GAME_SECONDS;
  round = 0;
  nextNumber = 1;
  roundSize = 0;
  roundActive = false;
  impactLayerEl.replaceChildren();
  comboStampEl.className = 'combo-stamp';
  arenaEl.classList.remove('impact-flash');
  startOverlayEl.hidden = true;
  endOverlayEl.hidden = true;
  statusEl.textContent = 'SYSTEM ONLINE / SCANNING';
  renderHud();
  spawnRound();
  beatTimer = window.setInterval(() => {
    timeLeft -= 1;
    renderHud();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  if (gameState !== 'running') return;
  gameState = 'ended';
  roundActive = false;
  window.clearInterval(beatTimer);
  window.clearTimeout(nextRoundTimer);
  clearTargets();
  const previousBest = bestScore();
  if (score > previousBest) localStorage.setItem(BEST_KEY, String(score));
  finalScoreEl.textContent = formatScore(score);
  resultTextEl.textContent = score > previousBest ? 'NEW BEST ???뱀떊??湲곕줉??媛깆떊?먯뒿?덈떎.' : '48珥??숈븞 ?섏쭛???좏샇 湲곕줉?낅땲??';
  statusEl.textContent = 'SYSTEM COMPLETE / GOOD RUN';
  endOverlayEl.hidden = false;
  renderHud();
}

arenaEl.addEventListener('click', (event) => {
  if (gameState === 'running' && !event.target.closest('.target, .start-overlay, .end-overlay')) registerWrongOrder({ classList: { remove() {}, add() {} } });
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && (gameState === 'idle' || gameState === 'ended')) startGame();
});
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
googleSignInButton.addEventListener('click', handleGoogleButton);
submitScoreButton.addEventListener('click', handleSubmitScore);
refreshLeaderboardButton.addEventListener('click', refreshLeaderboard);
observeAuth(updateSignedInState);
refreshLeaderboard();
renderHud();

