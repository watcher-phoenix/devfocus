import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations'),
  });
}

export function useIntegration(provider) {
  return useQuery({
    queryKey: ['integrations', provider],
    queryFn: () => api.get(`/integrations/${provider}`),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, ...data }) => api.put(`/integrations/${provider}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useSyncIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider) => api.post(`/integrations/${provider}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      qc.invalidateQueries({ queryKey: ['daily'] });
      qc.invalidateQueries({ queryKey: ['workItems'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (provider) => api.post(`/integrations/${provider}/test`),
  });
}

export function useCalendarDeviceCode() {
  return useMutation({
    mutationFn: () => api.post('/integrations/calendar/auth/device-code'),
  });
}
