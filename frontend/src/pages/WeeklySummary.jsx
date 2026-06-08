import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import DownloadIcon from '@mui/icons-material/Download';
import { useTrends } from '../api/trends';
import { TYPE_LABELS, TYPE_COLORS } from '../constants/workTypes';
import { exportTrendsCSV, exportReportHTML } from '../utils/exportReport';
import ContextualHint from '../components/ContextualHint';

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-CA');
}

function formatDisplay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatRow({ label, value, subtitle }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </Box>
    </Box>
  );
}

export default function WeeklySummary() {
  const [week, setWeek] = useState('this');
  const [mode, setMode] = useState('personal');

  const { monday, friday, label } = useMemo(() => {
    const today = new Date();
    const mon = getMonday(today);
    if (week === 'last') mon.setDate(mon.getDate() - 7);
    const fri = new Date(mon);
    fri.setDate(fri.getDate() + 4);
    return {
      monday: mon,
      friday: fri,
      label: `${formatDisplay(mon)} - ${formatDisplay(fri)}`,
    };
  }, [week]);

  const { data, isLoading } = useTrends({ from: formatDate(monday), to: formatDate(friday) });
  const summary = data?.summary || {};
  const typeBreakdown = data?.typeBreakdown || {};
  const projectBreakdown = data?.projectBreakdown || {};
  const projectColors = data?.projectColors || {};
  const isShareable = mode === 'shareable';

  const topTypes = Object.entries(typeBreakdown)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 0);

  const topProjects = Object.entries(projectBreakdown)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 0);

  const maxTypeCount = topTypes.length > 0 ? topTypes[0][1] : 1;
  const maxProjectCount = topProjects.length > 0 ? topProjects[0][1] : 1;

  // Snarky commentary for personal mode
  const itemsSnark = summary.totalCompleted >= 20 ? 'Machine mode.' : summary.totalCompleted >= 10 ? 'Solid week.' : summary.totalCompleted >= 5 ? 'Steady.' : summary.totalCompleted > 0 ? 'Light week.' : 'Ghost mode.';
  const meetingsSnark = summary.totalMeetings >= 15 ? 'RIP your calendar.' : summary.totalMeetings >= 8 ? 'Meeting marathon.' : summary.totalMeetings >= 3 ? 'Manageable.' : summary.totalMeetings > 0 ? 'Breezy.' : 'Meeting-free. Living the dream.';
  const afterHoursSnark = (summary.afterHoursItems || 0) > 0 ? `${summary.afterHoursItems} after-hours item${summary.afterHoursItems !== 1 ? 's' : ''}. Boundaries.` : 'No after-hours work. As it should be.';
  const oooSnark = (summary.oooDays || 0) >= 3 ? 'Real time off. Good.' : (summary.oooDays || 0) > 0 || (summary.oooHours || 0) > 0 ? 'Stepped away.' : 'No time off this week.';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">{isShareable ? 'Weekly Summary' : 'Week in Review'}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup value={week} exclusive onChange={(e, v) => v && setWeek(v)} size="small">
            <ToggleButton value="this">This Week</ToggleButton>
            <ToggleButton value="last">Last Week</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup value={mode} exclusive onChange={(e, v) => v && setMode(v)} size="small">
            <ToggleButton value="personal">Personal</ToggleButton>
            <ToggleButton value="shareable">Shareable</ToggleButton>
          </ToggleButtonGroup>
          {data && (
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportTrendsCSV(data, `summary-${week}-week`)}>
                CSV
              </Button>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportReportHTML(data, { mode, dateRange: label })}>
                Report
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      <ContextualHint hintId="summary-intro">
        Your weekly snapshot. Toggle between personal (snarky) and shareable (1:1-ready) modes.
      </ContextualHint>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {!isLoading && data && (
        <>
          {/* Summary stats */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                {isShareable ? 'Overview' : 'The Numbers'}
              </Typography>
              <StatRow
                label="Items Completed"
                value={summary.totalCompleted || 0}
                subtitle={!isShareable ? itemsSnark : undefined}
              />
              <Divider sx={{ my: 0.5 }} />
              <StatRow
                label="Meetings"
                value={`${summary.totalMeetings || 0} (${summary.totalMeetingHours || 0}h)`}
                subtitle={!isShareable ? meetingsSnark : undefined}
              />
              <Divider sx={{ my: 0.5 }} />
              <StatRow
                label="PRs Reviewed"
                value={summary.prsReviewed || 0}
              />
              {(summary.afterHoursItems > 0 || !isShareable) && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow
                    label="After Hours"
                    value={`${summary.afterHoursItems || 0} items, ${summary.afterHoursMeetings || 0} mtgs`}
                    subtitle={!isShareable ? afterHoursSnark : undefined}
                  />
                </>
              )}
              {(summary.oooDays > 0 || summary.oooHours > 0 || !isShareable) && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <StatRow
                    label="Out of Office"
                    value={`${summary.oooDays || 0} days, ${summary.oooHours || 0}h`}
                    subtitle={!isShareable ? oooSnark : undefined}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Type breakdown */}
          {topTypes.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  {isShareable ? 'Work Breakdown' : 'Where the Time Went'}
                </Typography>
                {topTypes.map(([type, count]) => (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2">{TYPE_LABELS[type] || type}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(count / maxTypeCount) * 100}
                      sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: TYPE_COLORS[type] || '#666', borderRadius: 1 } }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Project breakdown */}
          {topProjects.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  {isShareable ? 'By Project' : 'Project Spread'}
                </Typography>
                {topProjects.map(([project, count]) => (
                  <Box key={project} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={project}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', bgcolor: (projectColors[project] || '#1976d2') + '33', color: projectColors[project] || '#90CAF9' }}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(count / maxProjectCount) * 100}
                      sx={{ height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: projectColors[project] || '#8D6E63', borderRadius: 1 } }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {summary.totalCompleted === 0 && summary.totalMeetings === 0 && (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {isShareable ? 'No activity recorded for this week.' : 'Nothing here. Either you took the week off or forgot to track things.'}
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
