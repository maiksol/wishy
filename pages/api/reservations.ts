import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/[...nextauth]'
import prisma from '../../lib/prisma'

type ErrorResponse = { error: string }
type ReservationResponse = { id: number; wishId: number; userId: number; status: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReservationResponse | ErrorResponse | Record<string, never>>
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Ikke innlogget' })
  const userId = session.user.id

  // POST: create or update a reservation
  if (req.method === 'POST') {
    const { wishId, status } = req.body as { wishId?: number; status?: string }
    if (!wishId) return res.status(400).json({ error: 'wishId er påkrevd' })
    if (!status || !['reservert', 'kjopt'].includes(status))
      return res.status(400).json({ error: 'status må være "reservert" eller "kjopt"' })

    const wish = await prisma.wish.findUnique({
      where: { id: wishId },
      include: { list: true },
    })
    if (!wish) return res.status(404).json({ error: 'Ønske ikke funnet' })

    // Owner cannot reserve their own wishes
    if (wish.list.ownerId === userId)
      return res.status(403).json({ error: 'Du kan ikke reservere dine egne ønsker' })

    // Must have access to the list
    const share = await prisma.wishListShare.findUnique({
      where: { listId_userId: { listId: wish.listId, userId } },
    })
    if (!share) return res.status(403).json({ error: 'Ingen tilgang til listen' })

    // Check if someone else already reserved it
    const existing = await prisma.reservation.findUnique({ where: { wishId } })
    if (existing && existing.userId !== userId)
      return res.status(409).json({ error: 'Ønsket er allerede reservert av noen andre' })

    const reservation = await prisma.reservation.upsert({
      where: { wishId },
      create: { wishId, userId, status },
      update: { status },
    })
    return res.status(200).json(reservation)
  }

  // DELETE: remove a reservation (undo)
  if (req.method === 'DELETE') {
    const wishId = Number(req.query.wishId)
    if (!wishId) return res.status(400).json({ error: 'wishId er påkrevd' })

    const reservation = await prisma.reservation.findUnique({ where: { wishId } })
    if (!reservation) return res.status(404).json({ error: 'Reservasjon ikke funnet' })
    if (reservation.userId !== userId)
      return res.status(403).json({ error: 'Du kan bare angre dine egne reservasjoner' })

    await prisma.reservation.delete({ where: { wishId } })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).end()
}
