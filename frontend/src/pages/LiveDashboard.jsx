import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { useTrends } from '../api/trends';
import { TYPE_LABELS, TYPE_COLORS } from '../constants/workTypes';

// ── date helpers ───────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmtISO(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmtISO(d); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtISO(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const weekStartOf = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return fmtISO(d); };
const fmtWeek = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const round1 = (n) => Math.round(n * 10) / 10;

const STRATEGIC_COLOR = '#7C4DFF';
const EXEC_COLOR = '#00C853';
const MEETING_COLOR = '#FF6D00';

// ── small pieces ─────────────────────────────────────────────────────────--
function Delta({ curr, prev, invert }) {
  if (prev === undefined || prev === null) return null;
  const diff = round1(curr - prev);
  if (diff === 0) {
    return <Typography component="span" variant="caption" color="text.secondary">no change vs prior</Typography>;
  }
  const up = diff > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpwardIcon : ArrowDownwardIcon;
  const color = good ? 'success.main' : 'error.main';
  return (
    <Typography component="span" variant="caption" sx={{ color, display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
      <Icon sx={{ fontSize: 14 }} />{Math.abs(diff)} vs prior
    </Typography>
  );
}

function StatCard({ label, value, sub, color, curr, prev, invert }) {
  return (
    <Card sx={{ flex: 1, minWidth: { xs: 'calc(50% - 8px)', sm: 150 } }}>
      <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color || 'text.primary', fontSize: '1.8rem' }}>{value}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sub}</Typography>}
        <Box sx={{ mt: 0.5 }}><Delta curr={curr} prev={prev} invert={invert} /></Box>
      </CardContent>
    </Card>
  );
}

function Panel({ title, subtitle, children, span }) {
  return (
    <Card sx={{ gridColumn: span ? { xs: 'auto', md: '1 / -1' } : 'auto' }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{subtitle}</Typography>}
        {children}
      </CardContent>
    </Card>
  );
}

