import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
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
import ContextualHint from '../components/ContextualHint';
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
              bgcolor: item.project.color + '22',
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

  const { data: allItems = [] } = useWorkItems({ statuses: 'inbox,active,waiting,later' });
  const updateItem = useUpdateWorkItem();
  const { data: weekMeetings = {} } = useWeekMeetings(weekStart);
  const { data: snapshots = [] } = useSnapshots({ active: true });
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
      <ContextualHint hintId="plan">
        Drag unscheduled items onto days to plan your week. Use the Snapshots tab to save where
        you left off on a project — branch name, what you were doing, and next steps — so you
        can pick up without losing context.
      </ContextualHint>
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
        </Box>
      </Box>

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
              gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr) 200px' },
              gap: 2,
              alignItems: 'flex-start',
            }}
          >
            {DAYS.map((day, i) => {
              const date = weekDates[i];
              const dayMeetings = weekMeetings[date] || { meetingCount: 0, meetingMinutes: 0 };
              const dayType = dayMeetings.meetingMinutes >= MEETING_THRESHOLD_MINUTES ? 'meetings' : 'focus';
              const isToday = date === dayjs().format('YYYY-MM-DD');
              const dayItems = itemsByDate[date] || [];

              return (
                <Box key={day}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                      px: 0.5,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          color: isToday ? 'primary.main' : 'text.primary',
                        }}
                      >
                        {DAY_LABELS[i]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(date).format('MMM D')}
                      </Typography>
                    </Box>
                    <Chip
                      icon={dayType === 'meetings' ? <EventIcon /> : <CodeIcon />}
                      label={dayType === 'meetings' ? `${dayMeetings.meetingCount} mtgs` : 'Focus'}
                      size="small"
                      variant="outlined"
                      color={dayType === 'focus' ? 'success' : 'default'}
                      sx={{ height: 24, fontSize: '0.65rem' }}
                    />
                  </Box>

                  <DroppableDay dayId={date}>
                    {dayItems.map((item) => (
                      <DraggableCard key={item.id} item={item} />
                    ))}
                    {dayItems.length === 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', textAlign: 'center', py: 3, opacity: 0.6 }}
                      >
                        Drop items here
                      </Typography>
                    )}
                  </DroppableDay>
                </Box>
              );
            })}

            {/* Unscheduled sidebar */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, px: 0.5 }}>
                Unscheduled
              </Typography>
              <DroppableDay dayId="unscheduled">
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  {unscheduled.slice(0, 15).map((item) => (
                    <DraggableCard key={item.id} item={item} />
                  ))}
                  {unscheduled.length > 15 && (
                    <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                      +{unscheduled.length - 15} more
                    </Typography>
                  )}
                  {unscheduled.length === 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', textAlign: 'center', py: 3 }}
                    >
                      All scheduled
                    </Typography>
                  )}
                </Box>
              </DroppableDay>
            </Box>
          </Box>
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <Card sx={{ width: 180, opacity: 0.9 }}>
              <CardContent sx={{ p: '8px !important', '&:last-child': { pb: '8px !important' } }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {activeItem.title}
                </Typography>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
      </>)}
    </Box>
  );
}
