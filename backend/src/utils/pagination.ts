import { Request } from 'express';

/**
 * Interface representing the standardized pagination structure.
 */
export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  nextPageUrl: string | null;
  prevPageUrl: string | null;
}

/**
 * Formats a raw data set into a standardized paginated JSON response.
 * @template T - The type of the data items being paginated.
 */
export const paginateResponse = <T>(
  req: Request,
  data: T[],
  totalItems: number,
  currentPage: number = 1,
  limit: number = 10,
): PaginatedResponse<T> => {
  // Safety: Prevent division by zero if the limit is accidentally 0 or negative
  const safeLimit = limit > 0 ? limit : 10;
  const totalPages = Math.ceil(totalItems / safeLimit);

  // Get protocol and host (e.g., http://localhost:3000)
  const protocolHost = `${req.protocol}://${req.get('host')}`;

  // URL constructor handles full originalUrl (path + query params)
  const currentUrl = new URL(req.originalUrl, protocolHost);

  /**
   * Helper to construct a URL for a specific page number
   */
  const buildPageUrl = (page: number): string => {
    const newSearchParams = new URLSearchParams(currentUrl.searchParams);
    newSearchParams.set('page', page.toString());
    newSearchParams.set('limit', safeLimit.toString());

    // Use pathname (e.g., /api/categories) to avoid req.baseUrl nesting issues
    return `${protocolHost}${currentUrl.pathname}?${newSearchParams.toString()}`;
  };

  return {
    data,
    currentPage,
    limit: safeLimit,
    totalItems,
    totalPages,
    nextPageUrl: currentPage < totalPages ? buildPageUrl(currentPage + 1) : null,
    prevPageUrl: currentPage > 1 ? buildPageUrl(currentPage - 1) : null,
  };
};
