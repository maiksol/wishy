import type { NextApiRequest, NextApiResponse } from 'next'
import { hash } from 'bcryptjs'
import prisma from '../../lib/prisma'

type ResponseData = { id: number; name: string; email: string; listId?: number } | { error: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }

  const { name, email, password, token } = req.body as {
    name?: string
    email?: string
    password?: string
    token?: string
  }

  if (!name?.trim()) return res.status(400).json({ error: 'Navn er påkrevd' })
  if (!email?.trim()) return res.status(400).json({ error: 'E-post er påkrevd' })
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Passordet må være minst 8 tegn' })

  const normalizedEmail = email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) return res.status(409).json({ error: 'E-post er allerede i bruk' })

  const passwordHash = await hash(password, 10)
  const user = await prisma.user.create({
    data: { name: name.trim(), email: normalizedEmail, passwordHash },
  })

  // If an invite token was provided, auto-join that list
  let listId: number | undefined
  if (token) {
    const list = await prisma.wishList.findUnique({ where: { shareToken: token } })
    if (list) {
      await prisma.wishListShare.upsert({
        where: { listId_userId: { listId: list.id, userId: user.id } },
        create: { listId: list.id, userId: user.id },
        update: {},
      })
      listId = list.id
    }
  }

  return res.status(201).json({ id: user.id, name: user.name, email: user.email, listId })
}
