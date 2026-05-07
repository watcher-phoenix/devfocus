import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useDaily } from '../api/daily';
import { useUpdateWorkItemStatus, useQuickCapture } from '../api/workItems';
import { useActivity } from '../api/activity';
import { useSnapshots } from '../api/snapshots';
import WorkItemDialog from '../components/WorkItemDialog';
import SnapshotDialog from '../components/SnapshotDialog';
import LogWorkDialog from '../components/LogWorkDialog';
import ContextualHint from '../components/ContextualHint';

const TYPE_COLORS = {
  task: '#9AA0A6', ticket: '#2684FF', strategic: '#7C4DFF', followup: '#00E5FF',
  review: '#FFD600', jira: '#2684FF', pr: '#00C853', meeting: '#FF9800',
};

function PriorityCard({ item, onToggle }) {
  const isDone = item.status === 'done';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, opacity: isDone ? 0.5 : 1 }}>
      <Checkbox
        size="small"
        checked={isDone}
        onChange={() => onToggle(item.id, isDone ? 'active' : 'done')}
        sx={{ p: 0.5 }}
      />
      <Typography variant="body1" sx={{ textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}>
        {item.title}
      </Typography>
      {item.project && (
        <Chip label={item.project.name} size="small" sx={{ bgcolor: item.project.color + '22', color: item.project.color, fontWeight: 500, fontSize: '0.7rem' }} />
      )}
    </Box>
  );
}

