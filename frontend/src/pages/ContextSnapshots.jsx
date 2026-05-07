import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import { useSnapshots, useCreateSnapshot, useUpdateSnapshot } from '../api/snapshots';
import { useProjects } from '../api/projects';

export default function ContextSnapshots() {
  const { data: snapshots = [] } = useSnapshots({ active: true });
  const { data: projects = [] } = useProjects();
  const createSnapshot = useCreateSnapshot();
  const updateSnapshot = useUpdateSnapshot();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ projectId: '', summary: '', nextSteps: '', branch: '' });

  const openNew = () => {
    setEditId(null);
    setForm({ projectId: '', summary: '', nextSteps: '', branch: '' });
    setDialogOpen(true);
  };

  const openEdit = (snap) => {
    setEditId(snap.id);
    setForm({
      projectId: snap.projectId || '',
      summary: snap.summary || '',
      nextSteps: snap.nextSteps || '',
      branch: snap.branch || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.projectId || !form.summary.trim()) return;
    if (editId) {
      await updateSnapshot.mutateAsync({ id: editId, ...form });
    } else {
      await createSnapshot.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Context Snapshots</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          New Snapshot
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Save where you left off in a project so you can pick it up without losing context.
      </Typography>

      <Stack spacing={2}>
        {snapshots.map((snap) => (
          <Card
            key={snap.id}
            sx={{ cursor: 'pointer', '&:hover': { borderColor: 'rgba(255,255,255,0.15)' } }}
            onClick={() => openEdit(snap)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  label={snap.project?.name || 'No project'}
                  size="small"
                  sx={{
                    bgcolor: (snap.project?.color || '#666') + '22',
                    color: snap.project?.color || '#666',
                    fontWeight: 500,
                  }}
                />
                {snap.branch && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  >
                    {snap.branch}
                  </Typography>
                )}
              </Box>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                {snap.summary}
              </Typography>
              {snap.nextSteps && (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {snap.nextSteps}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Last touched: {new Date(snap.lastTouchedAt).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        ))}
        {snapshots.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No active snapshots. Create one when you stop working on a project to save your context.
          </Typography>
        )}
      </Stack>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Update Snapshot' : 'New Context Snapshot'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={form.projectId}
              label="Project"
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="What were you working on?"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            multiline
            rows={2}
            fullWidth
          />
          <TextField
            label="Next steps"
            value={form.nextSteps}
            onChange={(e) => setForm({ ...form, nextSteps: e.target.value })}
            multiline
            rows={3}
            fullWidth
            placeholder="- Finish the API route&#10;- Write tests&#10;- Update the docs"
          />
          <TextField
            label="Branch name"
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            fullWidth
            placeholder="feature/my-branch"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.projectId || !form.summary.trim()}
          >
            {editId ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
