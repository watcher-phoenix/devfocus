import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const KEYS = {
  all: ['workItems'],
  list: (filters) => ['workItems', filters],
};

export function useWorkItems(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null) params.set(k, v);
  });
  const qs = params.toString();
  return useQuery({
    queryKey: KEYS.list(filters),
    queryFn: () => api.get(`/work-items${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/work-items', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useUpdateWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/work-items/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useUpdateWorkItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.patch(`/work-items/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useDeleteWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/work-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}

export function useQuickCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/inbox/capture', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['daily'] });
    },
  });
}
