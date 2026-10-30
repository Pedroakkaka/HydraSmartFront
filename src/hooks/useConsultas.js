import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/** Consultas REST com cache (React Query). Os dados ao vivo chegam pelo WebSocket. */

export const useClima = () =>
  useQuery({ queryKey: ['clima'], queryFn: () => api.get('/clima'), refetchInterval: 10 * 60_000, staleTime: 5 * 60_000 });

export const useCemaden = () =>
  useQuery({ queryKey: ['cemaden'], queryFn: () => api.get('/cemaden'), refetchInterval: 5 * 60_000, staleTime: 2 * 60_000 });

export const useDrenosOsm = () =>
  useQuery({ queryKey: ['osm'], queryFn: () => api.get('/osm/drenos'), staleTime: 60 * 60_000 });

export const useHistoricoOficial = () =>
  useQuery({ queryKey: ['historico-oficial'], queryFn: () => api.get('/historico-oficial'), staleTime: Infinity });

export const useSaude = () =>
  useQuery({ queryKey: ['health'], queryFn: () => api.get('/health'), refetchInterval: 30_000, retry: false });

export const useCenarios = () =>
  useQuery({ queryKey: ['cenarios'], queryFn: () => api.get('/simulacao/cenarios'), staleTime: Infinity });

export const useAlertas = () =>
  useQuery({ queryKey: ['alertas'], queryFn: () => api.get('/alertas?limite=20'), refetchInterval: 15_000 });

export const useUltimaLeituraBanco = () =>
  useQuery({ queryKey: ['ultima-leitura'], queryFn: () => api.get('/leituras?limite=1'), refetchInterval: 10_000 });
