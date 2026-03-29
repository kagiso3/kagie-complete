import type { NextFunction, Request, Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({
    error: "Not Found",
    message: "The Kagie API route you requested does not exist."
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;

  return res.status(status).json({
    error: status >= 500 ? "Server Error" : "Request Error",
    message
  });
}
