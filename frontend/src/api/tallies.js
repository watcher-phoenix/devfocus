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
    mutationFn: ({ entries }) => api.put(`/tallies/${date}`, { entries }),
    onSuccess: (data) => {
      qc.setQueryData(KEYS.date(date), data);
    },
  });
}
