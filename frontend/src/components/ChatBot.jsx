import { useRef, useEffect, useState } from 'react';

export default function ChatBot() {
  const agentRef = useRef(null);
  const animQueueRef = useRef([]);
  const [agentReady, setAgentReady] = useState(false);

  // Initialize Clippy agent with fly-in entrance
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

        const el = agent._el;
        const landX = window.innerWidth - 140;
        const landY = 200;

        if (el) {
          // Start off-screen to the right and above
          el.style.left = (window.innerWidth + 100) + 'px';
          el.style.top = '-100px';
          el.style.zIndex = '9999';
          el.style.transition = 'left 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';

          // Fly in after a brief delay
          setTimeout(() => {
            el.style.left = landX + 'px';
            el.style.top = landY + 'px';
          }, 100);

          // Remove transition after landing so clippyjs animations aren't affected
          setTimeout(() => {
            el.style.transition = '';
            agent.play('Greeting');
            setAgentReady(true);
          }, 1400);
        } else {
          agent.play('Greeting');
          setAgentReady(true);
        }
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
