import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export function useTrends(days = 30) {
  return useQuery({
    queryKey: ['trends', days],
    queryFn: () => api.get(`/trends?days=${days}`),
  });
}
