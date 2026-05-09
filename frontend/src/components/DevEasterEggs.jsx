import { useState, useEffect, useRef, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const CONFETTI_COLORS = ['#7C4DFF', '#00E5FF', '#FFD600', '#FF5722', '#00C853', '#FF9100'];

function spawnConfetti() {
  const count = 120;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;overflow:hidden';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 6;
    const rotation = Math.random() * 360;
    piece.style.cssText = `
      position:absolute;left:${left}%;top:-20px;width:${size}px;height:${size * 0.6}px;
      background:${color};transform:rotate(${rotation}deg);
      animation:confettiFall ${1.5 + Math.random()}s ease-in ${delay}s forwards;
    `;
    container.appendChild(piece);
  }

  // Inject animation if not present
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => container.remove(), 3000);
}

// Console easter eggs — shown once on first load
function logConsoleEasterEggs() {
  if (window.__devfocusConsoleLogged) return;
  window.__devfocusConsoleLogged = true;

  console.log(
    '%c DevFocus ',
    'background: #7C4DFF; color: white; font-size: 20px; font-weight: bold; padding: 4px 12px; border-radius: 4px;'
  );
  console.log(
    '%cYou opened DevTools. Bold of you to debug a productivity app instead of being productive.',
    'color: #9AA0A6; font-style: italic; font-size: 12px;'
  );
  console.log(
    '%cPro tip: Try the Konami code.',
    'color: #00E5FF; font-size: 11px;'
  );
}

const RAGE_MESSAGES = [
  'Clicking harder won\'t make it faster.',
  'Easy there, speed racer.',
  'That button has feelings, you know.',
  'Have you tried... not rage clicking?',
  'The button is doing its best.',
];

export default function DevEasterEggs() {
  const [konamiMsg, setKonamiMsg] = useState('');
  const [rageMsg, setRageMsg] = useState('');
  const konamiIdx = useRef(0);
  const clickTracker = useRef({ count: 0, timer: null });

  // Konami code listener
  useEffect(() => {
    logConsoleEasterEggs();

    const handleKey = (e) => {
      if (e.key === KONAMI[konamiIdx.current]) {
        konamiIdx.current++;
        if (konamiIdx.current === KONAMI.length) {
          konamiIdx.current = 0;
          spawnConfetti();
          setKonamiMsg('Achievement unlocked: Knows the Konami code. Impressive and useless.');
        }
      } else {
        konamiIdx.current = 0;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Tab title trolling
  useEffect(() => {
    const originalTitle = document.title;
    const awayMessages = [
      'Come back! Your tasks miss you.',
      'Slacking off, are we?',
      'Your backlog is growing...',
      'Alt+Tab won\'t finish your tasks.',
      'The bugs are multiplying while you\'re gone.',
    ];

    const handleVisibility = () => {
      if (document.hidden) {
        document.title = awayMessages[Math.floor(Math.random() * awayMessages.length)];
      } else {
        document.title = originalTitle;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.title = originalTitle;
    };
  }, []);

  // Rage click detector
  const handleGlobalClick = useCallback(() => {
    const tracker = clickTracker.current;
    tracker.count++;
    if (tracker.timer) clearTimeout(tracker.timer);
    tracker.timer = setTimeout(() => { tracker.count = 0; }, 800);

    if (tracker.count >= 5) {
      tracker.count = 0;
      setRageMsg(RAGE_MESSAGES[Math.floor(Math.random() * RAGE_MESSAGES.length)]);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [handleGlobalClick]);

  return (
    <>
      <Snackbar
        open={!!konamiMsg}
        autoHideDuration={4000}
        onClose={() => setKonamiMsg('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setKonamiMsg('')}>
          {konamiMsg}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!rageMsg}
        autoHideDuration={3000}
        onClose={() => setRageMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setRageMsg('')}>
          {rageMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
