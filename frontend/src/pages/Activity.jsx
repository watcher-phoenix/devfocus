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
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import dayjs from 'dayjs';
import { useActivity, useLogWork } from '../api/activity';
import { useProjects } from '../api/projects';
import WorkItemDialog from '../components/WorkItemDialog';

const TYPE_LABELS = {
  task: 'Task',
  ticket: 'Ticket',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  jira: 'Jira',
  pr: 'PR',
};

const TYPE_COLORS = {
  ticket: '#2684FF',
  task: '#9AA0A6',
  strategic: '#7C4DFF',
  followup: '#00E5FF',
  review: '#FFD600',
  jira: '#2684FF',
  pr: '#00C853',
};

function formatDate(dateStr) {
  const d = dayjs(dateStr);
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.format('dddd, MMM D');
}

export default function Activity() {
  const [days, setDays] = useState(14);
  const { data, isLoading } = useActivity(days);
  const { data: projects = [] } = useProjects();
  const logWork = useLogWork();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    title: '',
    type: 'task',
    projectId: '',
    ticketId: '',
    date: dayjs().format('YYYY-MM-DD'),
  });

  const handleLog = async () => {
    if (!form.title.trim()) return;
    await logWork.mutateAsync({
      ...form,
      projectId: form.projectId || null,
      ticketId: form.ticketId || null,
    });
    setForm({
      title: '',
      type: 'task',
      projectId: '',
      ticketId: '',
      date: dayjs().format('YYYY-MM-DD'),
    });
    setDialogOpen(false);
  };

  const grouped = data?.grouped || {};
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Activity Log</Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.totalCount || 0} items completed
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup
            value={days}
            exclusive
            onChange={(e, v) => v && setDays(v)}
            size="small"
          >
            <ToggleButton value={7}>7d</ToggleButton>
            <ToggleButton value={14}>14d</ToggleButton>
            <ToggleButton value={30}>30d</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Log Work
          </Button>
        </Stack>
      </Box>

      {dates.map((date) => (
        <Box key={date} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            {formatDate(date)}
            <Chip
              label={grouped[date].length}
              size="small"
              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
            />
          </Typography>
          <Stack spacing={1}>
            {grouped[date].map((item) => (
              <Card
                key={item.id}
                sx={{ cursor: 'pointer', '&:hover': { borderColor: 'rgba(255,255,255,0.15)' } }}
                onClick={() => setEditItem(item)}
              >
                <CardContent
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: '10px !important',
                    '&:last-child': { pb: '10px !important' },
                  }}
                >
                  <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    {item.externalId && (
                      <Typography
                        variant="caption"
                        sx={{ color: '#2684FF', fontFamily: 'monospace' }}
                      >
                        {item.externalId}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5} flexShrink={0}>
                    {item.project && (
                      <Chip
                        label={item.project.name}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          bgcolor: item.project.color + '22',
                          color: item.project.color,
                        }}
                      />
                    )}
                    <Chip
                      label={TYPE_LABELS[item.type] || item.type}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: (TYPE_COLORS[item.type] || '#666') + '22',
                        color: TYPE_COLORS[item.type] || '#666',
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      ))}

      {!isLoading && dates.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              No completed work yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use "Log Work" to record tickets and tasks you've finished,
              or complete items from the Board.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Log Work dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
            label="Ticket ID (optional)"
            value={form.ticketId}
            onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
            fullWidth
            placeholder="e.g. PROJ-1234"
          />
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
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLog}
            disabled={!form.title.trim()}
          >
            Log It
          </Button>
        </DialogActions>
      </Dialog>

      <WorkItemDialog
        item={editItem}
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
      />
    </Box>
  );
}
