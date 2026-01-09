// TODO - this might make sense to move to a separate file
// Helper to generate the full base URL from the request object
const getBaseUrl = (req) => {
  return `${req.protocol}://${req.get('host')}${req.baseUrl}`;
};

export const paginateResponse = (req, data, totalItems, currentPage, limit) => {
  const totalPages = Math.ceil(totalItems / limit);
  const baseUrl = getBaseUrl(req);
  const currentUrl = new URL(req.originalUrl, baseUrl); // Combine base path and query
  const searchParams = currentUrl.searchParams;

  const buildPageUrl = (page) => {
    // Clone search params to modify page number without affecting original
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('page', page);
    return `${baseUrl}?${newSearchParams.toString()}`;
  };

  const nextPage = currentPage < totalPages ? buildPageUrl(currentPage + 1) : null;
  const prevPage = currentPage > 1 ? buildPageUrl(currentPage - 1) : null;

  return {
    data,
    currentPage: parseInt(currentPage),
    limit: parseInt(limit),
    totalItems,
    totalPages,
    nextPageUrl: nextPage,
    prevPageUrl: prevPage,
  };
};
