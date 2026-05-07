import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import InboxIcon from '@mui/icons-material/Inbox';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useDaily } from '../api/daily';
import { useUpdateWorkItemStatus } from '../api/workItems';

function PriorityCard({ item, onToggle }) {
  const isDone = item.status === 'done';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        opacity: isDone ? 0.5 : 1,
      }}
    >
      <Checkbox
        size="small"
        checked={isDone}
        onChange={() => onToggle(item.id, isDone ? 'active' : 'done')}
        sx={{ p: 0.5 }}
      />
      <Typography
        variant="body1"
        sx={{ textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}
      >
        {item.title}
      </Typography>
      {item.project && (
        <Chip
          label={item.project.name}
          size="small"
          sx={{
            bgcolor: item.project.color + '22',
            color: item.project.color,
            fontWeight: 500,
            fontSize: '0.7rem',
          }}
        />
      )}
    </Box>
  );
}

export default function DailyFocus() {
  const { data, isLoading } = useDaily();
  const updateStatus = useUpdateWorkItemStatus();

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

  const handleToggle = (id, status) => {
    updateStatus.mutate({ id, status });
  };

  return (
    <Box sx={{ maxWidth: 700 }}>
      {/* Day header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: '16px !important' }}>
          <Box>
            <Typography variant="h5">{data.dayOfWeek}</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.date}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip
              icon={<EventIcon />}
              label={`${data.meetings.count} meeting${data.meetings.count !== 1 ? 's' : ''}`}
              variant="outlined"
              color={data.meetings.count > 3 ? 'warning' : 'default'}
            />
            <Chip
              icon={<AccessTimeIcon />}
              label={`${Math.round(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m focus`}
              variant="outlined"
              color={data.focusMinutes >= 240 ? 'success' : 'default'}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Priorities */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <WhatshotIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Top Priorities
            </Typography>
          </Stack>
          {data.priorities.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No priorities scheduled for today. Drag items from the Board or Weekly Planner.
            </Typography>
          ) : (
            data.priorities.map((item) => (
              <PriorityCard key={item.id} item={item} onToggle={handleToggle} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Context snapshot */}
      {data.snapshot && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <BookmarkIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                Pick Up Where You Left Off
              </Typography>
            </Stack>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={data.snapshot.project?.name || 'Unknown project'}
                size="small"
                sx={{
                  bgcolor: (data.snapshot.project?.color || '#666') + '22',
                  color: data.snapshot.project?.color || '#666',
                  fontWeight: 500,
                }}
              />
              {data.snapshot.branch && (
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {data.snapshot.branch}
                </Typography>
              )}
            </Box>
            <Typography variant="body1" sx={{ mb: 0.5 }}>
              {data.snapshot.summary}
            </Typography>
            {data.snapshot.nextSteps && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {data.snapshot.nextSteps}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Last touched: {new Date(data.snapshot.lastTouchedAt).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* What you got done */}
      {((data.done?.today?.length > 0) || (data.done?.yesterday?.length > 0)) && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                What You Got Done
              </Typography>
            </Stack>
            {data.done.today?.length > 0 && (
              <Box sx={{ mb: data.done.yesterday?.length > 0 ? 1.5 : 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                  Today
                </Typography>
                {data.done.today.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{item.title}</Typography>
                    {item.externalId && (
                      <Typography variant="caption" sx={{ color: '#2684FF', fontFamily: 'monospace' }}>
                        {item.externalId}
                      </Typography>
                    )}
                    {item.project && (
                      <Chip
                        label={item.project.name}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          bgcolor: item.project.color + '22',
                          color: item.project.color,
                        }}
                      />
                    )}
                  </Box>
                ))}
              </Box>
            )}
            {data.done.yesterday?.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                  Yesterday
                </Typography>
                {data.done.yesterday.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, opacity: 0.7 }}>
                    <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{item.title}</Typography>
                    {item.externalId && (
                      <Typography variant="caption" sx={{ color: '#2684FF', fontFamily: 'monospace' }}>
                        {item.externalId}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inbox */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <InboxIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              Inbox
            </Typography>
            <Chip label={data.inbox.count} size="small" color="primary" />
          </Stack>
          {data.inbox.recent.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Inbox is empty. Use Ctrl+K to quick capture.
            </Typography>
          ) : (
            data.inbox.recent.map((item, i) => (
              <Box key={item.id}>
                {i > 0 && <Divider sx={{ my: 0.5 }} />}
                <Typography variant="body2" sx={{ py: 0.5 }}>
                  {item.title}
                </Typography>
              </Box>
            ))
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
