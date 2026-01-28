import { Request } from 'express';
import { SortOrder } from 'mongoose';

export const parsePagination = (req: Request, defaultLimit = 10) => {
  const limit = parseInt((req.query.perPage || req.query.limit) as string, 10) || defaultLimit;
  const page = parseInt(req.query.page as string, 10) || 1;
  const skip = (page - 1) * limit;
  return { limit, page, skip };
};

export const buildSort = (sortBy: string | undefined, allowedFields: string[], defaultField = 'name') => {
  let sortField = defaultField;
  let sortOrder: SortOrder = 'asc';

  if (sortBy) {
    const fieldFromQuery = sortBy.replace(/^-/, '');
    if (allowedFields.includes(fieldFromQuery)) {
      sortField = fieldFromQuery;
      sortOrder = sortBy.startsWith('-') ? 'desc' : 'asc';
    }
  }
  return { [sortField]: sortOrder } as { [key: string]: SortOrder };
};
