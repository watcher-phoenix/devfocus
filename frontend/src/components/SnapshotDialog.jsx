import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { useProjects } from '../api/projects';
import { useCreateSnapshot, useUpdateSnapshot } from '../api/snapshots';

export default function SnapshotDialog({ open, onClose, editSnapshot }) {
  const { data: projects = [] } = useProjects();
  const createSnapshot = useCreateSnapshot();
  const updateSnapshot = useUpdateSnapshot();
  const [form, setForm] = useState({ projectId: '', summary: '', nextSteps: '', branch: '' });

  useEffect(() => {
    if (editSnapshot) {
      setForm({
        projectId: editSnapshot.projectId || '',
        summary: editSnapshot.summary || '',
        nextSteps: editSnapshot.nextSteps || '',
        branch: editSnapshot.branch || '',
      });
    } else {
      setForm({ projectId: '', summary: '', nextSteps: '', branch: '' });
    }
  }, [editSnapshot, open]);

  const handleSave = async () => {
    if (!form.projectId || !form.summary.trim()) return;
    if (editSnapshot) {
      await updateSnapshot.mutateAsync({ id: editSnapshot.id, ...form });
    } else {
      await createSnapshot.mutateAsync(form);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editSnapshot ? 'Update Snapshot' : 'New Context Snapshot'}</DialogTitle>
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
          placeholder={"- Finish the API route\n- Write tests\n- Update the docs"}
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
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!form.projectId || !form.summary.trim()}
        >
          {editSnapshot ? 'Update' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
