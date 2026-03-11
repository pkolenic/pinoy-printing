import { RequestHandler } from "express";
import { AppError } from "../utils/errors/index.js";
import { StatusCodes } from "http-status-codes";

export const getSiteConfiguration: RequestHandler = async (req, res, next) => {
  try {
    if (!req.tenantConfig) {
      return next(new AppError('Site Configuration not found', StatusCodes.NOT_FOUND));
    }

    res.status(StatusCodes.OK).json(req.tenantConfig.frontend);
  } catch (error) {
    next(error);
  }
};
