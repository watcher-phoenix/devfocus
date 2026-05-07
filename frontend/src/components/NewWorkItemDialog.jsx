import { useState } from 'react';
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
import Stack from '@mui/material/Stack';
import { useProjects } from '../api/projects';
import { useCreateWorkItem } from '../api/workItems';

const TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'review', label: 'Review' },
];

const PRIORITIES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
];

export default function NewWorkItemDialog({ open, onClose, defaultStatus = 'active' }) {
  const { data: projects = [] } = useProjects();
  const createItem = useCreateWorkItem();
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'task',
    priority: 0,
    projectId: '',
    status: defaultStatus,
    scheduledDate: '',
  });

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await createItem.mutateAsync({
      ...form,
      projectId: form.projectId || null,
      scheduledDate: form.scheduledDate || null,
    });
    setForm({
      title: '',
      description: '',
      type: 'task',
      priority: 0,
      projectId: '',
      status: defaultStatus,
      scheduledDate: '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Work Item</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          fullWidth
          autoFocus
        />
        <TextField
          label="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          fullWidth
          multiline
          rows={2}
        />
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={form.type}
              label="Type"
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={form.priority}
              label="Priority"
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={form.projectId}
              label="Project"
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Schedule for"
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
