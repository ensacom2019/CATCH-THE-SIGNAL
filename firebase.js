import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA7-0W-WZMOP6WDWJcOfA2EvoTdbzTFLkA',
  authDomain: 'signal-b8190.firebaseapp.com',
  projectId: 'signal-b8190',
  storageBucket: 'signal-b8190.firebasestorage.app',
  messagingSenderId: '439851564932',
  appId: '1:439851564932:web:b3979f45cfbd3a75cf27d1',
  measurementId: 'G-7Q26TXHY6P',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export const observeAuth = (callback) => onAuthStateChanged(auth, callback);

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function getCurrentProfile() {
  if (!auth.currentUser) return null;
  const snapshot = await getDoc(doc(db, 'leaderboards', auth.currentUser.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveBestScore({ nickname, score, combo }) {
  if (!auth.currentUser) throw new Error('LOGIN_REQUIRED');

  const cleanNickname = nickname.trim().replace(/[<>]/g, '').slice(0, 16);
  if (cleanNickname.length < 2) throw new Error('NICKNAME_REQUIRED');

  const scoreValue = Math.max(0, Math.floor(Number(score) || 0));
  const comboValue = Math.max(0, Math.floor(Number(combo) || 0));
  const scoreRef = doc(db, 'leaderboards', auth.currentUser.uid);
  const previousSnapshot = await getDoc(scoreRef);
  const previous = previousSnapshot.exists() ? previousSnapshot.data() : null;

  const isBetter = !previous
    || scoreValue > Number(previous.score || 0)
    || (scoreValue === Number(previous.score || 0) && comboValue > Number(previous.combo || 0));

  await setDoc(scoreRef, {
    userId: auth.currentUser.uid,
    nickname: cleanNickname,
    score: isBetter ? scoreValue : Number(previous.score || 0),
    combo: isBetter ? comboValue : Number(previous.combo || 0),
    savedAt: serverTimestamp(),
  }, { merge: true });

  return {
    isBetter,
    score: isBetter ? scoreValue : Number(previous.score || 0),
    combo: isBetter ? comboValue : Number(previous.combo || 0),
  };
}

export async function getLeaderboard(maxEntries = 10) {
  const leaderboardQuery = query(
    collection(db, 'leaderboards'),
    orderBy('score', 'desc'),
    limit(Math.max(maxEntries, 50)),
  );
  const snapshot = await getDocs(leaderboardQuery);
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.combo || 0) - Number(a.combo || 0))
    .slice(0, maxEntries)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

