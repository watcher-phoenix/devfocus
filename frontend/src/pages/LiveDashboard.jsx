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
import CloseIcon from '@mui/icons-material/Close';
import { BarChart, BarPlot } from '@mui/x-charts/BarChart';
import { LineChart, LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { ResponsiveChartContainer } from '@mui/x-charts/ResponsiveChartContainer';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
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
// Legend rendered below the plot so it never overlaps the bars/line.
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

const HEAT_CELL = 22;
const HEAT_GAP = 5;
const HEAT_LABEL_W = 34;
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function Heatmap({ items, from, to }) {
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
        col.push({ day, count: c, ah: ah[day] || 0, inRange: day >= from && day <= to });
      }
      // Month label shown above the first column that lands in a new month.
      const monthDate = new Date(cursor + 'T12:00:00');
      const month = monthDate.getMonth();
      const monthLabel = month !== prevMonth ? monthDate.toLocaleDateString(undefined, { month: 'short' }) : '';
      prevMonth = month;
      cols.push({ key: cursor, days: col, monthLabel });
      cursor = addDays(cursor, 7);
      if (cols.length > 70) break;
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
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      {/* Month labels */}
      <Box sx={{ display: 'flex', gap: `${HEAT_GAP}px`, ml: `${HEAT_LABEL_W}px`, mb: 0.5 }}>
        {weeks.map((w) => (
          <Typography key={w.key} variant="caption" color="text.secondary" sx={{ width: HEAT_CELL, fontSize: 11 }}>{w.monthLabel}</Typography>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: `${HEAT_GAP}px` }}>
        {/* Weekday labels */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${HEAT_GAP}px`, width: HEAT_LABEL_W, flexShrink: 0 }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <Typography key={i} variant="caption" color="text.secondary" sx={{ height: HEAT_CELL, lineHeight: `${HEAT_CELL}px`, fontSize: 11 }}>{d}</Typography>
          ))}
        </Box>
        {weeks.map((w) => (
          <Box key={w.key} sx={{ display: 'flex', flexDirection: 'column', gap: `${HEAT_GAP}px` }}>
            {w.days.map((c) => (
              <Box key={c.day}
                title={`${c.day}: ${c.count} completed${c.ah ? ` (${c.ah} after-hours)` : ''}`}
                sx={{ width: HEAT_CELL, height: HEAT_CELL, borderRadius: '4px', bgcolor: cell(c), outline: c.ah ? '2px solid rgba(255,214,0,0.9)' : 'none', outlineOffset: '-2px' }} />
            ))}
          </Box>
        ))}
      </Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, ml: `${HEAT_LABEL_W}px` }}>
        <Typography variant="caption" color="text.secondary">Less</Typography>
        {[0.06, 0.35, 0.55, 0.75, 0.9].map((a, i) => (
          <Box key={i} sx={{ width: 13, height: 13, borderRadius: '3px', bgcolor: i === 0 ? 'rgba(255,255,255,0.06)' : `rgba(124,77,255,${a})` }} />
        ))}
        <Typography variant="caption" color="text.secondary">More</Typography>
        <Box sx={{ width: 13, height: 13, borderRadius: '3px', ml: 1.5, outline: '2px solid rgba(255,214,0,0.9)', outlineOffset: '-2px' }} />
        <Typography variant="caption" color="text.secondary">after-hours</Typography>
      </Box>
    </Box>
  );
}

// Drill-down dialog: a clicked chart segment lists the items behind it.
function DrillDialog({ drill, onClose }) {
  return (
    <Dialog open={!!drill} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {drill?.title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {drill?.items?.length ? (
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
        ) : <Typography variant="body2" color="text.secondary">No items.</Typography>}
      </DialogContent>
    </Dialog>
  );
}

// ── page ─────────────────────────────────────────────────────────────────--
export default function LiveDashboard() {
  const [preset, setPreset] = useState(30);
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(todayStr());
  const [drill, setDrill] = useState(null);
  const [copied, setCopied] = useState(false);

  const len = Math.max(1, daysBetween(fromDate, toDate) + 1);
  const priorTo = addDays(fromDate, -1);
  const priorFrom = addDays(priorTo, -(len - 1));

  const { data, isLoading } = useTrends({ from: fromDate, to: toDate });
  const { data: prior } = useTrends({ from: priorFrom, to: priorTo });

  const applyPreset = (e, v) => { if (!v) return; setPreset(v); setFromDate(daysAgo(v)); setToDate(todayStr()); };
  const onDate = (field, value) => { setPreset(null); if (field === 'from') setFromDate(value); else setToDate(value); };

  const weekly = useMemo(() => {
    if (!data) return null;
    const keys = Array.from(new Set([
      ...Object.keys(data.weeklyCompletions || {}),
      ...Object.keys(data.weeklyMeetingMinutes || {}),
      ...Object.keys(data.weeklyFocusMinutes || {}),
    ])).sort();
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
    return Object.entries(data.typeBreakdown || {}).sort((a, b) => b[1] - a[1])
      .map(([type, value]) => ({ id: type, value, label: TYPE_LABELS[type] || type, color: TYPE_COLORS[type] || '#90A4AE' }));
  }, [data]);

  // Top projects by completed-item count (horizontal bar).
  const projects = useMemo(() => {
    if (!data) return { names: [], counts: [], colors: [] };
    const top = Object.entries(data.projectBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).reverse();
    return {
      names: top.map(([name]) => name),
      counts: top.map(([, c]) => c),
      colors: top.map(([name]) => data.projectColors?.[name] || STRATEGIC_COLOR),
    };
  }, [data]);

  const openType = (e, item) => {
    const d = pieData[item?.dataIndex];
    if (d) setDrill({ title: `${d.label} — ${d.value} items`, items: data.typeDetails?.[d.id] || [] });
  };
  const openProject = (e, item) => {
    const name = projects.names[item?.dataIndex];
    if (name) setDrill({ title: `${name} — ${data.projectBreakdown[name]} items`, items: data.projectDetails?.[name] || [] });
  };

  const copySummary = async () => {
    const s = data.summary;
    const md = [
      `# Workload readout (${fromDate} → ${toDate})`,
      ``,
      `- **Completed items:** ${s.totalCompleted} (${s.avgItemsPerWeek}/wk avg)`,
      `- **Meeting hours:** ${s.totalMeetingHours}h across ${s.totalMeetings} meetings`,
      `- **Focus hours:** ${s.totalFocusHours}h (${s.avgFocusHoursPerWeek}h/wk avg)`,
      `- **After-hours items:** ${s.afterHoursItems}`,
      `- **Context switches:** ${s.contextSwitches} (${s.avgSwitchesPerDay}/day)`,
      ``,
      `## Type mix`,
      ...pieData.map((d) => `- ${d.label}: ${d.value}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(md); setCopied(true); } catch { /* clipboard blocked */ }
  };

  if (isLoading || !data) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

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
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copySummary}>Copy summary</Button>
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

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <StatCard label="Completed items" value={s.totalCompleted} curr={s.totalCompleted} prev={ps?.totalCompleted} sub={`${s.avgItemsPerWeek}/wk avg`} />
        <StatCard label="Meeting hours" value={`${s.totalMeetingHours}h`} color={MEETING_COLOR} curr={s.totalMeetingHours} prev={ps?.totalMeetingHours} invert sub={`${s.totalMeetings} meetings`} />
        <StatCard label="Focus hours" value={`${s.totalFocusHours}h`} color={EXEC_COLOR} curr={s.totalFocusHours} prev={ps?.totalFocusHours} sub={`${s.avgFocusHoursPerWeek}h/wk avg`} />
        <StatCard label="After-hours items" value={s.afterHoursItems} color="#F44336" curr={s.afterHoursItems} prev={ps?.afterHoursItems} invert sub="lower is better" />
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
          <BarChart height={300} xAxis={[{ scaleType: 'band', data: weekly.labels }]}
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

        <Panel title="Type mix" subtitle="Completed items by work type. Click a slice to see the items.">
          <PieChart height={300} onItemClick={openType}
            series={[{ data: pieData, innerRadius: 55, paddingAngle: 2, cornerRadius: 4, highlightScope: { faded: 'global', highlighted: 'item' } }]} />
        </Panel>

        <Panel title="Top projects" subtitle="Completed items by project. Click a bar to see the items." span>
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

        <Panel title="Activity heatmap" subtitle="Completed items per day. Amber ring = after-hours work." span>
          <Heatmap items={data.items} from={fromDate} to={toDate} />
        </Panel>
      </Box>

      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
      <Snackbar open={copied} autoHideDuration={2500} onClose={() => setCopied(false)} message="Summary copied to clipboard" />
    </Box>
  );
}
