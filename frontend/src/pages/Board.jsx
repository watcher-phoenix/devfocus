import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useWorkItems, useUpdateWorkItem, useUpdateWorkItemStatus, useDeleteWorkItem } from '../api/workItems';
import { useProjects } from '../api/projects';
import { useStatuses, useStatusMap } from '../api/statuses';
import WorkItemDialog from '../components/WorkItemDialog';
import NewWorkItemDialog from '../components/NewWorkItemDialog';

// Lighten a hex color toward white for readability on dark backgrounds
function lightenColor(hex, amount = 0.45) {
  const num = parseInt((hex || '#1976d2').slice(1), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

// Fallback colors used only until dynamic statuses load
const FALLBACK_STATUS_COLORS = {
  inbox: '#9AA0A6',
  active: '#7C4DFF',
  waiting: '#FFD600',
  later: '#03A9F4',
  scheduled: '#AB47BC',
  done: '#00C853',
};

const TYPE_LABELS = {
  task: 'Task',
  ticket: 'Ticket',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  'pr-review': 'PR Review',
  jira: 'Jira',
  pr: 'PR',
  support: 'Weekend Support',
  urgent: 'Urgent',
};

const PRIORITY_LABELS = { 0: '-', 1: 'Low', 2: 'Med', 3: 'High' };
const PRIORITY_COLORS = { 1: 'default', 2: 'warning', 3: 'error' };

export default function Board() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [sortField, setSortField] = useState('priority');
  const [sortDir, setSortDir] = useState('desc');
  const [editItem, setEditItem] = useState(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    status: '', type: '', priority: '', projectId: '', scheduledDate: '', dueDate: '',
  });

  const { data: statusConfigs = [] } = useStatuses();
  const statusMap = useStatusMap();
  const statusKeys = statusConfigs.filter((s) => !s.isCompletion).map((s) => s.key);
  const doneKeys = statusConfigs.filter((s) => s.isCompletion).map((s) => s.key);
  const allStatusKeys = [...statusKeys, ...doneKeys];
  const statusOptions = [{ value: 'all', label: 'All' }, ...statusConfigs.map((s) => ({ value: s.key, label: s.label }))];
  const statusColors = {};
  statusConfigs.forEach((s) => { statusColors[s.key] = s.color; });
  const getStatusColor = (key) => statusColors[key] || FALLBACK_STATUS_COLORS[key] || '#9AA0A6';
  const getStatusLabel = (key) => statusMap[key]?.label || key;

  const { data: items = [] } = useWorkItems({ statuses: allStatusKeys.length ? allStatusKeys.join(',') : 'inbox,active,waiting,later,scheduled,done' });
  const { data: projects = [] } = useProjects();
  const updateStatus = useUpdateWorkItemStatus();
  const updateItem = useUpdateWorkItem();
  const deleteItem = useDeleteWorkItem();
  const [statusRoast, setStatusRoast] = useState('');

  const STATUS_ROASTS = {
    done: ['Another one bites the dust.', 'Shipped it. Ship happens.', 'Done done? Or "done"?', 'Cross it off with pride.'],
    later: ['We both know what "later" means.', '"Later" — the graveyard of good intentions.', 'Sure. "Later."'],
    waiting: ['Waiting on someone else? Classic.', 'Blocked. The dev\'s favorite excuse.', 'Hurry up and wait.'],
    inbox: ['Back to the brain dump? No judgment.', 'Demoted back to the pile.'],
    active: ['Let\'s actually do this one.', 'Promoted to "will think about."'],
    scheduled: ['Penciled in. In pencil, obviously.', 'Future you\'s problem now.'],
  };

  const handleStatusChange = useCallback((id, newStatus) => {
    updateStatus.mutate({ id, status: newStatus });
    const roasts = STATUS_ROASTS[newStatus];
    if (roasts) setStatusRoast(roasts[Math.floor(Math.random() * roasts.length)]);
  }, [updateStatus]);

  const bulkApply = () => {
    const updates = {};
    if (bulkForm.status) updates.status = bulkForm.status;
    if (bulkForm.type) updates.type = bulkForm.type;
    if (bulkForm.priority !== '') updates.priority = parseInt(bulkForm.priority);
    if (bulkForm.projectId) updates.projectId = bulkForm.projectId === 'none' ? null : bulkForm.projectId;
    if (bulkForm.scheduledDate) updates.scheduledDate = bulkForm.scheduledDate;
    if (bulkForm.dueDate) updates.dueDate = bulkForm.dueDate;

    if (Object.keys(updates).length === 0) return;
    selected.forEach((id) => updateItem.mutate({ id, ...updates }));
    setSelected(new Set());
    setBulkDialogOpen(false);
    setBulkForm({ status: '', type: '', priority: '', projectId: '', scheduledDate: '', dueDate: '' });
  };

  const bulkDelete = () => {
    selected.forEach((id) => deleteItem.mutate(id));
    setSelected(new Set());
  };

  const filtered = useMemo(() => {
    let result = items;
    if (!showDone && statusFilter === 'all') {
      result = result.filter((i) => !statusMap[i.status]?.isCompletion);
    }
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (projectFilter !== 'all') {
      result = result.filter((i) => i.projectId && String(i.projectId) === String(projectFilter));
    }
    return result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'priority': aVal = a.priority; bVal = b.priority; break;
        case 'title': aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'type': aVal = a.type; bVal = b.type; break;
        case 'updatedAt': aVal = new Date(a.updatedAt); bVal = new Date(b.updatedAt); break;
        default: aVal = a.priority; bVal = b.priority;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, showDone, statusFilter, typeFilter, projectFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'title' ? 'asc' : 'desc');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">Work</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setNewItemOpen(true)}>
          New Item
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 140 } }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((s) => (
              <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 120 } }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 140 } }}>
          <InputLabel>Project</InputLabel>
          <Select value={projectFilter} label="Project" onChange={(e) => setProjectFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={showDone} onChange={(e) => setShowDone(e.target.checked)} size="small" />}
          label="Done"
          sx={{ ml: 0 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card sx={{ mb: 2, bgcolor: 'primary.main', backgroundImage: 'none' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '8px !important', '&:last-child': { pb: '8px !important' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {selected.size} selected
            </Typography>
            <Button size="small" variant="outlined" startIcon={<EditIcon />} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} onClick={() => setBulkDialogOpen(true)}>
              Edit
            </Button>
            <Button size="small" variant="outlined" sx={{ color: '#FF5252', borderColor: '#FF5252' }} onClick={bulkDelete}>Delete</Button>
            <Button size="small" sx={{ color: 'white', ml: 'auto' }} onClick={() => setSelected(new Set())}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk edit dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit {selected.size} items</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">
            Only fields you set will be updated. Leave blank to keep current values.
          </Typography>
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={bulkForm.status} label="Status" onChange={(e) => setBulkForm({ ...bulkForm, status: e.target.value })}>
                <MenuItem value="">Don't change</MenuItem>
                {statusOptions.filter((s) => s.value !== 'all').map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={bulkForm.type} label="Type" onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })}>
                <MenuItem value="">Don't change</MenuItem>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select value={bulkForm.priority} label="Priority" onChange={(e) => setBulkForm({ ...bulkForm, priority: e.target.value })}>
                <MenuItem value="">Don't change</MenuItem>
                <MenuItem value={0}>None</MenuItem>
                <MenuItem value={1}>Low</MenuItem>
                <MenuItem value={2}>Medium</MenuItem>
                <MenuItem value={3}>High</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select value={bulkForm.projectId} label="Project" onChange={(e) => setBulkForm({ ...bulkForm, projectId: e.target.value })}>
                <MenuItem value="">Don't change</MenuItem>
                <MenuItem value="none">Remove project</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Scheduled date"
              type="date"
              value={bulkForm.scheduledDate}
              onChange={(e) => setBulkForm({ ...bulkForm, scheduledDate: e.target.value })}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Due date"
              type="date"
              value={bulkForm.dueDate}
              onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={bulkApply}>Apply to {selected.size} items</Button>
        </DialogActions>
      </Dialog>

      {/* Table */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: { xs: 600, md: 'auto' } }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ width: 40 }}>
                <Checkbox
                  size="small"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  indeterminate={selected.size > 0 && selected.size < filtered.length}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 80 }}>
                <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                <TableSortLabel active={sortField === 'title'} direction={sortField === 'title' ? sortDir : 'asc'} onClick={() => handleSort('title')}>
                  Title
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 80 }}>
                <TableSortLabel active={sortField === 'type'} direction={sortField === 'type' ? sortDir : 'asc'} onClick={() => handleSort('type')}>
                  Type
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 70 }}>
                <TableSortLabel active={sortField === 'priority'} direction={sortField === 'priority' ? sortDir : 'desc'} onClick={() => handleSort('priority')}>
                  Priority
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>Project</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((item) => (
              <TableRow
                key={item.id}
                hover
                sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                onClick={() => setEditItem(item)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selected.has(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={item.status}
                    size="small"
                    variant="standard"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    sx={{ fontSize: '0.75rem', '&:before': { borderBottom: 'none' }, '& .MuiSelect-select': { py: 0.25 } }}
                  >
                    {statusOptions.filter((s) => s.value !== 'all').map((s) => (
                      <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.8rem' }}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {item.title}
                  </Typography>
                  {item.externalId && (
                    item.externalUrl ? (
                      <Typography
                        variant="caption"
                        component="a"
                        href={item.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ color: '#2684FF', fontFamily: 'monospace', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {item.externalId}
                      </Typography>
                    ) : (
                      <Typography variant="caption" sx={{ color: '#2684FF', fontFamily: 'monospace' }}>
                        {item.externalId}
                      </Typography>
                    )
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{TYPE_LABELS[item.type] || item.type}</Typography>
                </TableCell>
                <TableCell>
                  {item.priority > 0 && (
                    <Chip
                      label={PRIORITY_LABELS[item.priority]}
                      size="small"
                      color={PRIORITY_COLORS[item.priority] || 'default'}
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {item.project && (
                    <Chip
                      label={item.project.name}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: item.project.color + '33',
                        color: lightenColor(item.project.color),
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); deleteItem.mutate(item.id); }}
                    sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {statusFilter === 'all' ? 'Nothing here yet. Either you\'re new or you deleted everything. Use "New Item" or Ctrl+K to start.' : 'No items match this filter. They\'re hiding.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <WorkItemDialog item={editItem} open={Boolean(editItem)} onClose={() => setEditItem(null)} />
      <NewWorkItemDialog open={newItemOpen} onClose={() => setNewItemOpen(false)} defaultStatus="active" />
      <Snackbar open={!!statusRoast} autoHideDuration={2500} onClose={() => setStatusRoast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" onClose={() => setStatusRoast('')} sx={{ bgcolor: 'rgba(124,77,255,0.9)' }}>{statusRoast}</Alert>
      </Snackbar>
    </Box>
  );
}
