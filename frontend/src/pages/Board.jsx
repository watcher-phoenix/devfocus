import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useWorkItems, useUpdateWorkItemStatus, useDeleteWorkItem } from '../api/workItems';
import { useProjects } from '../api/projects';
import WorkItemDialog from '../components/WorkItemDialog';
import NewWorkItemDialog from '../components/NewWorkItemDialog';
import ContextualHint from '../components/ContextualHint';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'inbox', label: 'Brain Dump' },
  { value: 'active', label: 'Active' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'later', label: 'Later' },
  { value: 'done', label: 'Done' },
];

const STATUS_COLORS = {
  inbox: '#9AA0A6',
  active: '#7C4DFF',
  waiting: '#FFD600',
  later: '#03A9F4',
  done: '#00C853',
};

const TYPE_LABELS = {
  task: 'Task',
  ticket: 'Ticket',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  jira: 'Jira',
  pr: 'PR',
};

const PRIORITY_LABELS = { 0: '-', 1: 'Low', 2: 'Med', 3: 'High' };
const PRIORITY_COLORS = { 1: 'default', 2: 'warning', 3: 'error' };

export default function Board() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortField, setSortField] = useState('priority');
  const [sortDir, setSortDir] = useState('desc');
  const [editItem, setEditItem] = useState(null);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const statuses = statusFilter === 'all' ? 'inbox,active,waiting,later,done' : statusFilter;
  const { data: items = [] } = useWorkItems({ statuses });
  const { data: projects = [] } = useProjects();
  const updateStatus = useUpdateWorkItemStatus();
  const deleteItem = useDeleteWorkItem();

  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter !== 'all') {
      result = result.filter((i) => i.type === typeFilter);
    }
    if (projectFilter !== 'all') {
      result = result.filter((i) => String(i.projectId) === String(projectFilter));
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
  }, [items, projectFilter, sortField, sortDir]);

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
      <ContextualHint hintId="work">
        This is your work list. Filter by status or project, click any row to edit,
        and use the status dropdown to move items through your workflow:
        Brain Dump → Active → Waiting/Later → Done.
      </ContextualHint>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Work</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setNewItemOpen(true)}>
          New Item
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Project</InputLabel>
          <Select value={projectFilter} label="Project" onChange={(e) => setProjectFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
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
                <TableCell>
                  <Select
                    value={item.status}
                    size="small"
                    variant="standard"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus.mutate({ id: item.id, status: e.target.value })}
                    sx={{ fontSize: '0.75rem', '&:before': { borderBottom: 'none' }, '& .MuiSelect-select': { py: 0.25 } }}
                  >
                    {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                      <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.8rem' }}>{s.label}</MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {item.title}
                  </Typography>
                  {item.externalId && (
                    <Typography variant="caption" sx={{ color: '#2684FF', fontFamily: 'monospace' }}>
                      {item.externalId}
                    </Typography>
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
                        bgcolor: item.project.color + '22',
                        color: item.project.color,
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
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {statusFilter === 'all' ? 'No items yet. Use "New Item" or Ctrl+K to add one.' : 'No items with this filter.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <WorkItemDialog item={editItem} open={Boolean(editItem)} onClose={() => setEditItem(null)} />
      <NewWorkItemDialog open={newItemOpen} onClose={() => setNewItemOpen(false)} defaultStatus="active" />
    </Box>
  );
}
