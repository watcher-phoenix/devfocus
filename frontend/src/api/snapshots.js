import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useSnapshots(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null) params.set(k, String(v));
  });
  const qs = params.toString();
  return useQuery({
    queryKey: ['snapshots', filters],
    queryFn: () => api.get(`/snapshots${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/snapshots', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots'] });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useUpdateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/snapshots/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots'] });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}
