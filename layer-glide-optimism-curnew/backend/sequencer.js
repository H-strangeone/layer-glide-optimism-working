/**
 * Sequencer
 *
 * Collects pending txs, simulates execution, submits batch on-chain.
 * Does NOT finalize balances — that happens via BatchFinalized event.
 */

import { ethers } from 'ethers';

const BATCH_SIZE  = 20;
const INTERVAL_MS = 10_000; // 10 seconds
const MIN_BATCH   = 1;       // batch even 1 tx for demo; raise to 5+ for prod

export function startSequencer({ contract, wallet, broadcast, stateManager, prisma }) {
  if (!contract || !wallet) {
    console.log('⚠️  Sequencer: no contract — DB-only mode (batches won\'t go on-chain)');
  }
  console.log(`🚀 Sequencer started (interval: ${INTERVAL_MS}ms, min: ${MIN_BATCH} txs)`);

  setInterval(async () => {
    let txIds = [];
    try {
      const pending = await prisma.pendingTransaction.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (pending.length < MIN_BATCH) return;

      console.log(`📦 Building batch: ${pending.length} txs`);
      txIds = pending.map(t => t.id);

      // Mark as processing (prevents double-batching)
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } }, data: { status: 'processing' }
      });

      // Execute state transition (off-chain simulation)
      const { preStateRoot, txRoot, postStateRoot } = await stateManager.executeBatch(pending);

      // Create DB batch record
      const batch = await prisma.batch.create({
        data: {
          transactionsRoot: txRoot,
          stateRoot:        postStateRoot,
          prevStateRoot:    preStateRoot,
          status:           'pending_submission',
          txCount:          pending.length,
        }
      });

      // Link txs to batch
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data: { batchId: batch.id, status: 'batched' }
      });

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
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === 'BatchSubmitted') {
              onChainId = parsed.args.batchId.toString();
              break;
            }
          } catch {}
        }

        if (!onChainId) {
          console.error('❌ BatchSubmitted event not found in receipt');
          return;
        }

        // Duplicate guard
        const dup = await prisma.batch.findUnique({ where: { onChainId } });
        if (dup && dup.id !== batch.id) {
          console.log(`⚠️  Duplicate onChainId=${onChainId}`);
          return;
        }

        const challengeEndsAt = new Date(Date.now() + parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000);

        await prisma.batch.update({
          where: { id: batch.id },
          data: {
            onChainId,
            status:         'challenge_period',
            challengeEndsAt,
            submitter:      wallet.address.toLowerCase(),
            onChainTxHash:  receipt.transactionHash,
          }
        });

        console.log(`✅ Batch on-chain: id=${onChainId} stateRoot=${postStateRoot.slice(0,12)}...`);
        broadcast('batch_created', {
          id: batch.id, onChainId, txCount: pending.length,
          txRoot, stateRoot: postStateRoot, challengeEndsAt: challengeEndsAt.toISOString(),
        });
      } else {
        // DB-only: simulate challenge period
        const challengeEndsAt = new Date(Date.now() + parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300') * 1000);
        await prisma.batch.update({
          where: { id: batch.id },
          data: { status: 'challenge_period', challengeEndsAt }
        });
        console.log(`✅ Batch created (DB-only): ${batch.id}`);
        broadcast('batch_created', { id: batch.id, onChainId: null, txCount: pending.length, txRoot, stateRoot: postStateRoot });
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