import { useState, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import { toPng } from 'html-to-image';
import { BarChart, BarPlot } from '@mui/x-charts/BarChart';
import { LineChart, LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { ResponsiveChartContainer } from '@mui/x-charts/ResponsiveChartContainer';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { useTrends } from '../api/trends';
import { TYPE_LABELS, TYPE_COLORS } from '../constants/workTypes';
import { TALLY_CATEGORIES } from '../constants/tallies';

// ── date helpers ───────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmtISO(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmtISO(d); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtISO(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const weekStartOf = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return fmtISO(d); };
const fmtDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const round1 = (n) => Math.round(n * 10) / 10;

// Calendar-period starts (this week / month / quarter / year), as ISO strings.
const startOfMonthStr = () => { const d = new Date(); return fmtISO(new Date(d.getFullYear(), d.getMonth(), 1)); };
const startOfQuarterStr = () => { const d = new Date(); return fmtISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)); };
const startOfYearStr = () => { const d = new Date(); return fmtISO(new Date(d.getFullYear(), 0, 1)); };
// Each preset maps to the `from` date it selects; `to` is always today.
const PRESETS = [
  { value: 7, label: '7d', title: 'Last 7 days', from: () => daysAgo(7) },
  { value: 30, label: '30d', title: 'Last 30 days', from: () => daysAgo(30) },
  { value: 90, label: '90d', title: 'Last 90 days', from: () => daysAgo(90) },
  { value: 'wtd', label: 'WTD', title: 'This week', from: () => weekStartOf(todayStr()) },
  { value: 'mtd', label: 'MTD', title: 'This month', from: startOfMonthStr },
  { value: 'qtd', label: 'QTD', title: 'This quarter', from: startOfQuarterStr },
  { value: 'ytd', label: 'YTD', title: 'This year', from: startOfYearStr },
];
const PRESET_FROM = Object.fromEntries(PRESETS.map((p) => [p.value, p.from]));

// Parts of the day for the "when work happens" breakdown (local clock hour).
const PARTS_OF_DAY = [
  { label: 'Early', test: (h) => h >= 5 && h < 8 },
  { label: 'Morning', test: (h) => h >= 8 && h < 12 },
  { label: 'Midday', test: (h) => h >= 12 && h < 14 },
  { label: 'Afternoon', test: (h) => h >= 14 && h < 17 },
  { label: 'Evening', test: (h) => h >= 17 && h < 21 },
  { label: 'Night', test: (h) => h >= 21 || h < 5 },
];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STRATEGIC_COLOR = '#7C4DFF';
const EXEC_COLOR = '#00C853';
const MEETING_COLOR = '#FF6D00';
const SWITCH_COLOR = '#FFB300';
const BOTTOM_LEGEND = { legend: { direction: 'row', position: { vertical: 'bottom', horizontal: 'middle' } } };

// ── small pieces ─────────────────────────────────────────────────────────--
function Delta({ curr, prev, invert }) {
  if (prev === undefined || prev === null) return null;
  const diff = round1(curr - prev);
  if (diff === 0) return <Typography component="span" variant="caption" color="text.secondary">no change vs prior</Typography>;
  const up = diff > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpwardIcon : ArrowDownwardIcon;
  return (
    <Typography component="span" variant="caption" sx={{ color: good ? 'success.main' : 'error.main', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
      <Icon sx={{ fontSize: 14 }} />{Math.abs(diff)} vs prior
    </Typography>
  );
}

function StatCard({ label, value, sub, color, curr, prev, invert, trend }) {
  const showTrend = Array.isArray(trend) && trend.filter((n) => n > 0).length > 1;
  return (
    <Card sx={{ flex: 1, minWidth: { xs: 'calc(50% - 8px)', sm: 150 } }}>
      <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: color || 'text.primary', fontSize: '1.8rem' }}>{value}</Typography>
          {showTrend && (
            <Box sx={{ width: 64, height: 28, flexShrink: 0, mt: 0.5 }} title="Weekly trend">
              <SparkLineChart data={trend} height={28} curve="monotoneX" color={color || STRATEGIC_COLOR} area
                margin={{ top: 2, bottom: 2, left: 0, right: 0 }} />
            </Box>
          )}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
        {sub && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sub}</Typography>}
        <Box sx={{ mt: 0.5 }}><Delta curr={curr} prev={prev} invert={invert} /></Box>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label, line }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: line ? 16 : 12, height: line ? 3 : 12, borderRadius: line ? 2 : '3px', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
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

