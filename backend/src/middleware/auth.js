import { auth } from 'express-oauth2-jwt-bearer';

const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_ISSUER_DOMAIN}`,
  tokenSigningAlg: process.env.AUTH0_TOKEN_SIGNING_ALG,
});

export default jwtCheck;
