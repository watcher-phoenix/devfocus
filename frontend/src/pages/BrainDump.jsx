import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useWorkItems, useQuickCapture, useUpdateWorkItemStatus, useDeleteWorkItem } from '../api/workItems';

export default function BrainDump() {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);
  const { data: items = [], isLoading } = useWorkItems({ status: 'inbox' });
  const capture = useQuickCapture();
  const updateStatus = useUpdateWorkItemStatus();
  const deleteItem = useDeleteWorkItem();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuItemId, setMenuItemId] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await capture.mutateAsync({ title: title.trim() });
    setTitle('');
  };

  const handlePromote = (id) => {
    updateStatus.mutate({ id, status: 'active' });
    setMenuAnchor(null);
  };

  const handleDelete = (id) => {
    deleteItem.mutate(id);
    setMenuAnchor(null);
  };

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Brain Dump
      </Typography>

      {/* Quick capture input */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              inputRef={inputRef}
              fullWidth
              placeholder="Brain dump — type anything and hit Enter"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              autoComplete="off"
              sx={{
                '& .MuiOutlinedInput-root': { fontSize: '1.1rem' },
              }}
            />
          </form>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            No categories, no priority — just get it out of your head.
          </Typography>
        </CardContent>
      </Card>

      {/* Inbox items */}
      <Stack spacing={1}>
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: '12px !important',
                '&:last-child': { pb: '12px !important' },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1">{item.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => handlePromote(item.id)}
                  title="Move to Active"
                >
                  <ArrowForwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    setMenuAnchor(e.currentTarget);
                    setMenuItemId(item.id);
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {!isLoading && items.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            All clear. Nothing to sort.
          </Typography>
        )}
      </Stack>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => handlePromote(menuItemId)}>Move to Active</MenuItem>
        <MenuItem onClick={() => { updateStatus.mutate({ id: menuItemId, status: 'waiting' }); setMenuAnchor(null); }}>
          Move to Waiting
        </MenuItem>
        <MenuItem onClick={() => handleDelete(menuItemId)} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
