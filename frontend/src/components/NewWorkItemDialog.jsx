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
import { useStatuses } from '../api/statuses';
import EmojiButton from './EmojiButton';

const TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'review', label: 'Review' },
  { value: 'pr-review', label: 'PR Review' },
  { value: 'support', label: 'Weekend Support' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITIES = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
];

export default function NewWorkItemDialog({ open, onClose, defaultStatus = 'active' }) {
  const { data: projects = [] } = useProjects();
  const { data: statusConfigs = [] } = useStatuses();
  const STATUSES = statusConfigs.filter((s) => !s.isCompletion).map((s) => ({ value: s.key, label: s.label }));
  const createItem = useCreateWorkItem();
  const defaultForm = {
    title: '',
    description: '',
    notes: '',
    type: 'task',
    priority: 0,
    status: defaultStatus,
    projectId: '',
    scheduledDate: '',
    dueDate: '',
    externalId: '',
    externalUrl: '',
    recurrenceRule: '',
  };
  const [form, setForm] = useState(defaultForm);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await createItem.mutateAsync({
      ...form,
      projectId: form.projectId || null,
      scheduledDate: form.scheduledDate || null,
      dueDate: form.dueDate || null,
      externalId: form.externalId || null,
      externalUrl: form.externalUrl || null,
      recurrenceRule: form.recurrenceRule || null,
    });
    setForm({ ...defaultForm });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Work Item</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            fullWidth
            autoFocus
          />
          <EmojiButton onSelect={(emoji) => setForm({ ...form, title: form.title + emoji })} />
        </Stack>
        <TextField
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          fullWidth
          multiline
          rows={2}
        />
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={form.status}
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
              value={form.type}
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
              value={form.priority}
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
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Scheduled date"
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <FormControl fullWidth>
          <InputLabel>Recurrence</InputLabel>
          <Select
            value={form.recurrenceRule}
            label="Recurrence"
            onChange={(e) => setForm({ ...form, recurrenceRule: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="biweekly">Biweekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Ticket ID (optional)"
          value={form.externalId}
          onChange={(e) => setForm({ ...form, externalId: e.target.value })}
          fullWidth
          placeholder="e.g. PROJ-1234"
        />
        <TextField
          label="Ticket URL (optional)"
          value={form.externalUrl}
          onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
          fullWidth
          placeholder="https://yourcompany.atlassian.net/browse/PROJ-1234"
        />
        <TextField
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          fullWidth
          multiline
          rows={3}
        />
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