// GitHub-style calendar heatmap of completed items per day.
function Heatmap({ items, from, to }) {
  const { weeks, max } = useMemo(() => {
    const counts = {};
    const ah = {};
    (items || []).forEach((i) => {
      if (!i.completedISO) return;
      counts[i.completedISO] = (counts[i.completedISO] || 0) + 1;
      if (i.afterHours) ah[i.completedISO] = (ah[i.completedISO] || 0) + 1;
    });
    const start = weekStartOf(from);
    const cols = [];
    let highest = 0;
    let cursor = start;
    // Walk Sunday-aligned weeks until we pass `to`.
    while (cursor <= to || new Date(cursor + 'T12:00:00').getDay() !== 0) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(cursor, d);
        const c = counts[day] || 0;
        if (c > highest) highest = c;
        col.push({ day, count: c, ah: ah[day] || 0, inRange: day >= from && day <= to });
      }
      cols.push({ key: cursor, days: col });
      cursor = addDays(cursor, 7);
      if (cols.length > 70) break; // safety bound
    }
    return { weeks: cols, max: highest };
  }, [items, from, to]);

  const cell = (c) => {
    if (!c.inRange) return 'transparent';
    if (c.count === 0) return 'rgba(255,255,255,0.06)';
    const ratio = max > 0 ? c.count / max : 0;
    return `rgba(124,77,255,${0.3 + 0.6 * ratio})`;
  };

  return (
    <Box sx={{ display: 'flex', gap: '3px', overflowX: 'auto', pb: 1 }}>
      {weeks.map((w) => (
        <Box key={w.key} sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {w.days.map((c) => (
            <Box
              key={c.day}
              title={`${c.day}: ${c.count} completed${c.ah ? ` (${c.ah} after-hours)` : ''}`}
              sx={{
                width: 13, height: 13, borderRadius: '3px', bgcolor: cell(c),
                outline: c.ah ? '1.5px solid rgba(255,214,0,0.9)' : 'none', outlineOffset: '-1.5px',
              }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── page ─────────────────────────────────────────────────────────────────--
export default function LiveDashboard() {
  const [preset, setPreset] = useState(30);
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(todayStr());

  // Prior equal-length window, immediately preceding the current one, for deltas.
  const len = Math.max(1, daysBetween(fromDate, toDate) + 1);
  const priorTo = addDays(fromDate, -1);
  const priorFrom = addDays(priorTo, -(len - 1));

  const { data, isLoading } = useTrends({ from: fromDate, to: toDate });
  const { data: prior } = useTrends({ from: priorFrom, to: priorTo });

  const applyPreset = (e, v) => {
    if (!v) return;
    setPreset(v);
    setFromDate(daysAgo(v));
    setToDate(todayStr());
  };
  const onDate = (field, value) => {
    setPreset(null);
    if (field === 'from') setFromDate(value);
    else setToDate(value);
  };

  const weekly = useMemo(() => {
    if (!data) return null;
    const keys = Array.from(new Set([
      ...Object.keys(data.weeklyCompletions || {}),
      ...Object.keys(data.weeklyMeetingMinutes || {}),
      ...Object.keys(data.weeklyFocusMinutes || {}),
    ])).sort();
    // Strategic share per week from flat item rows.
    const stratByWeek = {};
    const totalByWeek = {};
    (data.items || []).forEach((i) => {
      if (!i.completedISO) return;
      const w = weekStartOf(i.completedISO);
      totalByWeek[w] = (totalByWeek[w] || 0) + 1;
      if (i.type === 'strategic') stratByWeek[w] = (stratByWeek[w] || 0) + 1;
    });
    return {
      labels: keys.map(fmtWeek),
      items: keys.map((k) => data.weeklyCompletions?.[k] || 0),
      meetingHrs: keys.map((k) => round1((data.weeklyMeetingMinutes?.[k] || 0) / 60)),
      focusHrs: keys.map((k) => round1((data.weeklyFocusMinutes?.[k] || 0) / 60)),
      stratPct: keys.map((k) => (totalByWeek[k] ? Math.round(((stratByWeek[k] || 0) / totalByWeek[k]) * 100) : 0)),
    };
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.typeBreakdown || {})
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ id: type, value, label: TYPE_LABELS[type] || type, color: TYPE_COLORS[type] || '#90A4AE' }));
  }, [data]);

  if (isLoading || !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  }

  const s = data.summary;
  const ps = prior?.summary;

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Live Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Workload readout — completed work, meeting load, focus time, and where effort goes.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup value={preset} exclusive onChange={applyPreset} size="small">
            <ToggleButton value={7}>7d</ToggleButton>
            <ToggleButton value={30}>30d</ToggleButton>
            <ToggleButton value={90}>90d</ToggleButton>
            <ToggleButton value={180}>180d</ToggleButton>
          </ToggleButtonGroup>
          <TextField type="date" size="small" label="From" value={fromDate}
            onChange={(e) => onDate('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
          <TextField type="date" size="small" label="To" value={toDate}
            onChange={(e) => onDate('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
        </Stack>
      </Box>

      {/* Stat cards with period-over-period deltas */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <StatCard label="Completed items" value={s.totalCompleted} curr={s.totalCompleted} prev={ps?.totalCompleted}
          sub={`${s.avgItemsPerWeek}/wk avg`} />
        <StatCard label="Meeting hours" value={`${s.totalMeetingHours}h`} color={MEETING_COLOR}
          curr={s.totalMeetingHours} prev={ps?.totalMeetingHours} invert sub={`${s.totalMeetings} meetings`} />
        <StatCard label="Focus hours" value={`${s.totalFocusHours}h`} color={EXEC_COLOR}
          curr={s.totalFocusHours} prev={ps?.totalFocusHours} sub={`${s.avgFocusHoursPerWeek}h/wk avg`} />
        <StatCard label="After-hours items" value={s.afterHoursItems} color="#F44336"
          curr={s.afterHoursItems} prev={ps?.afterHoursItems} invert sub="lower is better" />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Panel title="Weekly completed items" subtitle="Throughput by week.">
          <BarChart height={300}
            xAxis={[{ scaleType: 'band', data: weekly.labels }]}
            series={[{ data: weekly.items, label: 'Items', color: STRATEGIC_COLOR }]}
            margin={{ left: 40, right: 10, top: 20, bottom: 30 }} />
        </Panel>

        <Panel title="Meetings vs focus (hours/week)" subtitle="Stacked weekly hours — your meeting load against estimated focus time.">
          <BarChart height={300}
            xAxis={[{ scaleType: 'band', data: weekly.labels }]}
            series={[
              { data: weekly.meetingHrs, label: 'Meeting hrs', color: MEETING_COLOR, stack: 'h' },
              { data: weekly.focusHrs, label: 'Focus hrs', color: EXEC_COLOR, stack: 'h' },
            ]}
            margin={{ left: 40, right: 10, top: 20, bottom: 30 }} />
        </Panel>

        <Panel title="Strategic share over time" subtitle="Percent of completed items that were strategic work, by week.">
          <LineChart height={300}
            xAxis={[{ scaleType: 'point', data: weekly.labels }]}
            yAxis={[{ min: 0, max: 100 }]}
            series={[{ data: weekly.stratPct, label: 'Strategic %', color: STRATEGIC_COLOR, area: true, showMark: true }]}
            margin={{ left: 40, right: 10, top: 20, bottom: 30 }} />
        </Panel>

        <Panel title="Type mix" subtitle="Completed items by work type.">
          <PieChart height={300}
            series={[{ data: pieData, innerRadius: 55, paddingAngle: 2, cornerRadius: 4 }]} />
        </Panel>

        <Panel title="Activity heatmap" subtitle="Completed items per day. Amber ring = after-hours work." span>
          <Heatmap items={data.items} from={fromDate} to={toDate} />
        </Panel>
      </Box>
    </Box>
  );
}