const HEAT_CELL = 32;
const HEAT_GAP = 6;
const HEAT_LABEL_W = 40;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Heatmap({ items, from, to, ooo, onSelectDay }) {
  const oooSet = useMemo(() => new Set(ooo || []), [ooo]);
  const { weeks, max } = useMemo(() => {
    const counts = {};
    const ah = {};
    (items || []).forEach((i) => {
      if (!i.completedISO) return;
      counts[i.completedISO] = (counts[i.completedISO] || 0) + 1;
      if (i.afterHours) ah[i.completedISO] = (ah[i.completedISO] || 0) + 1;
    });
    const cols = [];
    let highest = 0;
    let prevMonth = null;
    let cursor = weekStartOf(from);
    while (cursor <= to || new Date(cursor + 'T12:00:00').getDay() !== 0) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(cursor, d);
        const c = counts[day] || 0;
        if (c > highest) highest = c;
        col.push({ day, count: c, ah: ah[day] || 0, inRange: day >= from && day <= to, ooo: oooSet.has(day) });
      }
      const monthDate = new Date(cursor + 'T12:00:00');
      const month = monthDate.getMonth();
      const monthLabel = month !== prevMonth ? monthDate.toLocaleDateString(undefined, { month: 'long' }) : '';
      prevMonth = month;
      cols.push({ key: cursor, days: col, monthLabel });
      cursor = addDays(cursor, 7);
      if (cols.length > 70) break;
    }
    return { weeks: cols, max: highest };
  }, [items, from, to, oooSet]);

  const cell = (c) => {
    if (!c.inRange) return 'transparent';
    if (c.ooo) return 'rgba(0,200,150,0.18)';
    if (c.count === 0) return 'rgba(255,255,255,0.06)';
    const ratio = max > 0 ? c.count / max : 0;
    return `rgba(124,77,255,${0.3 + 0.6 * ratio})`;
  };

  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box sx={{ display: 'flex', gap: `${HEAT_GAP}px`, ml: `${HEAT_LABEL_W}px`, mb: 0.5 }}>
        {weeks.map((w) => (
          <Typography key={w.key} variant="caption" color="text.secondary" sx={{ width: HEAT_CELL, fontSize: 11, whiteSpace: 'nowrap', overflow: 'visible' }}>{w.monthLabel}</Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: `${HEAT_GAP}px` }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${HEAT_GAP}px`, width: HEAT_LABEL_W, flexShrink: 0 }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ height: HEAT_CELL, lineHeight: `${HEAT_CELL}px`, fontSize: 11 }}>{d}</Typography>
          ))}
        </Box>
        {weeks.map((w) => (
          <Box key={w.key} sx={{ display: 'flex', flexDirection: 'column', gap: `${HEAT_GAP}px` }}>
            {w.days.map((c) => (
              <Box key={c.day}
                onClick={() => c.inRange && c.count > 0 && onSelectDay?.(c.day)}
                title={c.inRange ? `${c.day}: ${c.count} completed${c.ah ? ` (${c.ah} after-hours)` : ''}${c.ooo ? ' · out of office' : ''}` : undefined}
                sx={{ width: HEAT_CELL, height: HEAT_CELL, borderRadius: '4px', bgcolor: cell(c), cursor: c.inRange && c.count > 0 ? 'pointer' : 'default', pointerEvents: c.inRange ? 'auto' : 'none', border: c.inRange && c.ooo ? '1px dashed rgba(0,200,150,0.8)' : 'none', outline: c.inRange && c.ah ? '2px solid rgba(255,214,0,0.9)' : 'none', outlineOffset: '-2px', transition: 'transform 0.08s', '&:hover': c.inRange && c.count > 0 ? { transform: 'scale(1.15)' } : {} }} />
            ))}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, ml: `${HEAT_LABEL_W}px` }}>
        <Typography variant="caption" color="text.secondary">Less</Typography>
        {[0.06, 0.35, 0.55, 0.75, 0.9].map((a, i) => (
          <Box key={i} sx={{ width: 13, height: 13, borderRadius: '3px', bgcolor: i === 0 ? 'rgba(255,255,255,0.06)' : `rgba(124,77,255,${a})` }} />
        ))}
        <Typography variant="caption" color="text.secondary">More</Typography>
        <Box sx={{ width: 13, height: 13, borderRadius: '3px', ml: 1.5, outline: '2px solid rgba(255,214,0,0.9)', outlineOffset: '-2px' }} />
        <Typography variant="caption" color="text.secondary">after-hours</Typography>
        <Box sx={{ width: 13, height: 13, borderRadius: '3px', ml: 1.5, bgcolor: 'rgba(0,200,150,0.18)', border: '1px dashed rgba(0,200,150,0.8)' }} />
        <Typography variant="caption" color="text.secondary">out of office</Typography>
      </Box>
    </Box>
  );
}

function DrillDialog({ drill, onClose }) {
  return (
    <Dialog open={!!drill} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {drill?.title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {drill?.content ? drill.content : drill?.items?.length ? (
          <List dense>
            {drill.items.map((it) => (
              <ListItem key={it.id} disableGutters secondaryAction={it.afterHours ? <Chip label="after-hours" size="small" color="warning" variant="outlined" /> : null}>
                <ListItemText
                  primary={it.externalUrl ? <Link href={it.externalUrl} target="_blank" rel="noreferrer">{it.title}</Link> : it.title}
                  secondary={[it.project, it.completedAt && new Date(it.completedAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        ) : <Typography variant="body2" color="text.secondary">No detail recorded.</Typography>}
      </DialogContent>
    </Dialog>
  );
}

// Plain-English readout of the slice, good for pasting into a standup/update.
function buildNarrative(s, weekly) {
  const stratPct = s.totalCompleted ? Math.round((s.strategicItems / s.totalCompleted) * 100) : 0;
  const parts = [
    `Completed ${s.totalCompleted} items (${s.avgItemsPerWeek}/wk), with ${s.totalMeetingHours}h in meetings and ~${s.totalFocusHours}h of focus time.`,
    `Strategic work was ${stratPct}% of output; ${s.afterHoursItems} item${s.afterHoursItems === 1 ? '' : 's'} landed after hours.`,
  ];
  if (weekly?.meetingHrs?.length) {
    let mi = 0;
    weekly.meetingHrs.forEach((h, i) => { if (h > weekly.meetingHrs[mi]) mi = i; });
    if (weekly.meetingHrs[mi] > 0) parts.push(`Heaviest meeting week: ${weekly.labels[mi]} (${weekly.meetingHrs[mi]}h).`);
  }
  return parts.join(' ');
}

// ── page ─────────────────────────────────────────────────────────────────--
export default function LiveDashboard() {
  const [preset, setPreset] = useState(30);
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(todayStr());
  const [drill, setDrill] = useState(null);
  const [toast, setToast] = useState(null);
  const exportRef = useRef(null);

  const len = Math.max(1, daysBetween(fromDate, toDate) + 1);
  const priorTo = addDays(fromDate, -1);
  const priorFrom = addDays(priorTo, -(len - 1));

  const { data, isLoading } = useTrends({ from: fromDate, to: toDate });
  const dataStart = data?.dataStart || null;
  // Only compare against a prior window fully within the available data, so
  // deltas near the start of history aren't measured against empty time.
  const { data: prior } = useTrends({ from: priorFrom, to: priorTo, enabled: !!(dataStart && priorFrom >= dataStart) });

  // Project momentum tolerates a partial prior window (clamped to the start of
  // history) and compares per-week rates, so it still shows before a full
  // equal-length prior period exists. When the full window fits, this matches
  // `prior` exactly and react-query dedupes the request.
  const momPriorTo = priorTo;
  const momPriorFrom = dataStart && priorFrom < dataStart ? dataStart : priorFrom;
  const momPriorDays = daysBetween(momPriorFrom, momPriorTo) + 1;
  const { data: momPrior } = useTrends({
    from: momPriorFrom,
    to: momPriorTo,
    enabled: !!(dataStart && momPriorFrom >= dataStart && momPriorFrom <= momPriorTo && momPriorDays >= 7),
  });

  // Hard floor: never let the range reach before the earliest task data.
  const clampFrom = (iso) => (dataStart && iso < dataStart ? dataStart : iso);
  const applyPreset = (e, v) => {
    if (!v || !PRESET_FROM[v]) return;
    setPreset(v);
    setFromDate(clampFrom(PRESET_FROM[v]()));
    setToDate(todayStr());
  };
  const onDate = (field, value) => { setPreset(null); if (field === 'from') setFromDate(clampFrom(value)); else setToDate(value); };

  const weekly = useMemo(() => {
    if (!data) return null;
    const keys = Array.from(new Set([
      ...Object.keys(data.weeklyCompletions || {}),
      ...Object.keys(data.weeklyMeetingMinutes || {}),
      ...Object.keys(data.weeklyFocusMinutes || {}),
    ])).sort();
    const stratByWeek = {};
    const totalByWeek = {};
    const ahByWeek = {};
    (data.items || []).forEach((i) => {
      if (!i.completedISO) return;
      const w = weekStartOf(i.completedISO);
      totalByWeek[w] = (totalByWeek[w] || 0) + 1;
      if (i.type === 'strategic') stratByWeek[w] = (stratByWeek[w] || 0) + 1;
      if (i.afterHours) ahByWeek[w] = (ahByWeek[w] || 0) + 1;
    });
    return {
      labels: keys.map(fmtDay),
      items: keys.map((k) => data.weeklyCompletions?.[k] || 0),
      meetingHrs: keys.map((k) => round1((data.weeklyMeetingMinutes?.[k] || 0) / 60)),
      focusHrs: keys.map((k) => round1((data.weeklyFocusMinutes?.[k] || 0) / 60)),
      stratPct: keys.map((k) => (totalByWeek[k] ? Math.round(((stratByWeek[k] || 0) / totalByWeek[k]) * 100) : 0)),
      afterHours: keys.map((k) => ahByWeek[k] || 0),
    };
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.typeBreakdown || {}).sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ id: type, value, label: TYPE_LABELS[type] || type, color: TYPE_COLORS[type] || '#90A4AE' }));
  }, [data]);

  const projects = useMemo(() => {
    if (!data) return { names: [], counts: [], colors: [] };
    const top = Object.entries(data.projectBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).reverse();
    return {
      names: top.map(([name]) => name),
      counts: top.map(([, c]) => c),
      colors: top.map(([name]) => data.projectColors?.[name] || STRATEGIC_COLOR),
    };
  }, [data]);

  const ctx = useMemo(() => {
    if (!data) return { labels: [], switches: [], days: [] };
    const entries = Object.entries(data.contextTimeline || {}).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: entries.map(([d]) => fmtDay(d)),
      switches: entries.map(([, v]) => v.switches || 0),
      days: entries,
    };
  }, [data]);

  const tallies = useMemo(() => {
    if (!data) return [];
    return TALLY_CATEGORIES.map((c) => ({ ...c, count: data.tallyTotals?.[c.key] || 0 }))
      .filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  }, [data]);

  // When work actually gets done — completions by weekday and by part of day.
  const rhythm = useMemo(() => {
    const byDow = {};
    const byPart = PARTS_OF_DAY.map(() => 0);
    (data?.items || []).forEach((i) => {
      if (i.completedISO) {
        const wd = new Date(`${i.completedISO}T12:00:00`).getDay();
        byDow[wd] = (byDow[wd] || 0) + 1;
      }
      if (i.completedAt) {
        const h = new Date(i.completedAt).getHours();
        const idx = PARTS_OF_DAY.findIndex((p) => p.test(h));
        if (idx >= 0) byPart[idx] += 1;
      }
    });
    const dowCounts = DOW_ORDER.map((d) => byDow[d] || 0);
    return {
      dowCounts,
      partCounts: byPart,
      hasData: dowCounts.some((n) => n > 0),
    };
  }, [data]);

  // Which projects sped up or slowed down vs the prior period, compared as
  // items/week so a shorter prior window (near the start of history) is fair.
  const momentum = useMemo(() => {
    if (!data) return { hasPrior: false, rows: [] };
    const curr = data.projectBreakdown || {};
    const prev = momPrior?.projectBreakdown || null;
    if (!prev) return { hasPrior: false, rows: [] };
    const currWeeks = Math.max(1, len) / 7;
    const prevWeeks = Math.max(1, momPriorDays) / 7;
    const names = Array.from(new Set([...Object.keys(curr), ...Object.keys(prev)]));
    const rows = names
      .map((name) => {
        const currRate = (curr[name] || 0) / currWeeks;
        const prevRate = (prev[name] || 0) / prevWeeks;
        return { name, curr: curr[name] || 0, currRate, prevRate, delta: currRate - prevRate };
      })
      .filter((r) => r.currRate > 0 || r.prevRate > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 8);
    return { hasPrior: true, rows };
  }, [data, momPrior, len, momPriorDays]);

  const openType = (e, item) => {
    const d = pieData[item?.dataIndex];
    if (d) setDrill({ title: `${d.label} — ${d.value} items`, items: data.typeDetails?.[d.id] || [] });
  };
  const openProject = (e, item) => {
    const name = projects.names[item?.dataIndex];
    if (name) setDrill({ title: `${name} — ${data.projectBreakdown[name]} items`, items: data.projectDetails?.[name] || [] });
  };
  const openDay = (day) => {
    const dayItems = (data.items || [])
      .filter((i) => i.completedISO === day)
      .map((i, idx) => ({ ...i, id: `${day}-${idx}` }));
    setDrill({ title: `${fmtDay(day)} — ${dayItems.length} completed`, items: dayItems });
  };
  const openTally = (c) => {
    const notes = (data.tallyDetails?.[c.key] || []).filter((e) => e.note);
    setDrill({ title: `${c.emoji} ${c.label} — ${c.count}`, items: notes.map((e, i) => ({ id: c.key + i, title: e.note, completedAt: `${e.date}T12:00:00` })) });
  };
  const openSwitches = (e, item) => {
    const entry = ctx.days[item?.dataIndex];
    if (!entry) return;
    const [date, v] = entry;
    const sequence = v.sequence || [];
    const content = (
      <Stack spacing={2}>
        {sequence.length > 0 ? (
          <Box>
            <Typography variant="caption" color="text.secondary">What you switched between</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
              {sequence.map((label, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {i > 0 && <Typography variant="caption" sx={{ color: 'text.disabled' }}>→</Typography>}
                  <Chip size="small" variant="outlined" label={label} />
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No work/meeting sequence recorded this day.</Typography>
        )}
        {(v.tallySwitches || 0) > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Non-task yanks · {v.tallySwitches} total
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
              {Object.entries(v.tallyBreakdown || {})
                .sort((a, b) => b[1].count - a[1].count)
                .map(([key, b]) => {
                  const meta = TALLY_CATEGORIES.find((c) => c.key === key);
                  const times = (b.entries || [])
                    .filter((e) => e.ts)
                    .map((e) => new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
                  return (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 0 }}>
                        {meta?.emoji || '⚡'} {meta?.label || key}
                        <Typography component="span" variant="body2" color="text.secondary"> · {b.count}</Typography>
                      </Typography>
                      {times.length > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {times.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              {/* Notes, when present, add the qualitative "why" under the times. */}
              {Object.entries(v.tallyBreakdown || {}).flatMap(([key, b]) =>
                (b.entries || []).filter((e) => e.note).map((e, i) => {
                  const meta = TALLY_CATEGORIES.find((c) => c.key === key);
                  return (
                    <Typography key={`${key}-${i}`} variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                      “{e.note}” — {meta?.label || key}
                      {e.ts ? ` (${new Date(e.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : ''}
                    </Typography>
                  );
                })
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    );
    setDrill({
      title: `${fmtDay(date)} — ${v.switches} switch${v.switches === 1 ? '' : 'es'}`,
      content,
    });
  };

  const copySummary = async () => {
    const s = data.summary;
    const md = [
      `# Workload readout (${fromDate} → ${toDate})`, ``,
      `- **Completed items:** ${s.totalCompleted} (${s.avgItemsPerWeek}/wk avg)`,
      `- **Meeting hours:** ${s.totalMeetingHours}h across ${s.totalMeetings} meetings`,
      `- **Focus hours:** ${s.totalFocusHours}h (${s.avgFocusHoursPerWeek}h/wk avg)`,
      `- **After-hours items:** ${s.afterHoursItems}`,
      `- **Context switches:** ${s.contextSwitches} (${s.avgSwitchesPerDay}/day)`, ``,
      `## Type mix`, ...pieData.map((d) => `- ${d.label}: ${d.value}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(md); setToast('Summary copied to clipboard'); } catch { setToast('Clipboard blocked by browser'); }
  };

  const exportPng = async () => {
    if (!exportRef.current) return;
    try {
      const bg = getComputedStyle(document.body).backgroundColor || '#0b0b10';
      // skipFonts avoids trying to inline cross-origin (Google Fonts) stylesheets,
      // which throws CORS errors; the canvas still captures the already-rendered text.
      const dataUrl = await toPng(exportRef.current, { backgroundColor: bg, pixelRatio: 2, skipFonts: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `devfocus-dashboard-${fromDate}_${toDate}.png`;
      a.click();
      setToast('Dashboard exported as PNG');
    } catch { setToast('PNG export failed'); }
  };

  if (isLoading || !data) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

  const s = data.summary;
  const ps = prior?.summary;
  const narrative = buildNarrative(s, weekly);
  const activePreset = PRESETS.find((p) => p.value === preset) || null;
  const rangeCapped = !!(activePreset && clampFrom(activePreset.from()) !== activePreset.from());

  // Meeting load as a share of actual working time. focus + meeting ≈ the
  // workday capacity (focus is already workday minus meetings/OOO), so this
  // reads as "how much of your available time went to meetings."
  const workHours = round1(s.totalMeetingHours + s.totalFocusHours);
  const meetingPct = workHours > 0 ? Math.round((s.totalMeetingHours / workHours) * 100) : 0;
  const focusPct = workHours > 0 ? 100 - meetingPct : 0;

  // Auto-detected, skimmable facts about the slice.
  const callouts = [];
  if (rhythm.hasData) {
    const maxDow = Math.max(...rhythm.dowCounts);
    if (maxDow > 0) callouts.push(`${DOW_LABELS[rhythm.dowCounts.indexOf(maxDow)]} is your most productive day`);
    const maxPart = Math.max(...rhythm.partCounts);
    if (maxPart > 0) callouts.push(`Most work happens in the ${PARTS_OF_DAY[rhythm.partCounts.indexOf(maxPart)].label.toLowerCase()}`);
  }
  if (weekly?.items?.length) {
    const maxWk = Math.max(...weekly.items);
    if (maxWk > 0) callouts.push(`Busiest week: ${weekly.labels[weekly.items.indexOf(maxWk)]} (${maxWk} items)`);
  }
  if (s.totalCompleted > 0 && s.afterHoursItems > 0) {
    callouts.push(`${Math.round((s.afterHoursItems / s.totalCompleted) * 100)}% of items finished after-hours`);
  }
  if (workHours > 0) callouts.push(`Meetings = ${meetingPct}% of working hours`);
  if (s.oooDays > 0) callouts.push(`${s.oooDays} day${s.oooDays === 1 ? '' : 's'} out of office`);

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Live Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Workload readout — completed work, meeting load, focus time, and where effort goes.
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>Showing</Typography>
            <Chip size="small" label={`${fmtDay(fromDate)} → ${fmtDay(toDate)}`}
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', bgcolor: 'action.selected' }} />
            <Chip size="small" variant="outlined" label={`${len} ${len === 1 ? 'day' : 'days'}`} />
            {activePreset && <Chip size="small" variant="outlined" color="primary" label={activePreset.title} />}
            {rangeCapped && (
              <Chip size="small" variant="outlined" color="warning" label="capped at history start"
                title={`Your task history begins ${fmtDay(dataStart)}, so the range can't reach earlier.`} />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copySummary}>Copy summary</Button>
          <Button size="small" variant="outlined" startIcon={<ImageIcon />} onClick={exportPng}>PNG</Button>
          <ToggleButtonGroup value={preset} exclusive onChange={applyPreset} size="small">
            {PRESETS.map((p) => (
              <ToggleButton key={p.value} value={p.value} title={p.title}>{p.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField type="date" size="small" label="From" value={fromDate}
            onChange={(e) => onDate('from', e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: dataStart || undefined, max: toDate } }} sx={{ width: 150 }} />
          <TextField type="date" size="small" label="To" value={toDate}
            onChange={(e) => onDate('to', e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: dataStart || undefined, max: todayStr() } }} sx={{ width: 150 }} />
          {dataStart && <Typography variant="caption" color="text.secondary">history begins {fmtDay(dataStart)}</Typography>}
        </Stack>
      </Box>

      <Box ref={exportRef} sx={{ bgcolor: 'background.default' }}>
        <Card sx={{ mb: 2, borderLeft: '3px solid', borderColor: 'primary.main' }}>
          <CardContent sx={{ py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
            <Typography variant="body2">{narrative}</Typography>
            {callouts.length > 0 && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {callouts.map((c) => (
                  <Chip key={c} size="small" variant="outlined" label={c} sx={{ fontWeight: 500 }} />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <StatCard label="Completed items" value={s.totalCompleted} curr={s.totalCompleted} prev={ps?.totalCompleted} sub={`${s.avgItemsPerWeek}/wk avg`} trend={weekly.items} />
          <StatCard label="Meeting hours" value={`${s.totalMeetingHours}h`} color={MEETING_COLOR} curr={s.totalMeetingHours} prev={ps?.totalMeetingHours} invert sub={`${s.totalMeetings} meetings`} trend={weekly.meetingHrs} />
          <StatCard label="Focus hours" value={`${s.totalFocusHours}h`} color={EXEC_COLOR} curr={s.totalFocusHours} prev={ps?.totalFocusHours} sub={`${s.avgFocusHoursPerWeek}h/wk avg`} trend={weekly.focusHrs} />
          <StatCard label="After-hours items" value={s.afterHoursItems} color="#F44336" curr={s.afterHoursItems} prev={ps?.afterHoursItems} invert sub="lower is better" trend={weekly.afterHours} />
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Panel title="Throughput vs meeting load" subtitle="Completed items (bars) against meeting hours (line), by week.">
            <ResponsiveChartContainer height={300}
              xAxis={[{ scaleType: 'band', data: weekly.labels }]}
              yAxis={[{ id: 'items' }, { id: 'mh' }]}
              series={[
                { type: 'bar', data: weekly.items, label: 'Items', color: STRATEGIC_COLOR, yAxisId: 'items' },
                { type: 'line', data: weekly.meetingHrs, label: 'Meeting hrs', color: MEETING_COLOR, yAxisId: 'mh', curve: 'monotoneX' },
              ]}
              margin={{ left: 40, right: 44, top: 10, bottom: 30 }}>
              <BarPlot />
              <LinePlot />
              <MarkPlot />
              <ChartsXAxis />
              <ChartsYAxis axisId="items" />
              <ChartsYAxis axisId="mh" position="right" />
              <ChartsTooltip />
            </ResponsiveChartContainer>
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
              <LegendDot color={STRATEGIC_COLOR} label="Items (bars)" />
              <LegendDot color={MEETING_COLOR} label="Meeting hrs (line)" line />
            </Stack>
          </Panel>

          <Panel title="Meetings vs focus (hours/week)" subtitle="Stacked weekly hours — meeting load against estimated focus time.">
            {workHours > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                  <Box sx={{ width: `${meetingPct}%`, bgcolor: MEETING_COLOR }} title={`Meetings · ${s.totalMeetingHours}h`} />
                  <Box sx={{ width: `${focusPct}%`, bgcolor: EXEC_COLOR }} title={`Focus · ${s.totalFocusHours}h`} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Meetings take <strong>{meetingPct}%</strong> of your working hours · focus {focusPct}%
                </Typography>
              </Box>
            )}
            <BarChart height={272} xAxis={[{ scaleType: 'band', data: weekly.labels }]}
              series={[
                { data: weekly.meetingHrs, label: 'Meeting hrs', color: MEETING_COLOR, stack: 'h' },
                { data: weekly.focusHrs, label: 'Focus hrs', color: EXEC_COLOR, stack: 'h' },
              ]}
              slotProps={BOTTOM_LEGEND} margin={{ left: 40, right: 10, top: 10, bottom: 55 }} />
          </Panel>

          <Panel title="Strategic share over time" subtitle="Percent of completed items that were strategic work, by week.">
            <LineChart height={300} xAxis={[{ scaleType: 'point', data: weekly.labels }]} yAxis={[{ min: 0, max: 100 }]}
              series={[{ data: weekly.stratPct, label: 'Strategic %', color: STRATEGIC_COLOR, area: true, showMark: true }]}
              slotProps={BOTTOM_LEGEND} margin={{ left: 40, right: 10, top: 10, bottom: 55 }} />
          </Panel>

          <Panel title="Type mix" subtitle="Completed items by work type. Click a slice or legend item to see them.">
            <PieChart height={240} onItemClick={openType}
              slotProps={{ legend: { hidden: true } }}
              margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
              series={[{ data: pieData, innerRadius: 55, paddingAngle: 2, cornerRadius: 4, highlightScope: { faded: 'global', highlighted: 'item' } }]} />
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ mt: 1 }}>
              {pieData.map((d) => (
                <Box key={d.id} onClick={() => setDrill({ title: `${d.label} — ${d.value} items`, items: data.typeDetails?.[d.id] || [] })}
                  sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
                  <LegendDot color={d.color} label={`${d.label} · ${d.value}`} />
                </Box>
              ))}
            </Stack>
          </Panel>

          <Panel title="Context switches" subtitle={`${s.contextSwitches} total · ${s.avgSwitchesPerDay}/day avg. Lower is calmer. Click a bar to see the switches.`}>
            {ctx.labels.length ? (
              <BarChart height={300} xAxis={[{ scaleType: 'band', data: ctx.labels }]}
                series={[{ data: ctx.switches, label: 'Switches', color: SWITCH_COLOR }]}
                onItemClick={openSwitches}
                slotProps={BOTTOM_LEGEND} margin={{ left: 40, right: 10, top: 10, bottom: 55 }} />
            ) : <Typography variant="body2" color="text.secondary">No activity to derive switches.</Typography>}
          </Panel>

          <Panel title="Where the day went" subtitle="Non-task tallies (interruptions, firefighting, etc.). Click one to read the notes.">
            {tallies.length ? (
              <Stack spacing={0.25}>
                {tallies.map((c) => (
                  <Box key={c.key} onClick={() => openTally(c)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', p: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Typography>{c.emoji}</Typography>
                    <Typography variant="body2" sx={{ flex: 1 }}>{c.label}</Typography>
                    <Chip label={c.count} size="small" />
                  </Box>
                ))}
              </Stack>
            ) : <Typography variant="body2" color="text.secondary">No tallies logged in this range.</Typography>}
          </Panel>

          <Panel title="By day of week" subtitle="Which days you complete the most work, across the range.">
            {rhythm.hasData ? (
              <BarChart height={300} xAxis={[{ scaleType: 'band', data: DOW_LABELS }]}
                series={[{ data: rhythm.dowCounts, label: 'Items', color: STRATEGIC_COLOR }]}
                slotProps={{ legend: { hidden: true } }} margin={{ left: 40, right: 10, top: 10, bottom: 30 }} />
            ) : <Typography variant="body2" color="text.secondary">No completed items in this range.</Typography>}
          </Panel>

          <Panel title="By time of day" subtitle="When work gets done (local clock time).">
            {rhythm.hasData ? (
              <BarChart height={300} xAxis={[{ scaleType: 'band', data: PARTS_OF_DAY.map((p) => p.label) }]}
                series={[{ data: rhythm.partCounts, label: 'Items', color: EXEC_COLOR }]}
                slotProps={{ legend: { hidden: true } }} margin={{ left: 40, right: 10, top: 10, bottom: 30 }} />
            ) : <Typography variant="body2" color="text.secondary">No completed items in this range.</Typography>}
          </Panel>

          <Panel title="Project momentum" subtitle="Speeding up or slowing down vs the prior period (items/week).">
            {!momentum.hasPrior ? (
              <Typography variant="body2" color="text.secondary">Need at least a week of earlier history to compare. Try a shorter range, or check back as more history builds up.</Typography>
            ) : momentum.rows.length ? (
              <Stack spacing={0.25}>
                {momentum.rows.map((r) => {
                  const isNew = r.prevRate === 0 && r.currRate > 0;
                  const gone = r.currRate === 0 && r.prevRate > 0;
                  const up = r.delta > 0;
                  const flat = Math.abs(r.delta) < 0.05;
                  const color = flat ? 'text.secondary' : up ? 'success.main' : 'error.main';
                  return (
                    <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5 }}>
                      <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }} title="items per week: prior → current">{round1(r.prevRate)} → {round1(r.currRate)}/wk</Typography>
                      <Box sx={{ width: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color, fontWeight: 600 }}>
                        {isNew ? <Chip label="new" size="small" color="success" variant="outlined" />
                          : gone ? <Chip label="gone" size="small" variant="outlined" />
                          : flat ? <Typography variant="caption" color="text.secondary">flat</Typography>
                          : (
                            <Typography component="span" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', color, fontWeight: 700 }}>
                              {up ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
                              {round1(Math.abs(r.delta))}
                            </Typography>
                          )}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            ) : <Typography variant="body2" color="text.secondary">No project data for this range.</Typography>}
          </Panel>

          <Panel title="Top projects" subtitle="Completed items by project. Click a bar to see the items.">
            {projects.names.length ? (
              <BarChart height={Math.max(180, projects.names.length * 38)} layout="horizontal"
                yAxis={[{ scaleType: 'band', data: projects.names }]}
                xAxis={[{ min: 0 }]}
                series={[{ data: projects.counts, label: 'Items' }]}
                onItemClick={openProject}
                colors={projects.colors}
                slotProps={{ legend: { hidden: true } }}
                margin={{ left: 140, right: 10, top: 10, bottom: 30 }} />
            ) : <Typography variant="body2" color="text.secondary">No project data for this range.</Typography>}
          </Panel>

          <Panel title="Activity heatmap" subtitle="Completed items per day. Click a day for its items. Amber ring = after-hours; dashed teal = out of office." span>
            <Heatmap items={data.items} from={fromDate} to={toDate} ooo={data.oooDates} onSelectDay={openDay} />
          </Panel>
        </Box>
      </Box>

      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} message={toast || ''} />
    </Box>
  );
}
