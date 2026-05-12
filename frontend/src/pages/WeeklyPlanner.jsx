import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import dayjs from 'dayjs';
import EventIcon from '@mui/icons-material/Event';
import CodeIcon from '@mui/icons-material/Code';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import SnapshotDialog from '../components/SnapshotDialog';
import { useSnapshots } from '../api/snapshots';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWorkItems, useUpdateWorkItem } from '../api/workItems';
import { useWeekMeetings } from '../api/daily';
import { useSettings } from '../api/settings';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekStart() {
  const now = dayjs();
  const day = now.day();
  const diff = day === 0 ? -6 : 1 - day;
  return now.add(diff, 'day').format('YYYY-MM-DD');
}

function getWeekDates(weekStart) {
  return DAYS.map((_, i) => dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'));
}

// 2+ hours of meetings = "meetings" day, otherwise "focus"
const MEETING_THRESHOLD_MINUTES = 120;

function DraggableCard({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item-${item.id}`,
    data: { item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{ mb: 1, cursor: 'grab', touchAction: 'none' }}
    >
      <CardContent sx={{ p: '8px !important', '&:last-child': { pb: '8px !important' } }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {item.title}
        </Typography>
        {item.project && (
          <Chip
            label={item.project.name}
            size="small"
            sx={{
              mt: 0.5,
              height: 18,
              fontSize: '0.6rem',
              bgcolor: item.project.color + '33',
              color: item.project.color,
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DroppableDay({ dayId, children }) {
  const { setNodeRef } = useSortable({ id: dayId, data: { type: 'day', dayId } });
  return <Box ref={setNodeRef} sx={{ minHeight: 120 }}>{children}</Box>;
}

export default function WeeklyPlanner() {
  const [tab, setTab] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStart = useMemo(() => getWeekStart(), []);
  const weekStart = useMemo(
    () => dayjs(currentWeekStart).add(weekOffset * 7, 'day').format('YYYY-MM-DD'),
    [currentWeekStart, weekOffset]
  );
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const isCurrentWeek = weekOffset === 0;
  const [activeItem, setActiveItem] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);

  const { data: allItems = [] } = useWorkItems({ statuses: 'inbox,active,waiting,later,scheduled' });
  const updateItem = useUpdateWorkItem();
  const { data: weekMeetingsRaw = {} } = useWeekMeetings(weekStart);
  const weekMeetings = weekMeetingsRaw.days || weekMeetingsRaw;
  const weekReleaseInfo = weekMeetingsRaw.releaseWeek || null;
  const { data: snapshots = [] } = useSnapshots({ active: true });
  const { data: settingsData } = useSettings();
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const itemsByDate = useMemo(() => {
    const map = {};
    weekDates.forEach((d) => { map[d] = []; });
    allItems.forEach((item) => {
      if (item.scheduledDate && map[item.scheduledDate]) {
        map[item.scheduledDate].push(item);
      }
    });
    return map;
  }, [allItems, weekDates]);

  const unscheduled = allItems.filter((i) => !i.scheduledDate && i.status !== 'done');

  // Build all sortable IDs
  const allSortableIds = useMemo(() => {
    const ids = [...weekDates, 'unscheduled'];
    allItems.forEach((i) => ids.push(`item-${i.id}`));
    return ids;
  }, [allItems, weekDates]);

  const handleDragStart = (event) => {
    const match = String(event.active.id).match(/^item-(\d+)$/);
    if (match) {
      const item = allItems.find((i) => i.id === parseInt(match[1]));
      setActiveItem(item || null);
    }
  };

  const handleDragEnd = (event) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeMatch = String(active.id).match(/^item-(\d+)$/);
    if (!activeMatch) return;
    const itemId = parseInt(activeMatch[1]);

    let targetDate = null;

    // Dropped on a day column
    if (weekDates.includes(over.id)) {
      targetDate = over.id;
    } else if (over.id === 'unscheduled') {
      targetDate = null;
    } else {
      // Dropped on another item — use that item's date
      const overMatch = String(over.id).match(/^item-(\d+)$/);
      if (overMatch) {
        const overItem = allItems.find((i) => i.id === parseInt(overMatch[1]));
        targetDate = overItem?.scheduledDate || null;
      }
    }

    const draggedItem = allItems.find((i) => i.id === itemId);
    if (!draggedItem) return;
    if (draggedItem.scheduledDate === targetDate) return;

    updateItem.mutate({ id: itemId, scheduledDate: targetDate });
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Plan</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Week" />
        <Tab label="Snapshots" />
      </Tabs>

      {tab === 1 && (
        <Box sx={{ maxWidth: 700 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Save where you left off in a project so you can pick it up without losing context.
            </Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => { setEditSnapshot(null); setSnapshotDialogOpen(true); }}>
              New
            </Button>
          </Box>
          <Stack spacing={1.5}>
            {snapshots.map((snap) => (
              <Card
                key={snap.id}
                sx={{ cursor: 'pointer', '&:hover': { borderColor: 'rgba(255,255,255,0.15)' } }}
                onClick={() => { setEditSnapshot(snap); setSnapshotDialogOpen(true); }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip label={snap.project?.name || 'No project'} size="small" sx={{ bgcolor: (snap.project?.color || '#666') + '22', color: snap.project?.color || '#666', fontWeight: 500 }} />
                    {snap.branch && <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{snap.branch}</Typography>}
                  </Box>
                  <Typography variant="body1" sx={{ mb: 0.5 }}>{snap.summary}</Typography>
                  {snap.nextSteps && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{snap.nextSteps}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Last touched: {new Date(snap.lastTouchedAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            ))}
            {snapshots.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No active snapshots. Create one when you stop working on a project.
              </Typography>
            )}
          </Stack>
          <SnapshotDialog open={snapshotDialogOpen} onClose={() => setSnapshotDialogOpen(false)} editSnapshot={editSnapshot} />
        </Box>
      )}

      {tab === 0 && (<>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setWeekOffset((o) => o - 1)} size="small"><ChevronLeftIcon /></IconButton>
          <Typography variant="body2" sx={{ minWidth: 140, textAlign: 'center', fontWeight: 500 }}>
            {dayjs(weekStart).format('MMM D')} — {dayjs(weekStart).add(4, 'day').format('MMM D, YYYY')}
          </Typography>
          <IconButton onClick={() => setWeekOffset((o) => o + 1)} size="small"><ChevronRightIcon /></IconButton>
          {!isCurrentWeek && <Button size="small" variant="outlined" onClick={() => setWeekOffset(0)}>This Week</Button>}
          {weekReleaseInfo?.isReleaseWeek && <Chip label="Release Week" size="small" color="warning" variant="outlined" />}
          {weekReleaseInfo?.isReleaseDay && <Chip label="Release Day" size="small" color="error" variant="outlined" />}
        </Box>
      </Box>

      {/* Smart suggestions — above the calendar so they're visible */}
      {(() => {
        const workdayMinutes = settingsData
          ? (() => { const [sh, sm] = (settingsData.workStartTime || '07:30').split(':').map(Number); const [eh, em] = (settingsData.workEndTime || '16:00').split(':').map(Number); return (eh * 60 + em) - (sh * 60 + sm); })()
          : 510;

        const suggestions = [];
        // Only Brain Dump and Active items for suggestions (not waiting/later)
        const eligible = unscheduled.filter((i) => i.status === 'inbox' || i.status === 'active');
        const sorted = [...eligible].sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          // Reviews and follow-ups are quicker tasks, good for meeting days
          const quickTypes = ['review', 'pr-review', 'followup'];
          const aQuick = quickTypes.includes(a.type) ? 1 : 0;
          const bQuick = quickTypes.includes(b.type) ? 1 : 0;
          return bQuick - aQuick;
        });

        weekDates.forEach((date, di) => {
          const mtgs = weekMeetings[date] || { meetingMinutes: 0 };
          const focusMins = workdayMinutes - mtgs.meetingMinutes;
          const scheduled = (itemsByDate[date] || []).length;
          const isPast = date < dayjs().format('YYYY-MM-DD');

          if (isPast || sorted.length === 0) return;

          const mtgCount = mtgs.meetingCount || 0;
          const isMeetingDay = mtgCount >= 2 || mtgs.meetingMinutes >= MEETING_THRESHOLD_MINUTES;

          if (!isMeetingDay && focusMins >= 240) {
            suggestions.push({ date, day: DAY_LABELS[di], focusMins: Math.round(focusMins), mtgCount, items: sorted.slice(0, 5), reason: `Focus day (${mtgCount} meetings, ${Math.floor(focusMins / 60)}h ${Math.round(focusMins % 60)}m free)` });
          } else if (!isMeetingDay && focusMins >= 120) {
            suggestions.push({ date, day: DAY_LABELS[di], focusMins: Math.round(focusMins), mtgCount, items: sorted.slice(0, 3), reason: `Some focus time (${mtgCount} meetings, ${Math.floor(focusMins / 60)}h ${Math.round(focusMins % 60)}m free)` });
          } else if (isMeetingDay && focusMins > 0) {
            const quickItems = sorted.filter((i) => ['review', 'pr-review', 'followup', 'pr', 'ticket'].includes(i.type)).slice(0, 3);
            const fallback = quickItems.length > 0 ? quickItems : sorted.slice(0, 2);
            suggestions.push({ date, day: DAY_LABELS[di], focusMins: Math.round(focusMins), mtgCount, items: fallback, reason: `Meeting day (${mtgCount} meetings) — quick tasks between gaps` });
          }
        });

        if (suggestions.length === 0) return null;

        return (
          <Card sx={{ mb: 2, border: '1px solid rgba(255,215,0,0.15)' }}>
            <CardContent sx={{ py: '10px !important', '&:last-child': { pb: '10px !important' } }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ cursor: 'pointer' }}
                onClick={() => setSuggestionsOpen((o) => !o)}
              >
                <LightbulbIcon sx={{ color: '#FFD600', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>Suggestions</Typography>
                {suggestionsOpen ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
              </Stack>
              <Collapse in={suggestionsOpen}>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  {suggestions.map((sug) => (
                    <Box key={sug.date}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {sug.day}
                        </Typography>
                        <Chip label={`${Math.floor(sug.focusMins / 60)}h ${sug.focusMins % 60}m free`} size="small" variant="outlined" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                        <Typography variant="caption" color="text.secondary">{sug.reason}</Typography>
                      </Stack>
                      {sug.items.map((item) => (
                        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, pl: 1 }}>
                          <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>{item.title}</Typography>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => updateItem.mutate({ id: item.id, scheduledDate: sug.date })}
                            sx={{ fontSize: '0.7rem', py: 0.25, px: 1.5, minWidth: 0 }}
                          >
                            Schedule for {sug.day.slice(0, 3)}
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        );
      })()}

      {/* Week calendar */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
              gap: { xs: 1, md: 1.5 },
              alignItems: 'flex-start',
              mb: 3,
              overflow: 'hidden',
            }}
          >
            {DAYS.map((day, i) => {
              const date = weekDates[i];
              const dayMeetings = weekMeetings[date] || { meetingCount: 0, meetingMinutes: 0 };
              const dayType = dayMeetings.meetingMinutes >= MEETING_THRESHOLD_MINUTES ? 'meetings' : 'focus';
              const isToday = date === dayjs().format('YYYY-MM-DD');
              const dayItems = itemsByDate[date] || [];

              return (
                <Box key={day} sx={{ minWidth: 0, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: isToday ? 'primary.main' : 'text.primary' }}>
                        {DAY_LABELS[i]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(date).format('MMM D')}
                      </Typography>
                    </Box>
                    <Chip
                      icon={dayType === 'meetings' ? <EventIcon /> : <CodeIcon />}
                      label={dayMeetings.overbooked ? `${dayMeetings.meetingCount} mtgs (Overbooked)` : (dayType === 'meetings' ? `${dayMeetings.meetingCount} mtgs` : 'Focus')}
                      size="small"
                      variant={dayMeetings.overbooked ? 'filled' : 'outlined'}
                      color={dayMeetings.overbooked ? 'error' : (dayType === 'focus' ? 'success' : 'default')}
                      sx={{ height: 24, fontSize: '0.65rem' }}
                    />
                  </Box>

                  {/* Meetings for this day — compact */}
                  {dayMeetings.events?.length > 0 && (
                    <Box sx={{ mb: 0.5, bgcolor: 'rgba(255,152,0,0.06)', borderRadius: 1, px: 0.75, py: 0.5 }}>
                      {dayMeetings.events.map((evt, ei) => {
                        const start = new Date(evt.startTime);
                        const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        return (
                          <Typography key={ei} variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmt(start)} {evt.title}
                          </Typography>
                        );
                      })}
                    </Box>
                  )}

                  <DroppableDay dayId={date}>
                    {dayItems.map((item) => (
                      <DraggableCard key={item.id} item={item} />
                    ))}
                    {dayItems.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2, opacity: 0.6 }}>
                        Drop here
                      </Typography>
                    )}
                  </DroppableDay>
                </Box>
              );
            })}
          </Box>
        </SortableContext>

        {/* Unscheduled items — list below calendar */}
        {unscheduled.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Unscheduled ({unscheduled.length})
            </Typography>
            <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
              {unscheduled.map((item) => (
                <Card
                  key={item.id}
                  sx={{ mb: 1, '&:hover': { borderColor: 'rgba(255,255,255,0.15)' } }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '8px !important', '&:last-child': { pb: '8px !important' } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{item.title}</Typography>
                      {item.project && (
                        <Chip label={item.project.name} size="small" sx={{ mt: 0.5, height: 18, fontSize: '0.6rem', bgcolor: item.project.color + '22', color: item.project.color }} />
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      {DAY_LABELS.map((dayLabel, di) => (
                        <Button
                          key={di}
                          size="small"
                          variant="outlined"
                          onClick={() => updateItem.mutate({ id: item.id, scheduledDate: weekDates[di] })}
                          sx={{ minWidth: { xs: 28, sm: 36 }, px: { xs: 0.25, sm: 0.5 }, fontSize: '0.65rem', py: 0.25 }}
                        >
                          {dayLabel.slice(0, 3)}
                        </Button>
                      ))}
                      <TextField
                        type="date"
                        size="small"
                        onChange={(e) => {
                          if (e.target.value) updateItem.mutate({ id: item.id, scheduledDate: e.target.value });
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{
                          width: { xs: '100%', sm: 140 },
                          '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, px: 1 },
                        }}
                        label="Other date"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </SortableContext>
          </Box>
        )}

        <DragOverlay>
          {activeItem ? (
            <Card sx={{ width: 250, opacity: 0.9 }}>
              <CardContent sx={{ p: '8px !important', '&:last-child': { pb: '8px !important' } }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{activeItem.title}</Typography>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
      </>)}
    </Box>
  );
}
