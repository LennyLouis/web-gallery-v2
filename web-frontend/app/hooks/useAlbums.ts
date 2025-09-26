import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Album } from '~/lib/supabase';
import { globalCache, createCacheKey } from '~/lib/cache';

interface UseAlbumsOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number; // en millisecondes
}

export function useAlbums(token?: string, options: UseAlbumsOptions = {}) {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    staleTime = 5 * 60 * 1000 // 5 minutes par défaut
  } = options;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const mountedRef = useRef(true);

  const cacheKey = createCacheKey('albums', token || 'default');

  const fetchAlbums = useCallback(async (force = false) => {
    if (!enabled || !token || !mountedRef.current) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await globalCache.albums.withCache(
        cacheKey,
        async () => {
          const apiResult = await api.getAlbums(token);
          return apiResult.albums || [];
        },
        force ? 0 : staleTime // Si force, bypass cache
      );

      if (mountedRef.current) {
        setAlbums(result);
        setError('');
      }
    } catch (err: any) {
      console.error('❌ useAlbums: Error fetching albums:', err);
      if (mountedRef.current) {
        setError(err.message || 'Erreur lors du chargement des albums');
        setAlbums([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, token, cacheKey, staleTime]);

  // Fonction pour invalider le cache
  const invalidateCache = useCallback(() => {
    globalCache.albums.invalidate(cacheKey);
    fetchAlbums(true);
  }, [cacheKey, fetchAlbums]);

  const refetch = useCallback(() => {
    return fetchAlbums(true);
  }, [fetchAlbums]);

  // Charger les albums au montage
  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // Gérer le focus de la fenêtre avec debounce
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    let timeoutId: NodeJS.Timeout;
    const handleFocus = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Seulement refetch si les données sont stale
        const cached = globalCache.albums.get(cacheKey, staleTime);
        if (!cached && mountedRef.current) {
          fetchAlbums();
        }
      }, 1000); // Debounce de 1 seconde
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(timeoutId);
    };
  }, [refetchOnWindowFocus, fetchAlbums, cacheKey, staleTime]);

  // Cleanup à la désactivation
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    albums,
    loading,
    error,
    refetch,
    invalidateCache
  };
}