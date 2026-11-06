import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/** Consultas REST com cache (React Query). Os dados ao vivo chegam pelo WebSocket. */

export const useClima = () =>
  useQuery({ queryKey: ['clima'], queryFn: () => api.get('/clima'), refetchInterval: 10 * 60_000, staleTime: 5 * 60_000 });

export const useCemaden = () =>
  useQuery({ queryKey: ['cemaden'], queryFn: () => api.get('/cemaden'), refetchInterval: 5 * 60_000, staleTime: 2 * 60_000 });

export const useBocasLoboOficiais = (bbox, habilitado = true) =>
  useQuery({ queryKey: ['bocas-lobo-oficiais', bbox], queryFn: () => api.get('/bocas-de-lobo?bbox=' + encodeURIComponent(bbox)), enabled: habilitado && Boolean(bbox), staleTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: false });

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

// Brasil: consulta de fontes oficiais.

export const useNivelBlumenau = () =>
  useQuery({ queryKey: ['brasil', 'blumenau', 'nivel-rio'], queryFn: () => api.get('/brasil/blumenau/nivel-rio'), refetchInterval: 300000, staleTime: 120000, retry: false });

export const useFontesBrasil = () =>
  useQuery({ queryKey: ['brasil', 'fontes'], queryFn: () => api.get('/brasil/fontes'), staleTime: 86400000, retry: false });
