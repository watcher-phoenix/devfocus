import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useActivity(days = 14) {
  return useQuery({
    queryKey: ['activity', days],
    queryFn: () => api.get(`/activity?days=${days}`),
  });
}

export function useLogWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/activity/log', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['workItems'] });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}
