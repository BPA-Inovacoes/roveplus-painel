import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import type { AuthPayload } from './auth.js'

export function auditLog(action: string, entity: string, entityId?: number, details?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthPayload }).user
    if (!user) return next()
    const originalJson = res.json.bind(res)
    res.json = function (body: unknown) {
      prisma.auditLog
        .create({
          data: {
            userId: user.userId,
            action,
            entity,
            entityId: entityId ?? (body as { id?: number })?.id,
            details: details ?? undefined,
          },
        })
        .catch(() => {})
      return originalJson(body)
    }
    next()
  }
}
