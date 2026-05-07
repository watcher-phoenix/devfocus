import { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuickCapture } from '../api/workItems';

export default function QuickCapture({ open, onClose }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);
  const capture = useQuickCapture();

  useEffect(() => {
    if (open) {
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          // We need to open via parent — but we can still handle it
          document.dispatchEvent(new CustomEvent('devfocus:quick-capture'));
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await capture.mutateAsync({ title: title.trim() });
    setTitle('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'background.paper', backgroundImage: 'none', borderRadius: 3 },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Quick capture — just type and hit Enter
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            inputRef={inputRef}
            fullWidth
            placeholder="What's on your mind?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="outlined"
            autoComplete="off"
            sx={{
              '& .MuiOutlinedInput-root': { fontSize: '1.1rem' },
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
