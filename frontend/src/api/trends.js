import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export function useTrends({ days, from, to, enabled = true } = {}) {
  const params = new URLSearchParams();
  if (from && to) {
    params.set('from', from);
    params.set('to', to);
  } else {
    params.set('days', days || 30);
  }
  const qs = params.toString();
  return useQuery({
    queryKey: ['trends', from, to, days],
    queryFn: () => api.get(`/trends?${qs}`),
    enabled,
  });
}
