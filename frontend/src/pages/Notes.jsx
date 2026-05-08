import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import ContextualHint from '../components/ContextualHint';
import RichTextEditor from '../components/RichTextEditor';
import { useNotesList, useDailyNote, useSaveDailyNote } from '../api/notes';

function formatDateLabel(dateStr) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = yd.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Notes() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [selectedDate, setSelectedDate] = useState(today);
  const { data: notesList = [], isLoading: listLoading } = useNotesList();
  const { data: currentNote, isLoading: noteLoading } = useDailyNote(selectedDate);
  const save = useSaveDailyNote();

  const [content, setContent] = useState('');
  const lastSaved = useRef('');

  // Sync content when note loads
  useEffect(() => {
    if (currentNote) {
      setContent(currentNote.content || '');
      lastSaved.current = currentNote.content || '';
    }
  }, [currentNote]);

  const doSave = useCallback((html) => {
    if (html !== lastSaved.current) {
      save.mutate({ date: selectedDate, content: html });
      lastSaved.current = html;
    }
  }, [selectedDate, save]);

  const handleChange = (html) => {
    setContent(html);
    doSave(html);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  // Build date list: merge notesList dates with today
  const dates = [today, ...notesList.map((n) => n.date).filter((d) => d !== today)];

  return (
    <Box sx={{ display: 'flex', gap: 3, maxWidth: 900 }}>
      {/* Date list */}
      <Card sx={{ minWidth: 200, maxWidth: 220, flexShrink: 0, alignSelf: 'flex-start' }}>
        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
          <Typography variant="overline" sx={{ px: 1, fontSize: '0.65rem' }}>Notes</Typography>
          {listLoading ? (
            <Skeleton variant="rounded" height={120} sx={{ m: 1 }} />
          ) : (
            <List dense disablePadding>
              {dates.map((date) => (
                <ListItemButton
                  key={date}
                  selected={date === selectedDate}
                  onClick={() => handleDateChange(date)}
                  sx={{ borderRadius: 1, mx: 0.5, mb: 0.25 }}
                >
                  <ListItemText
                    primary={formatDateLabel(date)}
                    secondary={date}
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: date === selectedDate ? 600 : 400 }}
                    secondaryTypographyProps={{ fontSize: '0.7rem' }}
                  />
                  {date === today && <Chip label="Today" size="small" color="primary" sx={{ height: 18, fontSize: '0.6rem' }} />}
                </ListItemButton>
              ))}
              {dates.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1, fontSize: '0.8rem' }}>
                  No notes yet. Start typing!
                </Typography>
              )}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Box sx={{ flex: 1 }}>
        <ContextualHint hintId="notes">
          Jot down thoughts, meeting notes, or anything on your mind. Notes auto-save and are tied to a date.
          Brain dump on the Today page always goes to your inbox — this is for freeform notes.
        </ContextualHint>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1 }}>
              {formatDateLabel(selectedDate)}
            </Typography>
            {noteLoading ? (
              <Skeleton variant="rounded" height={300} />
            ) : (
              <RichTextEditor
                content={content}
                onChange={handleChange}
                placeholder="Write your notes here..."
                minHeight={350}
              />
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
