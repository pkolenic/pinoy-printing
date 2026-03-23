import express, { Request, Response, RequestHandler, NextFunction} from 'express';
import request from 'supertest';
import { StatusCodes } from "http-status-codes";

// Helper to manually trigger the middleware chain
export async function validate(rules: any[], data: any, params?: any, query?: any) {
  const req = {
    body: data,
    params: params,
    query: query,
  } as Request;

  // IMPORTANT: Filter out the custom middleware function
  // and only run the ValidationChain objects
  const chains = rules.filter(rule => typeof rule.run === 'function');

  await Promise.all(chains.map(rule => rule.run(req)));
  return req;
}

/**
 * Creates a Supertest instance for testing specific validation rules.
 * @param rules - The validation middleware array (e.g., createCategoryRules)
 * @param method - The HTTP method to simulate ('post', 'put', etc.)
 */
export function createValidationTester(rules: RequestHandler[], method: 'post' | 'put' = 'post') {
  const app = express();
  app.use(express.json());

  // Mount the rules on a generic test path
  app[method]('/test-validation', rules, (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ message: 'Success' });
  });

  return {
    // Return a function to easily send data to the test path
    send: (data: object) => request(app)[method]('/test-validation').send(data),
    // Helper to simulate a request with a file attached
    sendWithFile: (data: object, file: any) => {
      const appWithFile = express();
      appWithFile.use(express.json());
      appWithFile[method]('/test-validation', (req: Request, _res: Response, next: NextFunction) => {
        req.file = file; // Manually attach the mock file
        next();
      }, rules, (_req: Request, res: Response) => res.status(200).json({ message: 'Success' }));

      return request(appWithFile)[method]('/test-validation').send(data);
    }
  };
}
