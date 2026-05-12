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
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { useProjects } from '../api/projects';
import { useUpdateWorkItem, useDeleteWorkItem } from '../api/workItems';
import { useStatuses } from '../api/statuses';
import EmojiButton from './EmojiButton';

const TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'review', label: 'Review' },
  { value: 'pr-review', label: 'PR Review' },
  { value: 'jira', label: 'Jira' },
  { value: 'pr', label: 'PR' },
  { value: 'support', label: 'Weekend Support' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITIES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
];

export default function WorkItemDialog({ item, open, onClose }) {
  const { data: projects = [] } = useProjects();
  const { data: statusConfigs = [] } = useStatuses();
  const STATUSES = statusConfigs.map((s) => ({ value: s.key, label: s.label }));
  const completionKeys = new Set(statusConfigs.filter((s) => s.isCompletion).map((s) => s.key));
  const updateItem = useUpdateWorkItem();
  const deleteItem = useDeleteWorkItem();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || '',
        description: item.description || '',
        notes: item.notes || '',
        status: item.status || 'inbox',
        type: item.type || 'task',
        priority: item.priority ?? 0,
        projectId: item.projectId || '',
        scheduledDate: item.scheduledDate || '',
        dueDate: item.dueDate || '',
        externalId: item.externalId || '',
        externalUrl: item.externalUrl || '',
        afterHours: item.afterHours || false,
      });
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    const payload = {
      id: item.id,
      ...form,
      projectId: form.projectId || null,
      scheduledDate: form.scheduledDate || null,
      dueDate: form.dueDate || null,
      externalId: form.externalId || null,
      externalUrl: form.externalUrl || null,
    };
    delete payload.afterHours;

    // If status is done, always set completedAt based on afterHours toggle
    if (completionKeys.has(form.status)) {
      const dateStr = form.scheduledDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      if (form.afterHours) {
        payload.completedAt = new Date(dateStr + 'T18:00:00');
      } else {
        // Use existing time if it was already during hours, otherwise reset to noon
        if (item.afterHours || !item.completedAt) {
          payload.completedAt = new Date(dateStr + 'T12:00:00');
        }
      }
    }

    await updateItem.mutateAsync(payload);
    onClose();
  };

  const handleDelete = async () => {
    await deleteItem.mutateAsync(item.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Work Item</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Title"
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            fullWidth
          />
          <EmojiButton onSelect={(emoji) => setForm({ ...form, title: (form.title || '') + emoji })} />
        </Stack>
        <TextField
          label="Description"
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          fullWidth
          multiline
          rows={2}
        />
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={form.status || 'inbox'}
              label="Status"
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={form.type || 'task'}
              label="Type"
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={form.priority ?? 0}
              label="Priority"
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={form.projectId || ''}
              label="Project"
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Scheduled date"
            type="date"
            value={form.scheduledDate || ''}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Due date"
            type="date"
            value={form.dueDate || ''}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <TextField
          label="Ticket ID (optional)"
          value={form.externalId || ''}
          onChange={(e) => setForm({ ...form, externalId: e.target.value })}
          fullWidth
          placeholder="e.g. PROJ-1234"
        />
        <TextField
          label="Notes"
          value={form.notes || ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          fullWidth
          multiline
          rows={3}
        />
        {completionKeys.has(form.status) && (
          <FormControlLabel
            control={<Checkbox checked={form.afterHours || false} onChange={(e) => setForm({ ...form, afterHours: e.target.checked })} />}
            label={(form.afterHours || false) ? 'After hours work (working late again?)' : 'After hours work'}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Button color="error" onClick={handleDelete}>
          Delete
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title?.trim()}>
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
