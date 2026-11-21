import { Request, Response } from 'express';
import { IndexUnavailableError } from '../api/bitcoin/index-unavailable-error';

export function handleError(req: Request, res: Response, statusCode: number, errorMessage: string | unknown): void {
  if (req.accepts('json')) {
    res.status(statusCode).json({ error: errorMessage });
  } else {
    res.status(statusCode).send(errorMessage);
  }
}

export function handleIndexUnavailable(req: Request, res: Response, error: unknown): boolean {
  if (!(error instanceof IndexUnavailableError)) { return false; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '1');
  handleError(req, res, 503, error.message);
  return true;
}
