import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'
import prisma from '../../lib/prisma'
import crypto from 'crypto'

type ErrorResponse = { error: string }
type SuccessResponse = { ok: true; listId?: number }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Ikke innlogget' })
  const userId = session.user.id

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }

  const { action, listId, email, targetUserId, token } = req.body as {
    action?: string
    listId?: number
    email?: string
    targetUserId?: number
    token?: string
  }

  // --- add: invite viewer by email ---
  if (action === 'add') {
    if (!listId || !email?.trim()) return res.status(400).json({ error: 'listId og email er påkrevd' })
    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan dele listen' })

    const target = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!target) return res.status(404).json({ error: 'Ingen bruker med den e-postadressen' })
    if (target.id === userId) return res.status(400).json({ error: 'Du kan ikke dele med deg selv' })

    await prisma.wishListShare.upsert({
      where: { listId_userId: { listId, userId: target.id } },
      create: { listId, userId: target.id },
      update: {},
    })
    return res.status(200).json({ ok: true })
  }

  // --- remove: revoke a viewer's access ---
  if (action === 'remove') {
    if (!listId || !targetUserId) return res.status(400).json({ error: 'listId og targetUserId er påkrevd' })
    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan fjerne tilgang' })

    await prisma.wishListShare.deleteMany({ where: { listId, userId: targetUserId } })
    return res.status(200).json({ ok: true })
  }

  // --- generate-token: create or replace invite link token ---
  if (action === 'generate-token') {
    if (!listId) return res.status(400).json({ error: 'listId er påkrevd' })
    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan generere invitasjonslenke' })

    const shareToken = crypto.randomBytes(24).toString('hex')
    await prisma.wishList.update({ where: { id: listId }, data: { shareToken } })
    return res.status(200).json({ ok: true })
  }

  // --- revoke-token: remove invite link ---
  if (action === 'revoke-token') {
    if (!listId) return res.status(400).json({ error: 'listId er påkrevd' })
    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan trekke tilbake invitasjonslenke' })

    await prisma.wishList.update({ where: { id: listId }, data: { shareToken: null } })
    return res.status(200).json({ ok: true })
  }

  // --- join: accept invite link (authenticated user) ---
  if (action === 'join') {
    if (!token?.trim()) return res.status(400).json({ error: 'token er påkrevd' })

    const list = await prisma.wishList.findUnique({ where: { shareToken: token.trim() } })
    if (!list) return res.status(404).json({ error: 'Ugyldig eller utløpt invitasjonslenke' })
    if (list.ownerId === userId) return res.status(200).json({ ok: true, listId: list.id })

    await prisma.wishListShare.upsert({
      where: { listId_userId: { listId: list.id, userId } },
      create: { listId: list.id, userId },
      update: {},
    })
    return res.status(200).json({ ok: true, listId: list.id })
  }

  return res.status(400).json({ error: 'Ugyldig handling' })
}
