import { Request } from 'express';

// TODO - this might make sense to move to a separate file
/**
 * Helper to generate the full base URL from the request object.
 * Private to this file as it's an internal utility.
 */
const getBaseUrl = (req: Request): string => {
  return `${req.protocol}://${req.get('host')}${req.baseUrl}`;
};

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
  currentPage: number,
  limit: number,
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(totalItems / limit);
  const baseUrl = getBaseUrl(req);

  // URL constructor handles path and query string merging safely
  const currentUrl = new URL(req.originalUrl, baseUrl);
  const searchParams = currentUrl.searchParams;

  /**
   * Helper to construct a URL for a specific page number
   */
  const buildPageUrl = (page: number): string => {
    // Clone search params to modify page number without affecting original
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', page.toString());
    return `${baseUrl}?${newSearchParams.toString()}`;
  };

  const nextPage = currentPage < totalPages ? buildPageUrl(currentPage + 1) : null;
  const prevPage = currentPage > 1 ? buildPageUrl(currentPage - 1) : null;

  return {
    data,
    currentPage: currentPage,
    limit: limit,
    totalItems,
    totalPages,
    nextPageUrl: nextPage,
    prevPageUrl: prevPage,
  };
};
