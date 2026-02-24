import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { RequestHandler } from 'express';
import { getEnv } from "../utils/system.js";

const internalJwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_ISSUER_DOMAIN}`,
  tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG,
});

export const jwtCheck: RequestHandler = (req, res, next) => {
  const isAuthRequired = getEnv(process.env.REQUIRE_AUTHENTICATION, false);

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
