import { useState, useRef, useEffect, useCallback } from 'react';
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
import NotesIcon from '@mui/icons-material/Notes';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useDaily } from '../api/daily';
import { useUpdateWorkItemStatus, useQuickCapture } from '../api/workItems';
import { useActivity } from '../api/activity';
import { useSnapshots } from '../api/snapshots';
import { useDailyNote, useSaveDailyNote } from '../api/notes';
import WorkItemDialog from '../components/WorkItemDialog';
import SnapshotDialog from '../components/SnapshotDialog';
import LogWorkDialog from '../components/LogWorkDialog';
import RichTextEditor from '../components/RichTextEditor';
import { spawnConfetti } from '../components/DevEasterEggs';

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
  // This week's activity (Sunday through today)
  const daysSinceSunday = new Date().getDay();
  const { data: activityData } = useActivity(daysSinceSunday);
  const { data: snapshots = [] } = useSnapshots({ active: true });

  const [captureText, setCaptureText] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);

  // Notes state
  const { data: noteData } = useDailyNote('today');
  const saveNote = useSaveDailyNote();
  const [noteContent, setNoteContent] = useState('');
  const noteLastSaved = useRef('');

  useEffect(() => {
    if (noteData) {
      setNoteContent(noteData.content || '');
      noteLastSaved.current = noteData.content || '';
    }
  }, [noteData]);

  const handleNoteChange = useCallback((html) => {
    setNoteContent(html);
    if (html !== noteLastSaved.current) {
      saveNote.mutate({ date: 'today', content: html });
      noteLastSaved.current = html;
    }
  }, [saveNote]);

  if (isLoading) {
    const loadingQuips = [
      'Pretending to think...',
      'Consulting the cloud elves...',
      'Reticulating splines...',
      'Warming up the hamster wheel...',
      'Asking the interns...',
      'Dusting off the database...',
    ];
    const loadingMsg = loadingQuips[Math.floor(Math.random() * loadingQuips.length)];
    return (
      <Box sx={{ maxWidth: 700 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontStyle: 'italic' }}>{loadingMsg}</Typography>
        <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
      </Box>
    );
  }

  if (!data) return null;

  const handleToggle = (id, status) => {
    updateStatus.mutate({ id, status });
    // Confetti on Clean Sweep — check if this was the last undone item
    if (status === 'done' && data?.priorities) {
      const remaining = data.priorities.filter((i) => i.id !== id && i.status !== 'done');
      if (remaining.length === 0 && data.priorities.length > 1) {
        setTimeout(spawnConfetti, 300);
      }
    }
  };

  const handleCapture = async (e) => {
    e.preventDefault();
    if (!captureText.trim()) return;
    await capture.mutateAsync({ title: captureText.trim() });
    setCaptureText('');
  };

  const activityGrouped = activityData?.grouped || {};
  const activityDates = Object.keys(activityGrouped).sort((a, b) => a.localeCompare(b));

  // Snarky meeting commentary
  const getMeetingSnark = () => {
    if (!data) return null;
    const { count } = data.meetings;
    const focusHrs = data.focusMinutes / 60;
    if (count === 0) return 'Zero meetings. Is this real life?';
    if (count >= 8) return 'At this point just live in the conference room.';
    if (count >= 6) return 'You\'re basically a professional meeting attendee today.';
    if (count >= 4) return 'RIP your focus time.';
    if (count === 1 && focusHrs > 6) return 'One meeting? That\'s basically a day off.';
    if (focusHrs < 1) return 'Focus time? Never heard of her.';
    if (focusHrs < 2) return 'Two hours of focus. Use them wisely. Or don\'t.';
    return null;
  };

  // Time-based flavor
  const getFridaySnark = () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    if (day === 5 && hour >= 15) return "It's Friday. We both know you're not starting anything new.";
    if (day === 5 && hour < 10) return 'Friday. The light at the end of the tunnel.';
    if (day === 1 && hour < 10) return 'Monday morning. The audacity.';
    if (day === 3) return 'Wednesday. Halfway there. Allegedly.';
    if (hour >= 16 && hour < 17) return 'The 4pm wall. Push through or surrender to snacks.';
    if (hour >= 17) return 'Still here? Bold commitment to the craft.';
    if (hour < 7) return 'Up before the sun? Respect. Or insomnia.';
    return null;
  };

  // Streak/milestone quips for completed items
  const getActivitySnark = () => {
    const count = activityData?.totalCount || 0;
    if (count === 0) return null;
    if (count >= 20) return 'Look at you, being productive and stuff.';
    if (count >= 10) return 'Double digits. Your manager would be impressed. Maybe.';
    if (count >= 5) return 'Not bad. Not amazing, but not bad.';
    if (count === 1) return 'One down. Only everything else to go.';
    return null;
  };

  // Snarky stale items commentary
  const getStaleSnark = () => {
    if (!data?.staleItems?.length) return null;
    if (data.staleItems.length >= 4) return 'These are gathering dust. Either do them or let them go.';
    return 'These have been sitting here judging you silently.';
  };

  // Achievement badges
  const getBadges = () => {
    const badges = [];
    const totalActivity = activityData?.totalCount || 0;
    const doneToday = data?.priorities?.filter((i) => i.status === 'done').length || 0;
    const totalPriorities = data?.priorities?.length || 0;
    const meetings = data?.meetings?.count || 0;

    if (totalPriorities > 0 && doneToday === totalPriorities) badges.push({ icon: '\uD83C\uDFC6', label: 'Clean Sweep' });
    if (totalActivity >= 10) badges.push({ icon: '\uD83D\uDD25', label: 'On Fire' });
    if (totalActivity >= 20) badges.push({ icon: '\uD83D\uDE80', label: 'Shipping Machine' });
    if (meetings === 0) badges.push({ icon: '\uD83C\uDFDD\uFE0F', label: 'Meeting-Free' });
    if (meetings >= 6) badges.push({ icon: '\uD83C\uDFA7', label: 'Meeting Survivor' });
    if (data?.focusMinutes >= 360) badges.push({ icon: '\uD83E\uDDE0', label: 'Deep Focus' });
    if (new Date().getDay() === 5) badges.push({ icon: '\uD83C\uDF89', label: 'TGIF' });
    if (doneToday >= 3) badges.push({ icon: '\uD83D\uDCAA', label: `${doneToday} Down` });
    if (data?.staleItems?.length === 0 && totalPriorities > 0) badges.push({ icon: '\u2728', label: 'No Dust' });

    // Streak: consecutive days with completed items (working backward from today)
    if (activityDates.length > 0) {
      const today = new Date();
      let streak = 0;
      for (let i = 0; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const dayItems = activityGrouped[dateStr];
        if (dayItems && dayItems.some((item) => !item.isMeeting)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      if (streak >= 5) badges.push({ icon: '\uD83D\uDD25', label: `${streak}-Day Streak! Don't break it.` });
      else if (streak >= 3) badges.push({ icon: '\u26A1', label: `${streak}-Day Streak. No pressure.` });
    }

    return badges;
  };

  const meetingSnark = getMeetingSnark();
  const fridaySnark = getFridaySnark();
  const activitySnark = getActivitySnark();
  const staleSnark = getStaleSnark();
  const badges = getBadges();

  return (
    <Box sx={{ maxWidth: { xs: '100%', md: 1100 } }}>
      {/* Motivational banner */}
      <Card sx={{ mb: 2, background: 'linear-gradient(135deg, rgba(124,77,255,0.08), rgba(0,229,255,0.08))', border: '1px solid rgba(124,77,255,0.15)' }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: '1.1rem' }}>{['\u26A1', '\uD83D\uDD25', '\uD83D\uDE80', '\uD83E\uDDE0', '\u2615', '\uD83D\uDCAA', '\uD83C\uDFAF'][Math.floor(Math.random() * 7)]}</Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
            {[
              "Your code won't write itself. Well, unless you use AI.",
              'Ship it and let the tests catch the rest.',
              'Remember: it worked on your machine. That counts for something.',
              "Today's mass of tangled code is tomorrow's legacy system.",
              'Debugging is like being a detective in a crime movie where you are also the murderer.',
              'First, solve the problem. Then, write the code. Then, rewrite it. Then, rewrite it again.',
              "It's not a bug, it's an undocumented feature.",
              'The best error message is the one that never shows up.',
              'Code never lies. Comments sometimes do.',
              'Weeks of coding can save you hours of planning.',
              "git push --force and pray.",
              'There are only two hard things: cache invalidation, naming things, and off-by-one errors.',
            ][Math.floor(Math.random() * 12)]}
          </Typography>
        </Box>
      </Card>

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

    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 3 }, alignItems: 'flex-start' }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {/* Day header + quick actions */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5">{data.dayOfWeek}</Typography>
              <Typography variant="body2" color="text.secondary">{new Date(data.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip icon={<EventIcon />} label={`${data.meetings.count} mtg${data.meetings.count !== 1 ? 's' : ''}`} variant="outlined" size="small" color={data.meetings.count > 3 ? 'warning' : 'default'} />
              <Chip icon={<AccessTimeIcon />} label={`${Math.floor(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m focus`} variant="outlined" size="small" color={data.focusMinutes >= 240 ? 'success' : 'default'} />
            </Stack>
          </Box>
          {(meetingSnark || fridaySnark) && (
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', display: 'block', mb: 1 }}>
              {fridaySnark || meetingSnark}
            </Typography>
          )}

          {badges.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              {badges.map((b) => (
                <Chip key={b.label} label={`${b.icon} ${b.label}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', borderColor: 'rgba(124,77,255,0.3)', color: 'text.secondary' }} />
              ))}
            </Stack>
          )}

          {/* Quick actions */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<ViewKanbanIcon />} onClick={() => navigate(data.inbox.count > 0 ? '/work?status=inbox' : '/work')}>
              {data.inbox.count >= 20 ? `Triage (${data.inbox.count}) — this is getting out of hand` : data.inbox.count >= 10 ? `Triage (${data.inbox.count}) — your inbox is judging you` : data.inbox.count > 0 ? `Triage (${data.inbox.count})` : 'Work'}
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
              placeholder={['Capture a thought before it escapes...', 'Brain dump here. No judgment.', 'Type it before you forget. Again.', 'Quick, write it down before the next meeting...'][Math.floor(Math.random() * 4)]}
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
            Nothing scheduled for today. Either you're crushing it or avoiding it. Go to <strong>Plan</strong> to drag items onto today, or <strong>Work</strong> to set priorities.
          </Typography>
        ) : (<>
          {data.priorities.length > 0 && data.priorities.every((i) => i.status === 'done') && (
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'success.main', display: 'block', mb: 0.5 }}>
              {['All done. Go home.', 'Clean sweep. Your future self thanks you.', 'Everything checked off. Suspicious.'][Math.floor(Math.random() * 3)]}
            </Typography>
          )}
          {data.priorities.map((item) => {
            const isDone = item.status === 'done';
            return (
              <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: isDone ? 0.5 : 1, cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <Checkbox size="small" checked={isDone} onChange={() => handleToggle(item.id, isDone ? 'active' : 'done')} sx={{ p: 0.5 }} onClick={(e) => e.stopPropagation()} />
                <Typography variant="body2" onClick={() => setEditItem(item)} sx={{ textDecoration: isDone ? 'line-through' : 'none', flex: 1, cursor: 'pointer' }}>{item.title}</Typography>
                {item.priority > 0 && (
                  <Chip
                    label={item.priority === 3 ? 'High' : item.priority === 2 ? 'Med' : 'Low'}
                    size="small"
                    color={item.priority === 3 ? 'error' : item.priority === 2 ? 'warning' : 'default'}
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                )}
                {item.project && <Chip label={item.project.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: item.project.color + '22', color: item.project.color }} />}
              </Box>
            );
          })}
        </>)}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem', fontStyle: 'italic' }}>
            {staleSnark || 'These items haven\'t been touched in over a week.'}
          </Typography>
          {data.staleItems.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }} onClick={() => setEditItem(item)}>
              <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 14 }} />
              <Typography variant="body2" sx={{ flex: 1, fontSize: '0.85rem' }}>{item.title}</Typography>
              <Chip label={item.daysSinceUpdate >= 30 ? `${item.daysSinceUpdate}d. At this point, just delete it.` : item.daysSinceUpdate >= 14 ? `${item.daysSinceUpdate}d. Just saying.` : `${item.daysSinceUpdate}d ago`} size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem' }} />
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
        title="This Week"
        icon={<CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />}
        count={activityData?.totalCount || 0}
        defaultOpen={false}
        action={<Button size="small" startIcon={<AddIcon />} onClick={() => setLogWorkOpen(true)}>Log Work</Button>}
      >
        {activitySnark && activityDates.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mb: 1 }}>{activitySnark}</Typography>
        )}
        {activityDates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Inbox zero... for activity. Screenshot it before it lasts. Complete items from Work or use "Log Work" to record what you've done.
          </Typography>
        ) : (
          activityDates.map((date) => (
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

    {/* Right column — Notes */}
    <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 'auto' } }}>
      <Card>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <NotesIcon sx={{ color: 'info.main', fontSize: 18 }} />
            <Typography variant="h6" sx={{ fontSize: '0.9rem' }}>Notes</Typography>
          </Stack>
          <RichTextEditor
            content={noteContent}
            onChange={handleNoteChange}
            placeholder="Dear diary, today I actually got stuff done..."
            minHeight={150}
            compact
          />
        </CardContent>
      </Card>
    </Box>
    </Box>
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
