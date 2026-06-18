import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const KEYS = {
  date: (date) => ['tallies', date],
};

export function useTally(date = 'today') {
  return useQuery({
    queryKey: KEYS.date(date),
    queryFn: () => api.get(`/tallies/${date}`),
  });
}

export function useSaveTally(date = 'today') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ counts, note }) => api.put(`/tallies/${date}`, { counts, note }),
    onSuccess: (data) => {
      qc.setQueryData(KEYS.date(date), data);
    },
  });
}
