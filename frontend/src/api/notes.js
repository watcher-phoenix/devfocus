import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const KEYS = {
  all: ['notes'],
  date: (date) => ['notes', date],
};

export function useDailyNote(date = 'today') {
  return useQuery({
    queryKey: KEYS.date(date),
    queryFn: () => api.get(`/notes/${date}`),
  });
}

export function useNotesList() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => api.get('/notes'),
  });
}

export function useSaveDailyNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, content }) => api.put(`/notes/${date}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
