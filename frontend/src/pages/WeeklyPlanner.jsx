import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import EventIcon from '@mui/icons-material/Event';
import CodeIcon from '@mui/icons-material/Code';
import { useWorkItems } from '../api/workItems';

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

export default function WeeklyPlanner() {
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const { data: allItems = [] } = useWorkItems({ statuses: 'inbox,active,waiting' });

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

  const unscheduled = allItems.filter(
    (i) => !i.scheduledDate && i.status !== 'done'
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Weekly Planner
      </Typography>

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

              <Box sx={{ minHeight: 120 }}>
                {dayItems.map((item) => (
                  <Card key={item.id} sx={{ mb: 1 }}>
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
                ))}
                {dayItems.length === 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', textAlign: 'center', py: 3 }}
                  >
                    Empty
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}

        {/* Unscheduled sidebar */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, px: 0.5 }}>
            Unscheduled
          </Typography>
          <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
            {unscheduled.slice(0, 10).map((item) => (
              <Card key={item.id} sx={{ mb: 1 }}>
                <CardContent sx={{ p: '8px !important', '&:last-child': { pb: '8px !important' } }}>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                    {item.title}
                  </Typography>
                </CardContent>
              </Card>
            ))}
            {unscheduled.length > 10 && (
              <Typography variant="caption" color="text.secondary">
                +{unscheduled.length - 10} more
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
