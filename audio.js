Exit code: 0
Wall time: 0.2 seconds
Output:
let audioContext = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicTimer = null;
let musicStep = 0;
let audioEnabled = true;

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const musicNotes = [110, 130.81, 164.81, 196, 146.83, 174.61, 220, 164.81];

function ensureAudio() {
  if (!AudioContextClass) return false;
  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    musicGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    masterGain.gain.value = 0.72;
    musicGain.gain.value = 0.42;
    sfxGain.gain.value = 0.9;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return true;
}

function playTone(frequency, duration, type, volume, destination, offset = 0, endFrequency = frequency) {
  if (!audioContext) return;
  const start = audioContext.currentTime + offset;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function scheduleMusicStep() {
  if (!audioEnabled || !audioContext) return;
  const note = musicNotes[musicStep];
  playTone(note, 0.26, 'triangle', 0.045, musicGain);
  if (musicStep % 2 === 0) playTone(note / 2, 0.34, 'sine', 0.025, musicGain, 0.01);
  musicStep = (musicStep + 1) % musicNotes.length;
}

function startMusic() {
  if (!ensureAudio() || musicTimer || !audioEnabled) return;
  scheduleMusicStep();
  musicTimer = window.setInterval(scheduleMusicStep, 300);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = null;
}

export function initAudio() {
  if (!audioEnabled || !ensureAudio()) return false;
  startMusic();
  return true;
}

export function toggleAudio() {
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    startMusic();
    if (audioContext?.state === 'suspended') audioContext.resume();
  } else {
    stopMusic();
    if (audioContext?.state === 'running') audioContext.suspend();
  }
  return audioEnabled;
}

export function playSfx(kind, intensity = 0) {
  if (!audioEnabled || !ensureAudio()) return;
  if (kind === 'hit') {
    const pitch = 520 + Math.min(intensity, 20) * 14;
    playTone(pitch, 0.08, 'sine', 0.075, sfxGain);
    playTone(pitch * 1.5, 0.13, 'triangle', 0.035, sfxGain, 0.018);
  } else if (kind === 'miss') {
    playTone(180, 0.18, 'sawtooth', 0.07, sfxGain, 0, 78);
  } else if (kind === 'trap') {
    playTone(130, 0.28, 'square', 0.08, sfxGain, 0, 55);
    playTone(72, 0.34, 'sawtooth', 0.045, sfxGain, 0.02, 42);
  } else if (kind === 'start') {
    [220, 330, 440].forEach((note, index) => playTone(note, 0.12, 'triangle', 0.06, sfxGain, index * 0.08));
  } else if (kind === 'clear') {
    [440, 554.37, 659.25, 880].forEach((note, index) => playTone(note, 0.14, 'sine', 0.055, sfxGain, index * 0.07));
  } else if (kind === 'end') {
    [440, 349.23, 261.63].forEach((note, index) => playTone(note, 0.2, 'triangle', 0.05, sfxGain, index * 0.12));
  }
}
