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

function ClippyIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Paperclip body */}
      <path d="M32 8C24 8 18 14 18 22V46C18 52 22 56 28 56C34 56 38 52 38 46V22C38 18 36 16 32 16C28 16 26 18 26 22V42" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" fill="none"/>
      {/* Left eye */}
      <circle cx="28" cy="28" r="3.5" fill="white"/>
      <circle cx="29" cy="28" r="2" fill="#333"/>
      {/* Right eye */}
      <circle cx="36" cy="28" r="3.5" fill="white"/>
      <circle cx="37" cy="28" r="2" fill="#333"/>
      {/* Eyebrow left */}
      <path d="M25 24C26 22 28 22 30 23" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Eyebrow right */}
      <path d="M34 23C36 22 38 22 39 24" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
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
        <Fab
          size="medium"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            top: 16,
            right: 24,
            bgcolor: '#FFD600',
            color: '#333',
            zIndex: 1200,
            '&:hover': { bgcolor: '#FFC107' },
          }}
        >
          <ClippyIcon size={28} />
        </Fab>
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
