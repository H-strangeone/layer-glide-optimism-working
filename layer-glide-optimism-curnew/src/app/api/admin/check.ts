import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'A valid address is required' });
  }

  try {
    const user = await prisma.operator.findUnique({
      where: { address },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = user.isActive;
    res.status(200).json({ isAdmin });
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}