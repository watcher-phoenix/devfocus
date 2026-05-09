import { useState, useEffect, useRef, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const CONFETTI_COLORS = ['#7C4DFF', '#00E5FF', '#FFD600', '#FF5722', '#00C853', '#FF9100'];

export function spawnConfetti() {
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
    '%cPro tip: There are secret key combos. Good luck finding them all.',
    'color: #00E5FF; font-size: 11px;'
  );
}

// Key combos: sequence of keys → { message, severity }
const KEY_COMBOS = [
  {
    keys: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
    message: 'Achievement unlocked: Knows the Konami code. Impressive and useless.',
    severity: 'success',
  },
  {
    // "ship" — s h i p
    keys: ['s', 'h', 'i', 'p'],
    message: 'Ship it! LGTM, no review needed. (Please actually review it.)',
    severity: 'info',
  },
  {
    // "yolo" — y o l o
    keys: ['y', 'o', 'l', 'o'],
    message: 'git push --force --no-verify. Just kidding. Or am I?',
    severity: 'warning',
  },
  {
    // "lgtm" — l g t m
    keys: ['l', 'g', 't', 'm'],
    message: 'Looks Good To Me. Didn\'t even read it.',
    severity: 'success',
  },
  {
    // "help" — h e l p
    keys: ['h', 'e', 'l', 'p'],
    message: 'Have you tried asking Clippy? He\'s standing right there.',
    severity: 'info',
  },
  {
    // "404" — 4 0 4
    keys: ['4', '0', '4'],
    message: 'Productivity not found.',
    severity: 'error',
  },
  {
    // "sudo" — s u d o
    keys: ['s', 'u', 'd', 'o'],
    message: 'Permission granted. You now have root access to... nothing extra.',
    severity: 'warning',
  },
  {
    // "nope" — n o p e
    keys: ['n', 'o', 'p', 'e'],
    message: 'Understandable. Have a nice day.',
    severity: 'info',
  },
  {
    // "rage" — r a g e
    keys: ['r', 'a', 'g', 'e'],
    message: 'Deep breaths. The code can smell your fear.',
    severity: 'error',
  },
  {
    // "tgif" — t g i f
    keys: ['t', 'g', 'i', 'f'],
    message: 'Thank God It\'s... wait, is it actually Friday? Either way, you earned this.',
    severity: 'success',
  },
  {
    // "bug" — b u g
    keys: ['b', 'u', 'g'],
    message: 'It\'s not a bug, it\'s a surprise feature. Confetti for your troubles.',
    severity: 'warning',
  },
  {
    // "coffee" — c o f f e e
    keys: ['c', 'o', 'f', 'f', 'e', 'e'],
    message: 'Deploying caffeine... estimated arrival: now. Go get some.',
    severity: 'success',
  },
];

const RAGE_MESSAGES = [
  'Clicking harder won\'t make it faster.',
  'Easy there, speed racer.',
  'That button has feelings, you know.',
  'Have you tried... not rage clicking?',
  'The button is doing its best.',
];

export default function DevEasterEggs() {
  const [comboMsg, setComboMsg] = useState(null);
  const [rageMsg, setRageMsg] = useState('');
  const keyBuffer = useRef([]);
  const keyTimer = useRef(null);
  const clickTracker = useRef({ count: 0, timer: null });

  // Multi-combo key listener
  useEffect(() => {
    logConsoleEasterEggs();

    const handleKey = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      keyBuffer.current.push(e.key);
      // Keep buffer to longest combo length
      if (keyBuffer.current.length > 12) keyBuffer.current.shift();

      // Reset buffer after inactivity
      if (keyTimer.current) clearTimeout(keyTimer.current);
      keyTimer.current = setTimeout(() => { keyBuffer.current = []; }, 2000);

      // Check all combos
      const buf = keyBuffer.current;
      for (const combo of KEY_COMBOS) {
        const { keys } = combo;
        if (buf.length >= keys.length) {
          const tail = buf.slice(buf.length - keys.length);
          if (tail.every((k, i) => k === keys[i])) {
            keyBuffer.current = [];
            spawnConfetti();
            setComboMsg({ text: combo.message, severity: combo.severity });
            break;
          }
        }
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
        open={!!comboMsg}
        autoHideDuration={4000}
        onClose={() => setComboMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={comboMsg?.severity || 'success'} variant="filled" onClose={() => setComboMsg(null)}>
          {comboMsg?.text}
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
