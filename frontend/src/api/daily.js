import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export function useDaily(date = 'today') {
  return useQuery({
    queryKey: ['daily', date],
    queryFn: () => api.get(`/daily/${date}`),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });
}
