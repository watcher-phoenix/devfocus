import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import { api } from '../api/client';

function ClippyIcon({ size = 24, animate = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes clippy-idle {
          0%, 80%, 100% { transform: translateY(0) rotate(0deg); }
          10% { transform: translateY(-2px) rotate(-2deg); }
          20% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-1px) rotate(1deg); }
          40% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes clippy-blink {
          0%, 90%, 95%, 100% { transform: scaleY(1); }
          92% { transform: scaleY(0.1); }
        }
        @keyframes clippy-look {
          0%, 40%, 100% { transform: translateX(0); }
          50% { transform: translateX(1.5px); }
          70% { transform: translateX(-1px); }
        }
        @keyframes clippy-wave {
          0%, 70%, 100% { transform: rotate(0deg); }
          75% { transform: rotate(-8deg); }
          80% { transform: rotate(8deg); }
          85% { transform: rotate(-5deg); }
          90% { transform: rotate(0deg); }
        }
        .clippy-body { animation: ${animate ? 'clippy-idle 4s ease-in-out infinite, clippy-wave 6s ease-in-out infinite' : 'none'}; transform-origin: center bottom; }
        .clippy-eyes { animation: ${animate ? 'clippy-blink 4s ease-in-out infinite' : 'none'}; transform-origin: center center; }
        .clippy-pupils { animation: ${animate ? 'clippy-look 5s ease-in-out infinite' : 'none'}; }
      `}</style>
      <g className="clippy-body">
        {/* Paperclip body - outer */}
        <path d="M32 4C22 4 15 12 15 22V48C15 55 20 60 28 60C36 60 41 55 41 48V22C41 16 38 12 32 12C26 12 23 16 23 22V44" stroke="#777" strokeWidth="6" strokeLinecap="round" fill="none"/>
        {/* Paperclip body - inner highlight */}
        <path d="M32 4C22 4 15 12 15 22V48C15 55 20 60 28 60C36 60 41 55 41 48V22C41 16 38 12 32 12C26 12 23 16 23 22V44" stroke="#B8B8B8" strokeWidth="4" strokeLinecap="round" fill="none"/>
        {/* Shine */}
        <path d="M32 4C22 4 15 12 15 22V48C15 55 20 60 28 60" stroke="#D4D4D4" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>

        <g className="clippy-eyes">
          {/* Left eye white */}
          <ellipse cx="27" cy="27" rx="5" ry="5.5" fill="white"/>
          {/* Right eye white */}
          <ellipse cx="37" cy="27" rx="5" ry="5.5" fill="white"/>
        </g>

        <g className="clippy-pupils">
          {/* Left pupil */}
          <circle cx="28" cy="27.5" r="2.5" fill="#333"/>
          <circle cx="29" cy="26.5" r="1" fill="white" opacity="0.8"/>
          {/* Right pupil */}
          <circle cx="38" cy="27.5" r="2.5" fill="#333"/>
          <circle cx="39" cy="26.5" r="1" fill="white" opacity="0.8"/>
        </g>

        {/* Eyebrow left */}
        <path d="M23 21C25 18 28 18 30 20" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Eyebrow right */}
        <path d="M34 20C36 18 39 18 41 21" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Smile */}
        <path d="M28 33C30 35 34 35 36 33" stroke="#555" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </g>
    </svg>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "It looks like you're trying to be productive! I'm Clippy, your DevFocus assistant. Ask me anything — like \"what is Brain Dump?\" or \"how do I plan my week?\" I'm here to help!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/chat', { message: userMsg });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer, source: res.source }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: "Oops! Something went wrong on my end. Give it another try — I'm not going anywhere!" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Clippy toggle button */}
      {!open && (
        <Box
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            top: 8,
            right: 16,
            zIndex: 1200,
            cursor: 'pointer',
            filter: 'drop-shadow(0 2px 8px rgba(255,214,0,0.5))',
            transition: 'transform 0.2s, filter 0.2s',
            '&:hover': { transform: 'scale(1.1)', filter: 'drop-shadow(0 4px 12px rgba(255,214,0,0.7))' },
          }}
        >
          <ClippyIcon size={100} animate />
        </Box>
      )}

      {/* Chat panel */}
      <Slide direction="left" in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            top: 60,
            right: 24,
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ClippyIcon size={20} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#FFD600' }}>Clippy</Typography>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)}>
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
