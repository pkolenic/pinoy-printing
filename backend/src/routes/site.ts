import { RequestHandler, Request, Router } from 'express';
import { SiteConfiguration } from "../models/index.js";
import { AppError } from "../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";

const router = Router();

const getTargetHostname = (req: Request): string => {
  // Check for the override first (useful for Dev and potentially QA/Preview environments)
  const siteOverride = req.query.SITE as string;

  if (process.env.NODE_ENV === 'development' && siteOverride) {
    return siteOverride;
  }

  // Fallback to standard hostname
  return req.hostname;
};

const getSiteConfiguration: RequestHandler = async (req, res, next) => {
  try {
    let hostname = getTargetHostname(req);

    // Exclude id and host properties
    const siteConfig = await SiteConfiguration.findOne({ host: hostname })
      .select('-_id -host');

    if (!siteConfig) {
      return next(new AppError('Site Configuration not found', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json(siteConfig);
  } catch (error) {
    next(error);
  }
};

router.get('/', getSiteConfiguration);

export default router;
