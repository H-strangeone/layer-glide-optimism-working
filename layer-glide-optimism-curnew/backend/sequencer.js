import { ethers } from 'ethers';

const BATCH_SIZE    = 20;
const INTERVAL_MS   = 10_000; // 10 seconds
const MIN_BATCH     = 1;      // For demo: batch even 1 tx

export function startSequencer({ contract, wallet, broadcast, stateManager, prisma }) {
  if (!contract || !wallet) {
    console.log('⚠️ Sequencer: no contract — polling only (DB mode)');
    // Still run in DB-only mode so batch records are created
  }

  console.log('🚀 Sequencer started');

  setInterval(async () => {
    let txIds = [];
    try {
      const pending = await prisma.pendingTransaction.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (pending.length < MIN_BATCH) {
        if (pending.length > 0) console.log(`⏳ Waiting... ${pending.length} pending`);
        return;
      }

      console.log(`📦 Building batch: ${pending.length} txs`);
      txIds = pending.map(t => t.id);

      // Mark as processing
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } }, data: { status: 'processing' }
      });

      // Execute state transition
      const { preStateRoot, txRoot, postStateRoot, txLeaves } = await stateManager.executeBatch(pending);

      // Create batch record
      const batch = await prisma.batch.create({
        data: {
          transactionsRoot: txRoot,    // TX root
          stateRoot:        postStateRoot,
          prevStateRoot:    preStateRoot,
          status:           'pending_submission',
          txCount:          pending.length,
        }
      });

      // Link transactions
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data: { batchId: batch.id, status: 'batched' }
      });

      console.log(`🧱 Batch created in DB: ${batch.id}`);

      // Submit to chain
      if (contract && wallet) {
        let receipt;
        try {
          const tx = await contract.submitBatch(txRoot, postStateRoot, pending.length);
          receipt  = await tx.wait();
        } catch (err) {
          console.error('❌ Chain submission failed:', err.message);
          await prisma.pendingTransaction.updateMany({
            where: { id: { in: txIds } }, data: { status: 'pending', batchId: null }
          });
          await prisma.batch.update({ where: { id: batch.id }, data: { status: 'failed' } });
          return;
        }

        // Parse BatchSubmitted event
        let onChainId = null;
        for (const log of receipt.logs) {
          try {
            const iface = contract.interface;
            const parsed = iface.parseLog(log);
            if (parsed.name === 'BatchSubmitted') {
              onChainId = parsed.args.batchId.toString();
              break;
            }
          } catch {}
        }

        if (!onChainId) {
          console.error('❌ BatchSubmitted event not found');
          return;
        }

        // Check for duplicate
        const existing = await prisma.batch.findUnique({ where: { onChainId } });
        if (existing && existing.id !== batch.id) {
          console.log(`⚠️ Duplicate onChainId=${onChainId}, skipping`);
          return;
        }

        const challengePeriodSec = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300');
        const challengeEndsAt    = new Date(Date.now() + challengePeriodSec * 1000);

        await prisma.batch.update({
          where: { id: batch.id },
          data: {
            onChainId,
            status:         'challenge_period',
            challengeEndsAt,
            submitter:      wallet.address,
            onChainTxHash:  receipt.transactionHash,
          }
        });

        console.log(`✅ Batch on-chain: onChainId=${onChainId} txHash=${receipt.transactionHash.slice(0, 10)}...`);
        broadcast('batch_created', {
          id: batch.id, onChainId, txCount: pending.length,
          txRoot, stateRoot: postStateRoot, challengeEndsAt: challengeEndsAt.toISOString(),
        });
      } else {
        // DB-only — simulate challenge period
        const challengeEndsAt = new Date(Date.now() + 60_000); // 1 min for demo
        await prisma.batch.update({
          where: { id: batch.id },
          data: { status: 'challenge_period', challengeEndsAt }
        });

        console.log(`✅ Batch created (DB-only mode): ${batch.id}`);
        broadcast('batch_created', {
          id: batch.id, onChainId: null, txCount: pending.length,
          txRoot, stateRoot: postStateRoot,
        });
      }

    } catch (err) {
      console.error('❌ Sequencer error:', err.message);
      if (txIds.length > 0) {
        await prisma.pendingTransaction.updateMany({
          where: { id: { in: txIds } }, data: { status: 'pending', batchId: null }
        }).catch(() => {});
      }
    }
  }, INTERVAL_MS);
}