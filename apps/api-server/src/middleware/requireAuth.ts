import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  next();
}

export function requireStoreAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const urlStoreId = Number(req.params.storeId);
  if (urlStoreId && urlStoreId !== req.session.storeId) {
    res.status(403).json({ error: "ممنوع" });
    return;
  }
  next();
}

export function requireProviderAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.providerUserId) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  next();
}
