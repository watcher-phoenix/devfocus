import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { useProjects, useCreateProject, useUpdateProject } from '../api/projects';
import { useSettings, useUpdateSettings } from '../api/settings';
import ContextualHint from '../components/ContextualHint';
import {
  useIntegrations,
  useUpdateIntegration,
  useSyncIntegration,
} from '../api/integrations';

const PRESET_COLORS = [
  '#7C4DFF', '#651FFF', '#536DFE', '#304FFE', '#2196F3', '#03A9F4', '#0288D1',
  '#00BCD4', '#009688', '#00897B', '#4CAF50', '#00C853', '#43A047', '#8BC34A',
  '#CDDC39', '#C0CA33', '#FFD600', '#FFC107', '#FFB300', '#FF9800', '#FF5722',
  '#FF5252', '#D32F2F', '#E91E63', '#C2185B', '#F06292', '#CE93D8', '#9C27B0',
  '#7B1FA2', '#6A1B9A', '#795548', '#5D4037', '#607D8B', '#455A64', '#9E9E9E',
  '#616161', '#263238', '#37474F', '#1A237E', '#004D40',
];

// ── Projects Tab ──────────────────────────────────────────────────────────

function ProjectsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: projects = [] } = useProjects(true);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', repoSlug: '', color: '#7C4DFF' });

  const filtered = showArchived ? projects : projects.filter((p) => !p.archived);

  const usedColors = projects
    .filter((p) => p.color && (!editId || p.id !== editId))
    .map((p) => p.color);

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', repoSlug: '', color: '' });
    setDialogOpen(true);
  };

  const openEdit = (project) => {
    setEditId(project.id);
    setForm({ name: project.name, repoSlug: project.repoSlug || '', color: project.color || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await updateProject.mutateAsync({ id: editId, ...form });
    } else {
      await createProject.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const handleArchive = (project) => {
    updateProject.mutate({ id: project.id, archived: !project.archived });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>Projects</Typography>
          <Typography variant="body2" color="text.secondary">
            Map to your repos. Assign work items and snapshots to projects.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}>New</Button>
      </Box>

      <FormControlLabel
        control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} size="small" />}
        label="Show archived"
        sx={{ mb: 2 }}
      />

      <Stack spacing={1}>
        {filtered.map((project) => (
          <Card key={project.id} sx={{ opacity: project.archived ? 0.5 : 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important', '&:last-child': { pb: '12px !important' } }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: project.color || '#666', flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>{project.name}</Typography>
                {project.repoSlug && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{project.repoSlug}</Typography>
                )}
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={() => openEdit(project)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => handleArchive(project)} title={project.archived ? 'Unarchive' : 'Archive'}>
                  {project.archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No projects yet. Create one to organize your work.
          </Typography>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Project' : 'New Project'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth autoFocus placeholder="e.g. CRM Backend, Builder Scraper" />
          <TextField label="Repo slugs (optional)" value={form.repoSlug} onChange={(e) => setForm({ ...form, repoSlug: e.target.value })} fullWidth placeholder="e.g. crm-backend-services, land-crm" helperText="Comma-separated if multiple repos belong to this project" />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Color (optional)</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Box
                onClick={() => setForm({ ...form, color: '' })}
                sx={{ width: 32, height: 32, borderRadius: '50%', border: !form.color ? '3px solid white' : '3px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { border: '3px solid rgba(255,255,255,0.5)' } }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>None</Typography>
              </Box>
              {PRESET_COLORS.map((c) => {
                const isUsed = usedColors.includes(c);
                const usedByProject = isUsed ? projects.find((p) => p.color === c && p.id !== editId) : null;
                return (
                  <Box
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid white' : '3px solid transparent',
                      opacity: isUsed ? 0.4 : 1,
                      '&:hover': { border: '3px solid rgba(255,255,255,0.5)', opacity: 1 },
                      position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={isUsed ? `Used by ${usedByProject?.name || 'another project'}` : ''}
                  >
                    {isUsed && <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>X</Typography>}
                  </Box>
                );
              })}
            </Stack>
            {form.color && usedColors.includes(form.color) && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                This color is already used by {projects.find((p) => p.color === form.color && p.id !== editId)?.name || 'another project'}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>{editId ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Integration Config Card ───────────────────────────────────────────────

function IntegrationCard({ provider, label, description, fields, configHint }) {
  const { data: integrations = [] } = useIntegrations();
  const updateIntegration = useUpdateIntegration();
  const syncIntegration = useSyncIntegration();
  const [configOpen, setConfigOpen] = useState(false);
  const [form, setForm] = useState({});
  const [syncResult, setSyncResult] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState('');
  const [tokenLabel, setTokenLabel] = useState('');

  const integration = integrations.find((i) => i.provider === provider);
  const isConfigured = integration?.config?.configured;
  const isEnabled = integration?.enabled;
  const lastSync = integration?.lastSyncAt;
  const lastStatus = integration?.lastSyncStatus;

  const openConfig = () => {
    const existing = integration?.config || {};
    const initial = {};
    fields.forEach((f) => { initial[f.key] = existing[f.key] || ''; });
    setForm(initial);
    setTokenExpiresAt(integration?.tokenExpiresAt ? integration.tokenExpiresAt.split('T')[0] : '');
    setTokenLabel(integration?.tokenLabel || '');
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    await updateIntegration.mutateAsync({
      provider,
      config: form,
      enabled: true,
      tokenExpiresAt: tokenExpiresAt || null,
      tokenLabel: tokenLabel || null,
    });
    setConfigOpen(false);
  };

  const handleToggle = async () => {
    await updateIntegration.mutateAsync({
      provider,
      enabled: !isEnabled,
    });
  };

  const handleSync = async () => {
    setSyncResult(null);
    try {
      const result = await syncIntegration.mutateAsync(provider);
      setSyncResult(result);
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    }
  };

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{label}</Typography>
                {isEnabled && isConfigured && (
                  <Chip icon={<CheckCircleIcon />} label="Active" size="small" color="success" sx={{ height: 24 }} />
                )}
                {isConfigured && !isEnabled && (
                  <Chip label="Disabled" size="small" variant="outlined" sx={{ height: 24 }} />
                )}
                {!isConfigured && (
                  <Chip label="Not configured" size="small" variant="outlined" sx={{ height: 24 }} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">{description}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {isEnabled && isConfigured && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={syncIntegration.isPending ? <CircularProgress size={16} /> : <SyncIcon />}
                  onClick={handleSync}
                  disabled={syncIntegration.isPending}
                >
                  Sync
                </Button>
              )}
              <Button size="small" variant="contained" onClick={openConfig}>
                {isConfigured ? 'Edit' : 'Configure'}
              </Button>
            </Stack>
          </Box>

          {lastSync && (
            <Typography variant="caption" color="text.secondary">
              Last sync: {new Date(lastSync).toLocaleString()}
              {lastStatus && (
                <Chip
                  label={lastStatus}
                  size="small"
                  color={lastStatus === 'success' ? 'success' : 'error'}
                  sx={{ ml: 1, height: 18, fontSize: '0.6rem' }}
                />
              )}
            </Typography>
          )}

          {syncResult && (
            <Alert severity={syncResult.success ? 'success' : 'error'} sx={{ mt: 1 }} onClose={() => setSyncResult(null)}>
              {syncResult.success
                ? `Synced: ${syncResult.created || 0} new, ${syncResult.updated || 0} updated, ${syncResult.total || 0} total`
                : syncResult.error}
            </Alert>
          )}

        </CardContent>
      </Card>

      {/* Config dialog */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Configure {label}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {configHint && (
            <Alert severity="info" sx={{ mb: 1 }}>{configHint}</Alert>
          )}
          {fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              value={form[field.key] || ''}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              fullWidth
              placeholder={field.placeholder}
              type={field.secret ? 'password' : 'text'}
              helperText={field.helper}
            />
          ))}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Token expiry date"
              type="date"
              value={tokenExpiresAt}
              onChange={(e) => setTokenExpiresAt(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="We'll remind you before it expires"
            />
            <TextField
              label="Token label"
              value={tokenLabel}
              onChange={(e) => setTokenLabel(e.target.value)}
              fullWidth
              placeholder={`e.g. ${label} API Token`}
              helperText="Name to show in reminders"
            />
          </Stack>
          {isConfigured && (
            <FormControlLabel
              control={<Switch checked={isEnabled} onChange={handleToggle} />}
              label="Enabled"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConfig}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>Integrations</Typography>

      <IntegrationCard
        provider="jira"
        label="Jira"
        description="Pull assigned tickets into your work items automatically"
        configHint="Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens"
        fields={[
          { key: 'baseUrl', label: 'Jira Base URL', placeholder: 'https://yourcompany.atlassian.net' },
          { key: 'email', label: 'Email', placeholder: 'you@company.com' },
          { key: 'apiToken', label: 'API Token', placeholder: 'Your Jira API token', secret: true },
          { key: 'projectKeys', label: 'Project Keys (optional)', placeholder: 'PROJ,TEAM,OPS', helper: 'Comma-separated. Leave empty for all projects.' },
        ]}
      />

      <IntegrationCard
        provider="bitbucket"
        label="Bitbucket"
        description="Track your open PRs and review requests across all repos"
        configHint="Use EITHER a Workspace Access Token (Workspace Settings > Access Tokens) OR your username + app password. Access token is preferred if app passwords are disabled."
        fields={[
          { key: 'workspace', label: 'Workspace', placeholder: 'your-workspace' },
          { key: 'accessToken', label: 'Workspace Access Token (preferred)', placeholder: 'Your workspace access token', secret: true, helper: 'Workspace Settings > Access Tokens. Needs Repositories:Read and Pull Requests:Read.' },
          { key: 'displayName', label: 'Your display name in Bitbucket', placeholder: 'Amanda Henderson', helper: 'Must match exactly how your name appears on PRs' },
          { key: 'username', label: 'Username (for app password auth)', placeholder: 'your-bb-username', helper: 'Only needed if using app password instead of access token' },
          { key: 'appPassword', label: 'App Password (alternative)', placeholder: 'Your Bitbucket app password', secret: true },
          { key: 'repos', label: 'Repos to track (optional)', placeholder: 'crm-backend-services,land-crm', helper: 'Leave empty to track ALL repos in the workspace' },
        ]}
      />

      <IntegrationCard
        provider="calendar"
        label="Outlook Calendar"
        description="Pull Outlook/Teams meetings to calculate your available focus time"
        configHint="In Outlook: Settings > Calendar > Shared calendars > Publish a calendar. Select your calendar and choose 'Can view all details'. Copy the ICS link."
        fields={[
          { key: 'icsUrl', label: 'ICS Calendar URL', placeholder: 'https://outlook.office365.com/owa/calendar/...', helper: 'The published ICS link from Outlook. No Azure setup needed.' },
        ]}
      />
    </Box>
  );
}

// ── General Tab ───────────────────────────────────────────────────────────

function GeneralTab() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  if (isLoading || !settings) return null;

  const handleTimeChange = (field, value) => {
    updateSettings.mutate({ [field]: value });
  };

  const startMinutes = settings.workStartTime ? (() => {
    const [h, m] = settings.workStartTime.split(':').map(Number);
    return h * 60 + m;
  })() : 450;
  const endMinutes = settings.workEndTime ? (() => {
    const [h, m] = settings.workEndTime.split(':').map(Number);
    return h * 60 + m;
  })() : 960;
  const totalMinutes = Math.max(0, endMinutes - startMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>Work Hours</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Used to calculate your available focus time on the Today page.
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Start time"
          type="time"
          value={settings.workStartTime || '07:30'}
          onChange={(e) => handleTimeChange('workStartTime', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 180 }}
        />
        <TextField
          label="End time"
          type="time"
          value={settings.workEndTime || '16:00'}
          onChange={(e) => handleTimeChange('workEndTime', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 180 }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {hours}h {mins}m workday ({settings.workStartTime} — {settings.workEndTime})
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1 }}>AI Assistant</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Add an Anthropic API key to power the AI chat assistant. Get one from console.anthropic.com.
        Without a key, the chat bot answers common questions from the built-in FAQ.
      </Typography>
      <TextField
        label="Anthropic API Key"
        type="password"
        value={settings.anthropicApiKey || ''}
        onChange={(e) => updateSettings.mutate({ anthropicApiKey: e.target.value })}
        fullWidth
        placeholder="sk-ant-..."
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1 }}>Help</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        New to DevFocus? Check out the guide for how everything works.
      </Typography>
      <Button variant="outlined" size="small" href="/guide">
        View Guide
      </Button>
    </Box>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 700 }}>
      <ContextualHint hintId="settings">
        Configure your work hours so focus time calculations are accurate. Set up integrations
        to pull in Jira tickets, Bitbucket PRs, and Outlook meetings automatically.
      </ContextualHint>
      <Typography variant="h5" sx={{ mb: 2 }}>Settings</Typography>
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="General" />
        <Tab label="Projects" />
        <Tab label="Integrations" />
      </Tabs>
      {tab === 0 && <GeneralTab />}
      {tab === 1 && <ProjectsTab />}
      {tab === 2 && <IntegrationsTab />}
    </Box>
  );
}
