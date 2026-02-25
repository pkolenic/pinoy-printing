import { RequestHandler } from "express";
import { SiteConfiguration } from "../models/index.js";
import { AppError } from "../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";
import { getTargetHostname } from "../utils/system.js";

export const getSiteConfiguration: RequestHandler = async (req, res, next) => {
  try {
    let hostname = getTargetHostname(req);

    // Exclude id and host properties
    const siteConfig = await SiteConfiguration.findOne({ host: hostname })
      .select('-_id -host');

    if (!siteConfig) {
      return next(new AppError('Site Configuration not found', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json(siteConfig.frontend);
  } catch (error) {
    next(error);
  }
};
