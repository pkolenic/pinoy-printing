import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { RequestHandler } from 'express';

export const jwtCheck: RequestHandler = (req, res, next) => {
  const siteConfig = req.tenantConfig.backend;
  const isAuthRequired = siteConfig.settings.requireAuthentication || false;

  const internalJwtCheck = auth({
    audience: siteConfig.auth0.audience,
    issuerBaseURL: `https://${siteConfig.auth0.issuerDomain}/`,
    tokenSigningAlg: siteConfig.auth0.tokenSigningAlgorithm,
  });

  internalJwtCheck(req, res, (err) => {
    // If no error, proceed
    if (!err) {
      return next();
    }

    // If auth is required, pass the error to the global error handler
    if (isAuthRequired) {
      return next(err);
    }

    // If auth is optional, only proceed if the error is due to missing/invalid credentials
    if (err instanceof UnauthorizedError) {
      return next();
    }

    // Pass through any other type of error
    next(err);
  });
};
