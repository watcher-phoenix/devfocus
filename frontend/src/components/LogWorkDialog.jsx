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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import dayjs from 'dayjs';
import { useProjects } from '../api/projects';
import { useLogWork } from '../api/activity';

const TYPE_LABELS = {
  task: 'Task',
  ticket: 'Ticket',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  'pr-review': 'PR Review',
  jira: 'Jira',
  pr: 'PR',
  support: 'Weekend Support',
};

export default function LogWorkDialog({ open, onClose }) {
  const { data: projects = [] } = useProjects();
  const logWork = useLogWork();

  const defaultForm = {
    title: '',
    description: '',
    notes: '',
    type: 'task',
    priority: 0,
    projectId: '',
    ticketId: '',
    ticketUrl: '',
    scheduledDate: '',
    dueDate: '',
    date: dayjs().format('YYYY-MM-DD'),
    afterHours: false,
  };
  const [form, setForm] = useState(defaultForm);

  const handleLog = async () => {
    if (!form.title.trim()) return;
    await logWork.mutateAsync({
      ...form,
      projectId: form.projectId || null,
      ticketId: form.ticketId || null,
    });
    setForm({ ...defaultForm, date: dayjs().format('YYYY-MM-DD') });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Log Completed Work</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          label="What did you work on?"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          fullWidth
          autoFocus
          placeholder="e.g. Fixed pagination bug on contacts page"
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
          <TextField
            label="Ticket ID (optional)"
            value={form.ticketId}
            onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
            fullWidth
            placeholder="e.g. PROJ-1234"
          />
          <TextField
            label="Ticket URL (optional)"
            value={form.ticketUrl}
            onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
            fullWidth
            placeholder="https://yourcompany.atlassian.net/browse/PROJ-1234"
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={form.type}
              label="Type"
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
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
              <MenuItem value={0}>None</MenuItem>
              <MenuItem value={1}>Low</MenuItem>
              <MenuItem value={2}>Medium</MenuItem>
              <MenuItem value={3}>High</MenuItem>
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
            label="Completed on"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
        <TextField
          label="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          fullWidth
          multiline
          rows={2}
        />
        <FormControlLabel
          control={<Checkbox checked={form.afterHours} onChange={(e) => setForm({ ...form, afterHours: e.target.checked })} />}
          label="After hours work"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleLog} disabled={!form.title.trim()}>
          Log It
        </Button>
      </DialogActions>
    </Dialog>
  );
}
