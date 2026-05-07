import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: ['projects', { includeArchived }],
    queryFn: () => api.get(`/projects${includeArchived ? '?archived=true' : ''}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/projects/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
