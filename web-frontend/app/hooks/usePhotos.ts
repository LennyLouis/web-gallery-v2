import { useState, useEffect, useRef } from 'react';
import { api, type Photo } from '~/lib/supabase';
import { useDebounce } from './useDebounce';

interface UsePhotosOptions {
  albumId?: string;
  token?: string;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  cacheTime?: number;
}

interface UsePhotosReturn {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache simple pour les photos
const photosCache = new Map<string, { data: Photo[]; timestamp: number }>();

export function usePhotos(options: UsePhotosOptions = {}): UsePhotosReturn {
  const {
    albumId,
    token,
    enabled = true,
    refetchOnWindowFocus = false,
    cacheTime = 10 * 60 * 1000, // 10 minutes par défaut
  } = options;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchPhotos = async () => {
    if (!albumId || !enabled || !token) return;

    // Vérifier le cache
    const cacheKey = `photos-${albumId}-${token}`;
    const cached = photosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setPhotos(cached.data);
      setLoading(false);
      return;
    }

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError(null);

      console.log(`🖼️ [${new Date().toISOString()}] Fetching photos for album: ${albumId}`);

      const result = await api.getPhotos(albumId, token);

      if (!mountedRef.current) return;

      const photosData = result.photos || [];
      console.log(`🖼️ Got ${photosData.length} photos for album ${albumId}`);
      setPhotos(photosData);

      // Mettre en cache
      photosCache.set(cacheKey, {
        data: photosData,
        timestamp: Date.now()
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || !mountedRef.current) return;
      
      console.error('Photos fetch error:', err);
      setError(err.message || 'Erreur lors du chargement des photos');
      setPhotos([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  };

  // Debounce pour éviter les requêtes trop fréquentes
  const debouncedFetch = useDebounce(fetchPhotos, 300);

  const refetch = async () => {
    if (!albumId || !token) return;
    
    // Invalider le cache avant de refetch
    const cacheKey = `photos-${albumId}-${token}`;
    photosCache.delete(cacheKey);
    
    await fetchPhotos();
  };

  // Fetch initial
  useEffect(() => {
    if (enabled && albumId && token) {
      fetchPhotos(); // Utiliser fetchPhotos directement pour l'initial
    }
  }, [albumId, token, enabled]);

  // Window focus refetch avec debounce
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (enabled && albumId && token) {
        console.log('🖼️ Window focus detected, checking cache...');
        // Vérifier si le cache est stale avant de refetch
        const cacheKey = `photos-${albumId}-${token}`;
        const cached = photosCache.get(cacheKey);
        if (!cached || Date.now() - cached.timestamp > cacheTime) {
          fetchPhotos(); // Utiliser fetchPhotos directement
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, albumId, token, cacheTime]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    photos,
    loading,
    error,
    refetch,
  };
}