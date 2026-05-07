import { useState, useMemo } from 'react';
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
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWorkItems, useUpdateWorkItemStatus, useDeleteWorkItem } from '../api/workItems';
import WorkItemDialog from '../components/WorkItemDialog';
import NewWorkItemDialog from '../components/NewWorkItemDialog';

const COLUMNS = [
  { key: 'inbox', label: 'Brain Dump', color: '#9AA0A6' },
  { key: 'active', label: 'Active', color: '#7C4DFF' },
  { key: 'waiting', label: 'Waiting', color: '#FFD600' },
  { key: 'later', label: 'Later', color: '#03A9F4' },
  { key: 'done', label: 'Done', color: '#00C853' },
];

const TYPE_LABELS = {
  task: 'Task',
  ticket: 'Ticket',
  strategic: 'Strategic',
  followup: 'Follow-up',
  review: 'Review',
  jira: 'Jira',
  pr: 'PR',
};

function CardContent_({ item }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 500, pr: 1 }}>
        {item.title}
      </Typography>
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
        {item.externalId && (
          <Chip
            label={item.externalId}
            size="small"
            sx={{ height: 20, fontSize: '0.65rem', color: '#2684FF', fontFamily: 'monospace' }}
          />
        )}
      </Stack>
    </>
  );
}

function SortableCard({ item, onEdit, onStatusChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item.id),
    data: { item },
  });
  const [menuAnchor, setMenuAnchor] = useState(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        mb: 1,
        cursor: 'grab',
        '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
        transition: 'border-color 0.2s',
        touchAction: 'none',
      }}
      onClick={() => onEdit(item)}
    >
      <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <CardContent_ item={item} />
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
            }}
            sx={{ mt: -0.5, mr: -0.5 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

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

function DroppableColumn({ col, items, onEdit, onStatusChange, onDelete }) {
  const itemIds = useMemo(() => items.map((i) => String(i.id)), [items]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: col.color }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {col.label}
        </Typography>
        <Chip label={items.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
      </Box>
      <SortableContext id={col.key} items={itemIds} strategy={verticalListSortingStrategy}>
        <Box
          sx={{
            minHeight: 100,
            p: 0.5,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </Box>
      </SortableContext>
    </Box>
  );
}

export default function Board() {
  const { data: items = [] } = useWorkItems({ statuses: 'inbox,active,waiting,later,done' });
  const updateStatus = useUpdateWorkItemStatus();
  const deleteItem = useDeleteWorkItem();
  const [editItem, setEditItem] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleStatusChange = (id, status) => {
    updateStatus.mutate({ id, status });
  };

  const handleDelete = (id) => {
    deleteItem.mutate(id);
  };

  const handleDragStart = (event) => {
    const item = items.find((i) => String(i.id) === String(event.active.id));
    setActiveItem(item || null);
  };

  const handleDragEnd = (event) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id;

    // Figure out which column we dropped into
    let targetStatus = null;

    // Check if dropped over a column container
    if (COLUMNS.find((c) => c.key === over.id)) {
      targetStatus = over.id;
    } else {
      // Dropped over another card — find that card's status
      const overItem = items.find((i) => String(i.id) === String(over.id));
      if (overItem) targetStatus = overItem.status;
    }

    if (!targetStatus) return;

    const draggedItem = items.find((i) => String(i.id) === String(draggedId));
    if (!draggedItem || draggedItem.status === targetStatus) return;

    updateStatus.mutate({ id: draggedItem.id, status: targetStatus });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Board</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setNewItemOpen(true)}>
          New Item
        </Button>
      </Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 2,
            alignItems: 'flex-start',
          }}
        >
          {COLUMNS.map((col) => {
            const colItems = items.filter((i) => i.status === col.key);
            return (
              <DroppableColumn
                key={col.key}
                col={col}
                items={colItems}
                onEdit={setEditItem}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            );
          })}
        </Box>
        <DragOverlay>
          {activeItem ? (
            <Card sx={{ width: 250, opacity: 0.9 }}>
              <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                <CardContent_ item={activeItem} />
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <WorkItemDialog
        item={editItem}
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
      />

      <NewWorkItemDialog
        open={newItemOpen}
        onClose={() => setNewItemOpen(false)}
        defaultStatus="active"
      />
    </Box>
  );
}
