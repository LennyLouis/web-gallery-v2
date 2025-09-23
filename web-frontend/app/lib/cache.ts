// Cache global simple pour éviter les requêtes multiples
class SimpleCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; loading: boolean }>();
  private pendingRequests = new Map<string, Promise<T>>();

  set(key: string, data: T, maxAge = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      loading: false
    });

    // Auto-cleanup après maxAge
    setTimeout(() => {
      this.cache.delete(key);
    }, maxAge);
  }

  get(key: string, maxAge = 5 * 60 * 1000): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Vérifier si expiré
    if (Date.now() - cached.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  isLoading(key: string): boolean {
    return this.cache.get(key)?.loading || this.pendingRequests.has(key);
  }

  setLoading(key: string, loading: boolean) {
    const cached = this.cache.get(key);
    if (cached) {
      cached.loading = loading;
    } else {
      this.cache.set(key, {
        data: null as any,
        timestamp: Date.now(),
        loading
      });
    }
  }

  async withCache<Args extends any[]>(
    key: string,
    fetcher: (...args: Args) => Promise<T>,
    maxAge = 5 * 60 * 1000,
    ...args: Args
  ): Promise<T> {
    // Vérifier le cache
    const cached = this.get(key, maxAge);
    if (cached) return cached;

    // Vérifier si une requête est déjà en cours
    const pending = this.pendingRequests.get(key);
    if (pending) return pending;

    // Marquer comme en cours de chargement
    this.setLoading(key, true);

    // Créer la promesse
    const promise = fetcher(...args);
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      this.set(key, result, maxAge);
      return result;
    } finally {
      this.setLoading(key, false);
      this.pendingRequests.delete(key);
    }
  }

  invalidate(key: string) {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Instance globale du cache
export const globalCache = {
  albums: new SimpleCache<any>(),
  photos: new SimpleCache<any>(),
  album: new SimpleCache<any>()
};

// Utilitaire pour créer des clés de cache cohérentes
export const createCacheKey = (prefix: string, ...parts: (string | number | undefined)[]): string => {
  return `${prefix}_${parts.filter(Boolean).join('_')}`;
};