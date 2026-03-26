import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'
import prisma from '../../lib/prisma'

type WishWithReservation = {
  id: number
  title: string
  description: string | null
  url: string | null
  createdAt: Date
  listId: number
  reservation: {
    id: number
    status: string
    userId: number
    user: { id: number; name: string }
  } | null
}

type ErrorResponse = { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WishWithReservation | WishWithReservation[] | ErrorResponse>
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Ikke innlogget' })
  const userId = session.user.id

  if (req.method === 'GET') {
    const listId = Number(req.query.listId)
    if (!listId) return res.status(400).json({ error: 'listId er påkrevd' })

    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })

    const isOwner = list.ownerId === userId
    const share = await prisma.wishListShare.findUnique({
      where: { listId_userId: { listId, userId } },
    })
    if (!isOwner && !share) return res.status(403).json({ error: 'Ingen tilgang' })

    const wishes = await prisma.wish.findMany({
      where: { listId },
      orderBy: { createdAt: 'desc' },
      include: {
        reservation: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })

    // Owner never sees reservation data
    const result = wishes.map((w) => ({
      ...w,
      reservation: isOwner ? null : w.reservation,
    }))

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const { title, description, url, listId } = req.body as {
      title?: string
      description?: string
      url?: string
      listId?: number
    }
    if (!title?.trim()) return res.status(400).json({ error: 'Tittel er påkrevd' })
    if (!listId) return res.status(400).json({ error: 'listId er påkrevd' })

    const list = await prisma.wishList.findUnique({ where: { id: listId } })
    if (!list) return res.status(404).json({ error: 'Liste ikke funnet' })
    if (list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan legge til ønsker' })

    const wish = await prisma.wish.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        url: url?.trim() || null,
        listId,
      },
      include: { reservation: { include: { user: { select: { id: true, name: true } } } } },
    })
    return res.status(201).json(wish)
  }

  if (req.method === 'DELETE') {
    const wishId = Number(req.query.id)
    const wish = await prisma.wish.findUnique({ where: { id: wishId }, include: { list: true } })
    if (!wish) return res.status(404).json({ error: 'Ønske ikke funnet' })
    if (wish.list.ownerId !== userId) return res.status(403).json({ error: 'Kun eieren kan slette ønsker' })
    await prisma.wish.delete({ where: { id: wishId } })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
  res.status(405).end()
}
