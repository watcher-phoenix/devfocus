import { useQuery } from '@tanstack/react-query';
import { api } from './client';

export function useDaily(date = 'today') {
  return useQuery({
    queryKey: ['daily', date],
    queryFn: () => api.get(`/daily/${date}`),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useWeekMeetings(weekStart) {
  return useQuery({
    queryKey: ['weekMeetings', weekStart],
    queryFn: () => api.get(`/daily/week-meetings/${weekStart}`),
    enabled: !!weekStart,
  });
}
