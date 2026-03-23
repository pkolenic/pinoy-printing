import path from 'path';
import fs from 'fs';
import { StatusCodes } from "http-status-codes";
import { Readable } from "node:stream";
import { PUBLIC_DIR } from '../constants/paths.js';
import { AsyncRequestHandler } from "../utils/request.js";
import { AppError } from "../utils/errors/index.js";
import { logger } from '../utils/logging/logger.js';

export const getIndex: AsyncRequestHandler = async (_req, res, _next) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
};

export const getFavicon: AsyncRequestHandler = async (req, res, next) => {
  const tenantFavIconUrl = req.tenantConfig.backend.static.favIcon;

  // 1. Remote Tenant Fetch
  if (tenantFavIconUrl && tenantFavIconUrl.startsWith('http')) {
    try {
      const response = await fetch(tenantFavIconUrl);
      if (response.ok) {
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'image/x-icon');
        Readable.fromWeb(response.body as any).pipe(res);
        return;
      }
    } catch (error) {
      logger.error({ message: `Remote icon fetch failed: ${tenantFavIconUrl}`, args: [error] });
    }
  }

  // 2. Local Fallback logic
  let fileName = path.basename(req.path);
  let localFilePath = path.join(PUBLIC_DIR, 'favicon', fileName);

  // Special Handling: If precomposed is requested but missing, use the standard one
  if (fileName === 'apple-touch-icon-precomposed.png' && !fs.existsSync(localFilePath)) {
    fileName = 'apple-touch-icon.png';
    localFilePath = path.join(PUBLIC_DIR, 'site', fileName);
  }

  res.sendFile(localFilePath, (err) => {
    if (err) {
      return next(new AppError('Resource not found', StatusCodes.NOT_FOUND));
    }
  });
};

/**
 * Named handler to silently 404 well-known requests.
 * Named specifically for route stack verification in tests.
 */
export const getWellKnownNotFound: AsyncRequestHandler = async (_req, res) => {
  res.status(StatusCodes.NOT_FOUND).end();
};
