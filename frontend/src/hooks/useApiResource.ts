import { useCallback, useEffect, useState } from 'react';

export interface ApiResourceState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  /** Re-runs the loader. */
  reload: () => void;
  /** Replaces the cached value without a round trip (e.g. after a mutation). */
  setData: (value: T | null) => void;
}

/**
 * Loads a single backend resource, cancelling the in-flight request when the
 * loader changes or the component unmounts.
 *
 * Pass `null` as the loader when there is nothing to fetch yet (for example
 * while no incident is selected).
 */
export function useApiResource<T>(loader: ((signal: AbortSignal) => Promise<T>) | null): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(loader !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    if (!loader) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    loader(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unknown API error');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [loader, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, isLoading, error, reload, setData };
}
