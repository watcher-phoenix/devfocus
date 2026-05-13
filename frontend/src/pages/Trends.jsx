import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
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
import Button from '@mui/material/Button';
import DownloadIcon from '@mui/icons-material/Download';
import { useTrends } from '../api/trends';
import { TYPE_LABELS, TYPE_COLORS } from '../constants/workTypes';
import { exportTrendsCSV, exportReportHTML } from '../utils/exportReport';

function StatCard({ label, value, subtitle, color }) {
  return (
    <Card sx={{ flex: 1, minWidth: { xs: 'calc(50% - 8px)', sm: 120 } }}>
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

const PROJECT_FALLBACK_COLOR = '#8D6E63';

function ProjectBreakdown({ data, total, details, colors = {} }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const [expanded, setExpanded] = useState(null);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>By Project</Typography>
      {entries.map(([project, count], idx) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isOpen = expanded === project;
        const items = details?.[project] || [];
        const barColor = PROJECT_FALLBACK_COLOR;
        return (
          <Box key={project} sx={{ mb: 0.5 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', py: 0.5 }}
              onClick={() => setExpanded(isOpen ? null : project)}
            >
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
                    '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 1 },
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
                    <Chip label={TYPE_LABELS[item.type] || item.type} size="small" sx={{ height: 16, fontSize: '0.55rem' }} />
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

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}

function sundayOfThisWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toLocaleDateString('en-CA');
}

export default function Trends() {
  const [preset, setPreset] = useState(null);
  const [fromDate, setFromDate] = useState(sundayOfThisWeek());
  const [toDate, setToDate] = useState(todayStr());
  const [useCustom, setUseCustom] = useState(true);

  const queryParams = useCustom
    ? { from: fromDate, to: toDate }
    : { days: preset };
  const { data, isLoading } = useTrends(queryParams);

  const handlePreset = (e, v) => {
    if (!v) return;
    setPreset(v);
    setFromDate(daysAgo(v));
    setToDate(todayStr());
    setUseCustom(false);
  };

  const handleDateChange = (field, value) => {
    if (field === 'from') setFromDate(value);
    else setToDate(value);
    setPreset(null);
    setUseCustom(true);
  };

  if (isLoading || !data) {
    const quips = ['Crunching numbers...', 'Making your productivity look good...', 'Generating plausible charts...', 'Asking the data to behave...'];
    return (
      <Box sx={{ maxWidth: 800, p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{quips[Math.floor(Math.random() * quips.length)]}</Typography>
      </Box>
    );
  }

  const { summary } = data;
  const exportLabel = useCustom ? `${fromDate}_${toDate}` : `${preset}d`;

  return (
    <Box sx={{ maxWidth: { xs: '100%', md: 800 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Trends</Typography>
          <Typography variant="body2" color="text.secondary">
            Evidence of what you've accomplished and where your time goes.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportTrendsCSV(data, `trends-${exportLabel}`)}
          >
            CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportReportHTML(data, { mode: 'shareable', dateRange: useCustom ? `${fromDate} to ${toDate}` : `Last ${preset} days` })}
          >
            Report
          </Button>
        </Stack>
      </Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup value={preset} exclusive onChange={handlePreset} size="small">
          <ToggleButton value={14}>14d</ToggleButton>
          <ToggleButton value={30}>30d</ToggleButton>
          <ToggleButton value={60}>60d</ToggleButton>
          <ToggleButton value={90}>90d</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          type="date"
          size="small"
          value={fromDate}
          onChange={(e) => handleDateChange('from', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          label="From"
          sx={{ width: { xs: 'calc(50% - 24px)', sm: 160 } }}
        />
        <TextField
          type="date"
          size="small"
          value={toDate}
          onChange={(e) => handleDateChange('to', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          label="To"
          sx={{ width: { xs: 'calc(50% - 24px)', sm: 160 } }}
        />
      </Stack>

      {/* Summary stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <StatCard label="Items Completed" value={summary.totalCompleted} subtitle={summary.totalCompleted >= 30 ? 'machine mode activated' : summary.totalCompleted >= 15 ? 'look at you go' : summary.totalCompleted === 0 ? 'crickets' : `${summary.avgItemsPerWeek}/week avg`} color="#CE93D8" />
        <StatCard label="Meetings" value={summary.totalMeetings} subtitle={summary.totalMeetings >= 20 ? 'you poor soul' : summary.totalMeetings >= 10 ? 'calendar tetris champion' : summary.totalMeetings === 0 ? 'living the dream' : `${summary.avgMeetingHoursPerWeek}h/week avg`} color="#CE93D8" />
        <StatCard label="Meeting Hours" value={summary.totalMeetingHours} subtitle={summary.totalMeetingHours >= 20 ? "that's a part-time job" : summary.totalMeetingHours >= 10 ? 'could\'ve been emails' : summary.totalMeetingHours === 0 ? 'inbox hero' : 'total'} color="#CE93D8" />
        <StatCard label="PRs Reviewed" value={summary.prsReviewed} subtitle={summary.prsReviewed >= 5 ? 'team player alert' : summary.prsReviewed === 0 ? 'LGTM from the couch' : undefined} color="#CE93D8" />
      </Stack>

      {/* Dynamic KPI cards for each work type */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        {Object.entries(data.typeBreakdown || {})
          .filter(([type]) => type !== 'pr-review')
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <StatCard
              key={type}
              label={TYPE_LABELS[type] || type}
              value={count}
              color={TYPE_COLORS[type] || '#9AA0A6'}
            />
          ))}
        <StatCard label="After Hours Work" value={summary.afterHoursItems || 0} subtitle={summary.afterHoursItems >= 3 ? 'boundaries are a thing' : summary.afterHoursItems > 0 ? 'overtime vibes' : 'healthy work-life balance'} color="#EF5350" />
        <StatCard label="After Hours Mtgs" value={summary.afterHoursMeetings || 0} subtitle={summary.afterHoursMeetings >= 2 ? 'who scheduled these?!' : summary.afterHoursMeetings > 0 ? 'someone owes you dinner' : 'as it should be'} color="#EF5350" />
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Weekly completions chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <BarChart data={data.weeklyCompletions} label="Items Completed Per Week" color="#CE93D8" />
        </CardContent>
      </Card>

      {/* Weekly meeting hours */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <BarChart data={data.weeklyMeetingMinutes} label="Meeting Hours Per Week" color="#78909C" unit="hours" />
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
          <ProjectBreakdown data={data.projectBreakdown} total={summary.totalCompleted} details={data.projectDetails} colors={data.projectColors || {}} />
        </CardContent>
      </Card>
    </Box>
  );
}
