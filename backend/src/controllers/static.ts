import { RequestHandler } from "express";
import path from 'path';
import { PUBLIC_DIR } from '../config/paths.js';
import { getEnv, getTargetHostname } from "../utils/system.js";
import { AppError } from "../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";
import { Readable } from "node:stream";

export const getIndex: RequestHandler = (req, res, _next) => {
  const hostname = getTargetHostname(req);

  if (hostname === getEnv(process.env.BASE_SITE_DOMAIN, 'localhost')) {
    // TODO - return the html for the SERVICE SITE HOME PAGE
    // return res.sendFile(path.join(PUBLIC_DIR, 'pinoyShop.html'));
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
};

export const getFavicon: RequestHandler = async (req, res, next) => {
  const hostname = getTargetHostname(req);

  // TODO - lookup from Site Configs
  // const assetMap: Record<string, string> = {
  //   'domain1.com': 'https://s3.amazonaws.com',
  //   'domain2.com': 'https://s3.amazonaws.com',
  // };

  // const externalUrl = assetMap[host] || 'https://s3.amazonaws.com';
  const externalUrl = 'https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico';

  try {
    const response = await fetch(externalUrl);

    if (!response.ok) {
      return next(new AppError('Failed to fetch icon', StatusCodes.NOT_FOUND));
    }

    const contentType = response.headers.get('content-type') ?? 'image/x-icon';

    // Set the content type from the S3 response
    res.setHeader('Content-Type', contentType);

    // Convert Web Stream to Node Stream and pipe to Express response
    Readable.fromWeb(response.body as any).pipe(res);
  } catch (error) {
    next(error);
  }
}
