import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTrends } from '../api/trends';

const TYPE_LABELS = {
  task: 'Tasks',
  ticket: 'Tickets',
  strategic: 'Strategic',
  followup: 'Follow-ups',
  review: 'PR Reviews',
  jira: 'Jira Tickets',
  pr: 'PRs Merged',
  support: 'Weekend Support',
};

const TYPE_COLORS = {
  task: '#9AA0A6', ticket: '#2684FF', strategic: '#7C4DFF', followup: '#00E5FF',
  review: '#FFD600', jira: '#2684FF', pr: '#00C853', support: '#FF5722',
};

function StatCard({ label, value, subtitle, color }) {
  return (
    <Card sx={{ flex: 1, minWidth: 120 }}>
      <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color || 'text.primary', fontSize: '1.8rem' }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

function BarChart({ data, label, color, unit }) {
  const max = Math.max(...Object.values(data), 1);
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>{label}</Typography>
      {entries.map(([key, value]) => {
        const weekLabel = new Date(key + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: 'right' }}>
              {weekLabel}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={(value / max) * 100}
                sx={{
                  height: 20,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 40, fontWeight: 500 }}>
              {unit === 'hours' ? `${Math.round(value / 60 * 10) / 10}h` : value}
            </Typography>
          </Box>
        );
      })}
      {entries.length === 0 && (
        <Typography variant="body2" color="text.secondary">No data for this period.</Typography>
      )}
    </Box>
  );
}

function TypeBreakdown({ data, total, details }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const [expanded, setExpanded] = useState(null);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Work Type Breakdown</Typography>
      {entries.map(([type, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isOpen = expanded === type;
        const items = details?.[type] || [];
        return (
          <Box key={type} sx={{ mb: 0.5 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', py: 0.5 }}
              onClick={() => setExpanded(isOpen ? null : type)}
            >
              <Typography variant="body2" sx={{ minWidth: 90, fontWeight: 500 }}>
                {TYPE_LABELS[type] || type}
              </Typography>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 16,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    '& .MuiLinearProgress-bar': { bgcolor: TYPE_COLORS[type] || '#666', borderRadius: 1 },
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'right' }}>
                {count} ({pct}%)
              </Typography>
              <IconButton size="small">{isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}</IconButton>
            </Box>
            <Collapse in={isOpen}>
              <Box sx={{ pl: 2, pb: 1 }}>
                {items.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    <Typography variant="caption" sx={{ flex: 1, fontSize: '0.75rem' }}>{item.title}</Typography>
                    {item.externalUrl && item.externalId && (
                      <Typography variant="caption" component="a" href={item.externalUrl} target="_blank" rel="noreferrer" sx={{ color: '#2684FF', fontFamily: 'monospace', fontSize: '0.65rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {item.externalId}
                      </Typography>
                    )}
                    {item.afterHours && <Chip label="After hours" size="small" color="error" sx={{ height: 16, fontSize: '0.55rem' }} />}
                    {item.project && <Chip label={item.project} size="small" sx={{ height: 16, fontSize: '0.55rem' }} />}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}

function ProjectBreakdown({ data, total }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>By Project</Typography>
      {entries.map(([project, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <Box key={project} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 500 }}>
              {project}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 16,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#7C4DFF', borderRadius: 1 },
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'right' }}>
              {count} ({pct}%)
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function Trends() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useTrends(days);

  if (isLoading || !data) return null;

  const { summary } = data;

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Trends</Typography>
          <Typography variant="body2" color="text.secondary">
            Evidence of what you've accomplished and where your time goes.
          </Typography>
        </Box>
        <ToggleButtonGroup value={days} exclusive onChange={(e, v) => v && setDays(v)} size="small">
          <ToggleButton value={14}>14d</ToggleButton>
          <ToggleButton value={30}>30d</ToggleButton>
          <ToggleButton value={60}>60d</ToggleButton>
          <ToggleButton value={90}>90d</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Summary stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <StatCard label="Items Completed" value={summary.totalCompleted} subtitle={`${summary.avgItemsPerWeek}/week avg`} color="success.main" />
        <StatCard label="Meetings" value={summary.totalMeetings} subtitle={`${summary.avgMeetingHoursPerWeek}h/week avg`} color="warning.main" />
        <StatCard label="Meeting Hours" value={summary.totalMeetingHours} subtitle="total" color="warning.main" />
        <StatCard label="PRs Reviewed" value={summary.prsReviewed} color="secondary.main" />
      </Stack>

      {/* Dynamic KPI cards for each work type */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        {Object.entries(data.typeBreakdown || {})
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <StatCard
              key={type}
              label={TYPE_LABELS[type] || type}
              value={count}
              color={TYPE_COLORS[type] || '#9AA0A6'}
            />
          ))}
        <StatCard label="After Hours Work" value={summary.afterHoursItems || 0} subtitle="outside work hours" color="error.main" />
        <StatCard label="After Hours Mtgs" value={summary.afterHoursMeetings || 0} subtitle="outside work hours" color="warning.main" />
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Weekly completions chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <BarChart data={data.weeklyCompletions} label="Items Completed Per Week" color="#00C853" />
        </CardContent>
      </Card>

      {/* Weekly meeting hours */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <BarChart data={data.weeklyMeetingMinutes} label="Meeting Hours Per Week" color="#FF9800" unit="hours" />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Type breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TypeBreakdown data={data.typeBreakdown} total={summary.totalCompleted} details={data.typeDetails} />
        </CardContent>
      </Card>

      {/* Project breakdown */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <ProjectBreakdown data={data.projectBreakdown} total={summary.totalCompleted} />
        </CardContent>
      </Card>
    </Box>
  );
}
