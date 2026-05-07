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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useProjects, useCreateProject, useUpdateProject } from '../api/projects';

const PRESET_COLORS = [
  '#7C4DFF', '#2196F3', '#00BCD4', '#00C853', '#FFD600',
  '#FF9800', '#FF5252', '#E91E63', '#9C27B0', '#607D8B',
];

const INTEGRATIONS = [
  { provider: 'jira', label: 'Jira', description: 'Pull assigned tickets into your work items' },
  { provider: 'bitbucket', label: 'Bitbucket', description: 'Track open PRs and review requests' },
  { provider: 'calendar', label: 'Microsoft Calendar', description: 'Pull Outlook/Teams meetings for focus time calculation' },
];

function ProjectsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const { data: projects = [] } = useProjects(true);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', repoSlug: '', color: '#7C4DFF' });

  const filtered = showArchived ? projects : projects.filter((p) => !p.archived);

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', repoSlug: '', color: '#7C4DFF' });
    setDialogOpen(true);
  };

  const openEdit = (project) => {
    setEditId(project.id);
    setForm({ name: project.name, repoSlug: project.repoSlug || '', color: project.color || '#7C4DFF' });
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
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            Projects
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Map to your repos. Assign work items and snapshots to projects.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}>
          New
        </Button>
      </Box>

      <FormControlLabel
        control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} size="small" />}
        label="Show archived"
        sx={{ mb: 2 }}
      />

      <Stack spacing={1}>
        {filtered.map((project) => (
          <Card key={project.id} sx={{ opacity: project.archived ? 0.5 : 1 }}>
            <CardContent
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: '12px !important',
                '&:last-child': { pb: '12px !important' },
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: project.color || '#666',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {project.name}
                </Typography>
                {project.repoSlug && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {project.repoSlug}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={() => openEdit(project)} title="Edit">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleArchive(project)}
                  title={project.archived ? 'Unarchive' : 'Archive'}
                >
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
          <TextField
            label="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
            autoFocus
            placeholder="e.g. CRM Backend, Builder Scraper"
          />
          <TextField
            label="Repo slug (optional)"
            value={form.repoSlug}
            onChange={(e) => setForm({ ...form, repoSlug: e.target.value })}
            fullWidth
            placeholder="e.g. crm-backend-services"
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Color
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: form.color === c ? '3px solid white' : '3px solid transparent',
                    transition: 'border-color 0.2s',
                    '&:hover': { border: '3px solid rgba(255,255,255,0.5)' },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>
            {editId ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function IntegrationsTab() {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontSize: '1rem', mb: 2 }}>
        Integrations
      </Typography>
      {INTEGRATIONS.map((integration) => (
        <Card key={integration.provider} sx={{ mb: 2 }}>
          <CardContent
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: '16px !important',
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {integration.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {integration.description}
              </Typography>
            </Box>
            <Chip label="Coming soon" size="small" variant="outlined" />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default function Settings() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Projects" />
        <Tab label="Integrations" />
      </Tabs>

      {tab === 0 && <ProjectsTab />}
      {tab === 1 && <IntegrationsTab />}
    </Box>
  );
}
