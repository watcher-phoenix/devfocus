import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import VideocamIcon from '@mui/icons-material/Videocam';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useDaily } from '../api/daily';
import { useUpdateWorkItemStatus, useQuickCapture } from '../api/workItems';
import { useActivity } from '../api/activity';
import { useSnapshots } from '../api/snapshots';
import WorkItemDialog from '../components/WorkItemDialog';
import SnapshotDialog from '../components/SnapshotDialog';
import LogWorkDialog from '../components/LogWorkDialog';
import ContextualHint from '../components/ContextualHint';

function CollapsibleSection({ title, icon, count, defaultOpen, children, action }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: open ? undefined : '16px !important' }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setOpen(!open)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            {icon}
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>{title}</Typography>
            {count !== undefined && <Chip label={count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {action && <Box onClick={(e) => e.stopPropagation()}>{action}</Box>}
            <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
          </Stack>
        </Box>
        <Collapse in={open}>
          <Box sx={{ mt: 1.5 }}>{children}</Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function DailyFocus() {
  const navigate = useNavigate();
  const { data, isLoading } = useDaily();
  const updateStatus = useUpdateWorkItemStatus();
  const capture = useQuickCapture();
  const { data: activityData } = useActivity(7);
  const { data: snapshots = [] } = useSnapshots({ active: true });

  const [captureText, setCaptureText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 700 }}>
        <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
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
  const activityDates = Object.keys(activityGrouped).sort((a, b) => a.localeCompare(b));

  return (
    <Box sx={{ maxWidth: 700 }}>
      <ContextualHint hintId="today">
        This is your home base. Capture thoughts, check off priorities, and see your day at a glance.
        Use the sections below — they collapse so you only see what you need. Go to Work to organize
        your tasks, or Plan to schedule your week.
      </ContextualHint>

      {/* Alerts */}
      {data.alerts?.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {data.alerts.map((alert, i) => (
            <Alert key={i} severity={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}>
              {alert.message}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Day header + quick actions */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5">{data.dayOfWeek}</Typography>
              <Typography variant="body2" color="text.secondary">{data.date}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip icon={<EventIcon />} label={`${data.meetings.count} mtg${data.meetings.count !== 1 ? 's' : ''}`} variant="outlined" size="small" color={data.meetings.count > 3 ? 'warning' : 'default'} />
              <Chip icon={<AccessTimeIcon />} label={`${Math.floor(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m focus`} variant="outlined" size="small" color={data.focusMinutes >= 240 ? 'success' : 'default'} />
            </Stack>
          </Box>

          {/* Quick actions */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<ViewKanbanIcon />} onClick={() => navigate(data.inbox.count > 0 ? '/work?status=inbox' : '/work')}>
              {data.inbox.count > 0 ? `Triage (${data.inbox.count})` : 'Work'}
            </Button>
            <Button size="small" variant="outlined" startIcon={<CalendarMonthIcon />} onClick={() => navigate('/plan')}>
              Plan
            </Button>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setLogWorkOpen(true)}>
              Log Work
            </Button>
            <Button size="small" variant="outlined" startIcon={<BookmarkIcon />} onClick={() => { setEditSnapshot(null); setSnapshotDialogOpen(true); }}>
              Save Context
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Brain dump input */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
          <form onSubmit={handleCapture}>
            <TextField
              fullWidth
              size="small"
              placeholder="Capture a thought — type and hit Enter"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              autoComplete="off"
              slotProps={{ input: { startAdornment: <PsychologyIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} /> } }}
            />
          </form>
        </CardContent>
      </Card>

      {/* Priorities — open by default if there are items */}
      <CollapsibleSection
        title="Priorities"
        icon={<WhatshotIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
        count={data.priorities.length}
        defaultOpen={data.priorities.length > 0}
      >
        {data.priorities.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing scheduled for today. Go to <strong>Plan</strong> to drag items onto today, or <strong>Work</strong> to set priorities.
          </Typography>
        ) : (
          data.priorities.map((item) => {
            const isDone = item.status === 'done';
            return (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: isDone ? 0.5 : 1 }}>
                <Checkbox size="small" checked={isDone} onChange={() => handleToggle(item.id, isDone ? 'active' : 'done')} sx={{ p: 0.5 }} />
                <Typography variant="body2" sx={{ textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}>{item.title}</Typography>
                {item.project && <Chip label={item.project.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: item.project.color + '22', color: item.project.color }} />}
              </Box>
            );
          })
        )}
      </CollapsibleSection>

      {/* Meetings — open by default if there are meetings */}
      {data.meetings.events?.length > 0 && (
        <CollapsibleSection
          title="Meetings"
          icon={<EventIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
          count={data.meetings.count}
          defaultOpen
        >
          {data.meetings.events.map((event) => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const durationMin = Math.round((end - start) / 60000);
            return (
              <Box key={event.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5, borderLeft: '3px solid', borderColor: 'warning.main', pl: 1.5, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem', minWidth: 90 }}>
                  {event.allDay ? 'All day' : `${formatTime(start)} - ${formatTime(end)}`}
                </Typography>
                <Typography variant="body2" sx={{ flex: 1 }}>{event.title}</Typography>
                {!event.allDay && <Typography variant="caption" color="text.secondary">{durationMin}m</Typography>}
              </Box>
            );
          })}
        </CollapsibleSection>
      )}

      {/* Stale items — things sitting untouched */}
      {data.staleItems?.length > 0 && (
        <CollapsibleSection
          title="Needs Attention"
          icon={<WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />}
          count={data.staleItems.length}
          defaultOpen={false}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
            These items haven't been touched in over a week.
          </Typography>
          {data.staleItems.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }} onClick={() => setEditItem(item)}>
              <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 14 }} />
              <Typography variant="body2" sx={{ flex: 1, fontSize: '0.85rem' }}>{item.title}</Typography>
              <Chip label={`${item.daysSinceUpdate}d ago`} size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem' }} />
              {item.project && (
                <Chip label={item.project.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: item.project.color + '22', color: item.project.color }} />
              )}
            </Box>
          ))}
        </CollapsibleSection>
      )}

      {/* Context Snapshots — collapsed by default */}
      {snapshots.length > 0 && (
        <CollapsibleSection
          title="Pick Up Where You Left Off"
          icon={<BookmarkIcon sx={{ color: 'secondary.main', fontSize: 20 }} />}
          count={snapshots.length}
          defaultOpen={false}
        >
          {snapshots.map((snap) => (
            <Box
              key={snap.id}
              sx={{ py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' }, borderRadius: 1, px: 1, mb: 0.5 }}
              onClick={() => { setEditSnapshot(snap); setSnapshotDialogOpen(true); }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                <Chip label={snap.project?.name || 'No project'} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: (snap.project?.color || '#666') + '22', color: snap.project?.color || '#666' }} />
                {snap.branch && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{snap.branch}</Typography>}
              </Stack>
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{snap.summary}</Typography>
            </Box>
          ))}
        </CollapsibleSection>
      )}

      {/* Activity — collapsed by default */}
      <CollapsibleSection
        title="Activity"
        icon={<CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />}
        count={activityData?.totalCount || 0}
        defaultOpen={false}
        action={<Button size="small" startIcon={<AddIcon />} onClick={() => setLogWorkOpen(true)}>Log Work</Button>}
      >
        {activityDates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No activity yet. Complete items from Work or use "Log Work" to record what you've done.
          </Typography>
        ) : (
          activityDates.slice(0, 5).map((date) => (
            <Box key={date} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                {formatDate(date)}
              </Typography>
              {activityGrouped[date].map((item) => (
                <Box
                  key={item.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, cursor: item.isMeeting ? 'default' : 'pointer', borderRadius: 1, px: 0.5 }}
                  onClick={() => !item.isMeeting && setEditItem(item)}
                >
                  {item.isMeeting ? <VideocamIcon sx={{ color: 'warning.main', fontSize: 14 }} /> : <CheckCircleIcon sx={{ color: 'success.main', fontSize: 14 }} />}
                  <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>{item.title}</Typography>
                  {item.externalUrl && item.externalId && (
                    <Typography
                      variant="caption"
                      component="a"
                      href={item.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      sx={{ color: '#2684FF', fontFamily: 'monospace', fontSize: '0.7rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, flexShrink: 0 }}
                    >
                      {item.externalId}
                    </Typography>
                  )}
                  {item.isMeeting && item.duration && <Typography variant="caption" color="text.secondary">{item.duration}m</Typography>}
                </Box>
              ))}
            </Box>
          ))
        )}
      </CollapsibleSection>

      <WorkItemDialog item={editItem} open={Boolean(editItem)} onClose={() => setEditItem(null)} />
      <LogWorkDialog open={logWorkOpen} onClose={() => setLogWorkOpen(false)} />
      <SnapshotDialog open={snapshotDialogOpen} onClose={() => setSnapshotDialogOpen(false)} editSnapshot={editSnapshot} />
    </Box>
  );
}

function formatDate(dateStr) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = yd.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
