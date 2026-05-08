import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import { api } from '../api/client';

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "It looks like you're trying to be productive! I'm Clippy, your DevFocus assistant. Ask me anything!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 60, right: 24 });
  const messagesEndRef = useRef(null);
  const agentRef = useRef(null);
  const openRef = useRef(false);

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
        agent.show();
        agent.moveTo(window.innerWidth - 140, 60);
        agent.play('Greeting');
        setAgentReady(true);

        // Make Clippy's DOM element clickable using the agent's internal element
        const clippyEl = agent._el;
        if (clippyEl) {
          clippyEl.style.cursor = 'pointer';
          clippyEl.style.zIndex = '9999';
          clippyEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // Position panel near Clippy
            const rect = clippyEl.getBoundingClientRect();
            const panelWidth = 360;
            const panelHeight = 480;
            let left = rect.left - panelWidth - 10;
            let top = rect.top;
            // Keep on screen
            if (left < 10) left = rect.right + 10;
            if (top + panelHeight > window.innerHeight - 10) top = window.innerHeight - panelHeight - 10;
            if (top < 10) top = 10;
            setPanelPos({ top, left });
            openRef.current = !openRef.current;
            setOpen(openRef.current);
          });
        }
      } catch (err) {
        console.error('Failed to init Clippy:', err);
      }
    })();
    return () => { disposed = true; if (agentRef.current) agentRef.current.dispose(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Make Clippy speak the last assistant message
  useEffect(() => {
    if (!agentRef.current || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      agentRef.current.animate();
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    if (agentRef.current) {
      agentRef.current.play('Searching');
    }

    try {
      const res = await api.post('/chat', { message: userMsg });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer, source: res.source }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: "Oops! Something went wrong on my end. Give it another try!" }]);
    }
    setLoading(false);
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      if (agentRef.current) agentRef.current.play('Wave');
    } else {
      setOpen(true);
      if (agentRef.current) {
        agentRef.current.play('Greeting');
      }
    }
  };

  return (
    <>
      {/* Chat panel */}
      <Slide direction="left" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: 360,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,215,0,0.3)',
            zIndex: 1300,
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,215,0,0.2)', bgcolor: 'rgba(255,215,0,0.05)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FFD600' }}>Clippy</Typography>
            <IconButton size="small" onClick={handleToggle}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>
            {messages.map((msg, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    maxWidth: '85%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: msg.role === 'user' ? 'primary.main' : 'rgba(255,215,0,0.08)',
                    color: msg.role === 'user' ? 'white' : 'text.primary',
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </Typography>
                </Box>
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
                <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: 'rgba(255,215,0,0.08)' }}>
                  <CircularProgress size={16} sx={{ color: '#FFD600' }} />
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(255,215,0,0.2)' }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask Clippy..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                disabled={loading}
              />
              <IconButton type="submit" sx={{ color: '#FFD600' }} disabled={!input.trim() || loading}>
                <SendIcon />
              </IconButton>
            </form>
          </Box>
        </Paper>
      </Slide>
    </>
  );
}
