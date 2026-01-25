import { auth } from 'express-oauth2-jwt-bearer';

export const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_ISSUER_DOMAIN}`,
  tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG,
});
