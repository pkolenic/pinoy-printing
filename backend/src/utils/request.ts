import { Request, Response, NextFunction } from 'express';

// Define this in a shared types file
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;
