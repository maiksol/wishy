import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'
import prisma from '../../lib/prisma'
import type { WishList } from '@prisma/client'

type ListWithCount = WishList & { _count: { wishes: number } }
type ErrorResponse = { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WishList | ListWithCount | ListWithCount[] | ErrorResponse>
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Ikke innlogget' })
  const userId = session.user.id

  if (req.method === 'GET') {
    const { id } = req.query
    if (id) {
      const list = await prisma.wishList.findUnique({ where: { id: Number(id) } })
      if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
      const isOwner = list.ownerId === userId
      const isViewer = await prisma.wishListShare.findUnique({
        where: { listId_userId: { listId: list.id, userId } },
      })
      if (!isOwner && !isViewer) return res.status(403).json({ error: 'Ingen tilgang' })
      return res.status(200).json(list)
    }

    const lists = await prisma.wishList.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { shares: { some: { userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { wishes: true } } },
    })
    return res.status(200).json(lists)
  }

  if (req.method === 'POST') {
    const { name, theme } = req.body as { name?: string; theme?: string | null }
    if (!name?.trim()) return res.status(400).json({ error: 'Navn er påkrevd' })
    const list = await prisma.wishList.create({
      data: { name: name.trim(), theme: theme ?? null, ownerId: userId },
    })
    return res.status(201).json(list)
  }

  if (req.method === 'PATCH') {
    const { id } = req.query
    const list = await prisma.wishList.findUnique({ where: { id: Number(id) } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Ingen tilgang' })
    const { name, theme } = req.body as { name?: string; theme?: string | null }
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Navn kan ikke være tomt' })
    const updated = await prisma.wishList.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(theme !== undefined && { theme: theme ?? null }),
      },
    })
    return res.status(200).json(updated)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    const list = await prisma.wishList.findUnique({ where: { id: Number(id) } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Ingen tilgang' })
    await prisma.wishList.delete({ where: { id: Number(id) } })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
  res.status(405).end()
}