export default function DailyFocus() {
  const { data, isLoading } = useDaily();
  const updateStatus = useUpdateWorkItemStatus();
  const capture = useQuickCapture();
  const [activityDays, setActivityDays] = useState(7);
  const { data: activityData } = useActivity(activityDays);
  const { data: snapshots = [] } = useSnapshots({ active: true });

  const [captureText, setCaptureText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const captureRef = useRef(null);

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 700 }}>
        <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={150} />
      </Box>
    );
  }

  if (!data) return null;

  const handleToggle = (id, status) => updateStatus.mutate({ id, status });

  const handleCapture = async (e) => {
    e.preventDefault();
    if (!captureText.trim()) return;
    await capture.mutateAsync({ title: captureText.trim() });
    setCaptureText('');
  };

  const activityGrouped = activityData?.grouped || {};
  const activityDates = Object.keys(activityGrouped).sort((a, b) => b.localeCompare(a));

  return (
    <Box sx={{ maxWidth: 700 }}>
      <ContextualHint hintId="today">
        This is your command center. See your meetings and focus time, check off priorities,
        capture quick thoughts, log completed work, and save context snapshots — all without
        leaving this page. Use Ctrl+K to quick capture from anywhere.
      </ContextualHint>

      {/* Token expiry alerts */}
      {data.alerts?.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {data.alerts.map((alert, i) => (
            <Alert key={i} severity={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}>
              {alert.message}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Day header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: '16px !important' }}>
          <Box>
            <Typography variant="h5">{data.dayOfWeek}</Typography>
            <Typography variant="body2" color="text.secondary">{data.date}</Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip icon={<EventIcon />} label={`${data.meetings.count} meeting${data.meetings.count !== 1 ? 's' : ''}`} variant="outlined" color={data.meetings.count > 3 ? 'warning' : 'default'} />
            <Chip icon={<AccessTimeIcon />} label={`${Math.floor(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m focus`} variant="outlined" color={data.focusMinutes >= 240 ? 'success' : 'default'} />
          </Stack>
        </CardContent>
      </Card>

      {/* Inline Quick Capture */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
          <form onSubmit={handleCapture}>
            <TextField
              inputRef={captureRef}
              fullWidth
              size="small"
              placeholder="Brain dump — type anything and hit Enter"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              autoComplete="off"
              slotProps={{ input: { startAdornment: <PsychologyIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} /> } }}
            />
          </form>
        </CardContent>
      </Card>

      {/* Meetings */}
      {data.meetings.events?.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <EventIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>Today's Meetings</Typography>
            </Stack>
            {data.meetings.events.map((event) => {
              const start = new Date(event.startTime);
              const end = new Date(event.endTime);
              const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              const durationMin = Math.round((end - start) / 60000);
              return (
                <Box key={event.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderLeft: '3px solid', borderColor: event.allDay ? 'info.main' : 'warning.main', pl: 1.5, mb: 0.5 }}>
                  <Box sx={{ minWidth: 100 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      {event.allDay ? 'All day' : `${formatTime(start)} - ${formatTime(end)}`}
                    </Typography>
                    {!event.allDay && (
                      <Typography variant="caption" color="text.secondary">
                        {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{event.title}</Typography>
                    {event.location && <Typography variant="caption" color="text.secondary">{event.location}</Typography>}
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Priorities */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <WhatshotIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>Top Priorities</Typography>
          </Stack>
          {data.priorities.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No priorities scheduled for today. Go to Work to set priorities, or Plan to schedule items for today.
            </Typography>
          ) : (
            data.priorities.map((item) => (
              <PriorityCard key={item.id} item={item} onToggle={handleToggle} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Context Snapshots */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BookmarkIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>Pick Up Where You Left Off</Typography>
            </Stack>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setEditSnapshot(null); setSnapshotDialogOpen(true); }}>
              New
            </Button>
          </Stack>
          {snapshots.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No active snapshots. Save your context when you stop working on a project.
            </Typography>
          ) : (
            snapshots.map((snap) => (
              <Box
                key={snap.id}
                sx={{ py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, borderRadius: 1, px: 1, mb: 0.5 }}
                onClick={() => { setEditSnapshot(snap); setSnapshotDialogOpen(true); }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={snap.project?.name || 'No project'} size="small" sx={{ bgcolor: (snap.project?.color || '#666') + '22', color: snap.project?.color || '#666', fontWeight: 500, height: 20, fontSize: '0.7rem' }} />
                  {snap.branch && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{snap.branch}</Typography>}
                </Box>
                <Typography variant="body2">{snap.summary}</Typography>
                {snap.nextSteps && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line', display: 'block', mt: 0.25 }}>{snap.nextSteps}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.65rem' }}>
                  Last touched: {new Date(snap.lastTouchedAt).toLocaleString()}
                </Typography>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>Activity</Typography>
              <Chip label={activityData?.totalCount || 0} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <ToggleButtonGroup value={activityDays} exclusive onChange={(e, v) => v && setActivityDays(v)} size="small">
                <ToggleButton value={7} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>7d</ToggleButton>
                <ToggleButton value={14} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>14d</ToggleButton>
                <ToggleButton value={30} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>30d</ToggleButton>
              </ToggleButtonGroup>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setLogWorkOpen(true)}>
                Log Work
              </Button>
            </Stack>
          </Stack>

          {activityDates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No activity yet. Complete items from the Board or use "Log Work" to record what you've done.
            </Typography>
          ) : (
            activityDates.slice(0, 5).map((date) => (
              <Box key={date} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                  {formatDate(date)}
                  <Chip label={activityGrouped[date].length} size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                </Typography>
                {activityGrouped[date].map((item) => (
                  <Box
                    key={item.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, cursor: item.isMeeting ? 'default' : 'pointer', '&:hover': { bgcolor: item.isMeeting ? 'transparent' : 'rgba(255,255,255,0.03)' }, borderRadius: 1, px: 0.5 }}
                    onClick={() => !item.isMeeting && setEditItem(item)}
                  >
                    {item.isMeeting ? (
                      <VideocamIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                    ) : (
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    )}
                    <Typography variant="body2" sx={{ flex: 1, fontSize: '0.85rem' }}>
                      {item.title}
                    </Typography>
                    {item.isMeeting && item.duration && (
                      <Typography variant="caption" color="text.secondary">{item.duration}m</Typography>
                    )}
                    {item.externalId && (
                      <Typography variant="caption" sx={{ color: '#2684FF', fontFamily: 'monospace', fontSize: '0.7rem' }}>{item.externalId}</Typography>
                    )}
                    {item.project && (
                      <Chip label={item.project.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: item.project.color + '22', color: item.project.color }} />
                    )}
                    {!item.isMeeting && item.type && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: TYPE_COLORS[item.type] || '#666', flexShrink: 0 }} />
                    )}
                  </Box>
                ))}
              </Box>
            ))
          )}

          {/* Brain Dump preview */}
          {data.inbox.count > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <PsychologyIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Brain Dump ({data.inbox.count} unsorted)
                </Typography>
              </Stack>
              {data.inbox.recent.map((item) => (
                <Typography key={item.id} variant="body2" color="text.secondary" sx={{ py: 0.25, fontSize: '0.85rem' }}>
                  {item.title}
                </Typography>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <WorkItemDialog item={editItem} open={Boolean(editItem)} onClose={() => setEditItem(null)} />
      <LogWorkDialog open={logWorkOpen} onClose={() => setLogWorkOpen(false)} />
      <SnapshotDialog open={snapshotDialogOpen} onClose={() => setSnapshotDialogOpen(false)} editSnapshot={editSnapshot} />
    </Box>
  );
}

function formatDate(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
