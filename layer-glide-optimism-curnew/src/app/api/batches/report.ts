import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Incoming request body:', req.body);

  const { batchId, reason } = req.body;

  if (!batchId || !reason) {
    return res.status(400).json({ error: 'Batch ID and reason are required' });
  }

  try {
    const batch = await prisma.batch.findUnique({
      where: { id: BigInt(batchId) },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    await prisma.batchChallenge.create({
      data: {
        batchId: BigInt(batchId),
        challengerAddress: '0xAdminAddress', // Replace with actual user address
        status: 'pending',
        createdAt: new Date(),
      },
    });

    res.status(200).json({ message: 'Batch reported successfully' });
  } catch (error) {
    console.error('Error reporting batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}