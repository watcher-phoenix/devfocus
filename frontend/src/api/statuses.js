import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useStatuses() {
  return useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/statuses'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStatusMap() {
  const { data: statuses = [] } = useStatuses();
  const map = {};
  statuses.forEach((s) => {
    map[s.key] = s;
  });
  return map;
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/statuses', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/statuses/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

export function useDeleteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/statuses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}
