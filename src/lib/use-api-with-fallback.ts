import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Returns API data when available, otherwise mock fallback.
 * Keeps UI functional offline or before API is running.
 */
export function useApiWithFallback<T>(
  query: UseQueryResult<{ items: T[] } | T, Error>,
  fallback: T[],
): { data: T[]; isLive: boolean; isLoading: boolean; error: Error | null } {
  const apiItems =
    query.data && typeof query.data === "object" && "items" in query.data
      ? (query.data as { items: T[] }).items
      : null;

  const isLive = !!apiItems && apiItems.length > 0 && !query.isError;
  const data = isLive ? apiItems : fallback;

  return {
    data,
    isLive,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useApiSingleWithFallback<T>(
  query: UseQueryResult<T, Error>,
  fallback: T,
): { data: T; isLive: boolean } {
  const isLive = !!query.data && !query.isError;
  return { data: isLive ? query.data! : fallback, isLive };
}
