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

const DEFAULT_DAY_TYPES = {
  mon: 'meetings',
  tue: 'meetings',
  wed: 'meetings',
  thu: 'focus',
  fri: 'focus',
};

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Weekly Planner</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setWeekOffset((o) => o - 1)} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 140, textAlign: 'center', fontWeight: 500 }}>
            {dayjs(weekStart).format('MMM D')} — {dayjs(weekStart).add(4, 'day').format('MMM D, YYYY')}
          </Typography>
          <IconButton onClick={() => setWeekOffset((o) => o + 1)} size="small">
            <ChevronRightIcon />
          </IconButton>
          {!isCurrentWeek && (
            <Button size="small" variant="outlined" onClick={() => setWeekOffset(0)}>
              This Week
            </Button>
          )}
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
              const dayType = DEFAULT_DAY_TYPES[day];
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
                      label={dayType === 'meetings' ? 'Mtgs' : 'Focus'}
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
    </Box>
  );
}
