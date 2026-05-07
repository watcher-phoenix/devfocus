import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useWorkItems, useUpdateWorkItemStatus, useDeleteWorkItem } from '../api/workItems';

const COLUMNS = [
  { key: 'inbox', label: 'Inbox', color: '#9AA0A6' },
  { key: 'active', label: 'Active', color: '#7C4DFF' },
  { key: 'waiting', label: 'Waiting', color: '#FFD600' },
  { key: 'done', label: 'Done', color: '#00C853' },
];

const TYPE_LABELS = {
  task: 'Task',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  jira: 'Jira',
  pr: 'PR',
};

function WorkItemCard({ item, onStatusChange, onDelete }) {
  const [menuAnchor, setMenuAnchor] = useState(null);

  return (
    <Card
      sx={{
        mb: 1,
        cursor: 'pointer',
        '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
        transition: 'border-color 0.2s',
      }}
    >
      <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, pr: 1 }}>
            {item.title}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{ mt: -0.5, mr: -0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
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
          {item.type !== 'task' && (
            <Chip
              label={TYPE_LABELS[item.type] || item.type}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
          {item.priority >= 2 && (
            <Chip
              label={item.priority === 3 ? 'High' : 'Med'}
              size="small"
              color={item.priority === 3 ? 'error' : 'warning'}
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
        </Stack>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {COLUMNS.filter((c) => c.key !== item.status).map((col) => (
            <MenuItem
              key={col.key}
              onClick={() => {
                onStatusChange(item.id, col.key);
                setMenuAnchor(null);
              }}
            >
              Move to {col.label}
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => {
              onDelete(item.id);
              setMenuAnchor(null);
            }}
            sx={{ color: 'error.main' }}
          >
            Delete
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
}

export default function Board() {
  const { data: items = [] } = useWorkItems({ statuses: 'inbox,active,waiting,done' });
  const updateStatus = useUpdateWorkItemStatus();
  const deleteItem = useDeleteWorkItem();

  const handleStatusChange = (id, status) => {
    updateStatus.mutate({ id, status });
  };

  const handleDelete = (id) => {
    deleteItem.mutate(id);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Board
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          alignItems: 'flex-start',
        }}
      >
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.status === col.key);
          return (
            <Box key={col.key}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                  px: 0.5,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: col.color,
                  }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {col.label}
                </Typography>
                <Chip label={colItems.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Box>
              <Box sx={{ minHeight: 100 }}>
                {colItems.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
