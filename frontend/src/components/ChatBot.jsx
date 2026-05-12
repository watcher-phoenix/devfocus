import { useRef, useEffect, useState } from 'react';

export default function ChatBot() {
  const agentRef = useRef(null);
  const animQueueRef = useRef([]);
  const [agentReady, setAgentReady] = useState(false);

  // Initialize Clippy agent
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const { initAgent } = await import('clippyjs');
        const { Clippy } = await import('clippyjs/agents');
        const agent = await initAgent(Clippy);
        if (disposed) { agent.dispose(); return; }
        agentRef.current = agent;
        // Disable Clippy sounds
        if (agent._animator) agent._animator._sounds = {};
        agent.show();
        // Set position directly so the speech bubble renders in the right spot
        const el = agent._el;
        if (el) {
          el.style.left = (window.innerWidth - 140) + 'px';
          el.style.top = '60px';
          el.style.zIndex = '9999';
        }
        agent.play('Greeting');
        setAgentReady(true);
      } catch (err) {
        console.error('Failed to init Clippy:', err);
      }
    })();
    return () => { disposed = true; if (agentRef.current) agentRef.current.dispose(); };
  }, []);

  // Clippy idle animations — shuffle all, play through, reshuffle
  useEffect(() => {
    if (!agentReady || !agentRef.current) return;

    const allAnims = agentRef.current.animations().filter((a) => !a.startsWith('Idle'));
    const shuffle = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    const nextAnim = () => {
      if (animQueueRef.current.length === 0) {
        animQueueRef.current = shuffle(allAnims);
      }
      return animQueueRef.current.pop();
    };
    const IDLE_THOUGHTS = [
      'I wonder if anyone actually reads commit messages...',
      'Should I refactor this? Nah.',
      'Is it lunch yet?',
      'rm -rf node_modules. Fixes everything.',
      'Have you tried turning it off and on again?',
      'I used to live in Word. Now I live in a side project.',
      'This could\'ve been an email.',
      'I bet there\'s a meeting about this.',
      '*stares in paperclip*',
      'git blame... it was me all along.',
    ];
    let thoughtCount = 0;
    const interval = setInterval(() => {
      if (agentRef.current) {
        agentRef.current.stop();
        agentRef.current.play(nextAnim());
        thoughtCount++;
        if (thoughtCount % 3 === 0) {
          const thought = IDLE_THOUGHTS[Math.floor(Math.random() * IDLE_THOUGHTS.length)];
          agentRef.current.speak(thought);
        }
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [agentReady]);

  return null;
}
