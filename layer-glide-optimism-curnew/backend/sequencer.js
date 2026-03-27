/**
 * Sequencer
 *
 * Collects pending txs, simulates execution, submits batch on-chain.
 * Does NOT finalize balances — that happens via BatchFinalized event.
 *
 * KEY FIXES:
 * 1. If all txs in a batch are skipped (e.g. all insufficient), the txRoot
 *    is the zero-hash and the contract will revert with "Empty txRoot".
 *    Now we check: if executeBatch produced zero successful txLeaves, abort.
 * 2. Failed/uncommitted DB batch records are cleaned up properly.
 * 3. Txs that fail the in-memory simulation are put back to 'pending' not orphaned.
 */

import { ethers } from 'ethers';

const BATCH_SIZE  = 20;
const INTERVAL_MS = 10_000; // 10 seconds
const MIN_BATCH   = 1;      // minimum txs to build a batch

export function startSequencer({ contract, wallet, broadcast, stateManager, prisma }) {
  if (!contract || !wallet) {
    console.log('⚠️  Sequencer: no contract — DB-only mode (batches won\'t go on-chain)');
  }
  console.log(`🚀 Sequencer started (interval: ${INTERVAL_MS}ms, min: ${MIN_BATCH} txs)`);

  setInterval(async () => {
    let txIds   = [];
    let batchId = null;

    try {
      const pending = await prisma.pendingTransaction.findMany({
        where:   { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take:    BATCH_SIZE,
      });

      if (pending.length < MIN_BATCH) return;

      console.log(`📦 Building batch: ${pending.length} txs`);
      txIds = pending.map(t => t.id);

      // Mark as processing to prevent double-batching
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data:  { status: 'processing' },
      });

      // Execute state transition off-chain
      const { preStateRoot, txRoot, postStateRoot, txLeaves, txResults } =
        await stateManager.executeBatch(pending);

      // CRITICAL: if txRoot is the zero-hash, no valid txs were executed
      // The contract will revert with "Empty txRoot" — abort here instead
      const ZERO_HASH = '0x' + '0'.repeat(64);
      if (txRoot === ZERO_HASH || txLeaves.length === 0) {
        console.warn('⚠️  All txs in batch were skipped (insufficient balance or self-transfer) — aborting batch');
        // Put these txs back to pending so they can be retried or expire
        await prisma.pendingTransaction.updateMany({
          where: { id: { in: txIds } },
          data:  { status: 'pending' },
        });
        return;
      }

      // Count how many txs actually succeeded
      const successCount = txResults.filter(r => r.success).length;
      const skipCount    = txResults.filter(r => !r.success).length;
      if (skipCount > 0) {
        console.warn(`⚠️  ${skipCount} txs skipped in batch (insufficient or self-transfer)`);
      }

      // Create DB batch record
      const batch = await prisma.batch.create({
        data: {
          transactionsRoot: txRoot,
          stateRoot:        postStateRoot,
          prevStateRoot:    preStateRoot,
          status:           'pending_submission',
          txCount:          successCount,
        }
      });
      batchId = batch.id;

      // Link ALL processed txs to this batch (including skipped ones for traceability)
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data:  { batchId: batch.id, status: 'batched' },
      });

      // Submit to chain
      if (contract && wallet) {
        let receipt;
        try {
          console.log(`📤 submitBatch: txRoot=${txRoot.slice(0, 12)}... stateRoot=${postStateRoot.slice(0, 12)}... txCount=${successCount}`);
          const tx = await contract.submitBatch(txRoot, postStateRoot, successCount);
          receipt  = await tx.wait();
          console.log(`📤 submitBatch tx: ${receipt.transactionHash}`);
        } catch (err) {
          console.error('❌ Chain submission failed:', err.message);
          // Put txs back to pending and delete the failed batch record
          await prisma.pendingTransaction.updateMany({
            where: { id: { in: txIds } },
            data:  { status: 'pending', batchId: null },
          });
          await prisma.batch.update({
            where: { id: batch.id },
            data:  { status: 'failed' },
          });
          return;
        }

        // Parse BatchSubmitted event from receipt
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
          await prisma.batch.update({
            where: { id: batch.id },
            data:  { status: 'failed' },
          });
          return;
        }

        // Guard against duplicates
        const dup = await prisma.batch.findUnique({ where: { onChainId } });
        if (dup && dup.id !== batch.id) {
          console.log(`⚠️  Duplicate onChainId=${onChainId} — skipping DB update`);
          return;
        }

        const challengeSecs  = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300');
        const challengeEndsAt = new Date(Date.now() + challengeSecs * 1000);

        await prisma.batch.update({
          where: { id: batch.id },
          data:  {
            onChainId,
            status:        'challenge_period',
            challengeEndsAt,
            submitter:     wallet.address.toLowerCase(),
            onChainTxHash: receipt.transactionHash,
          }
        });

        console.log(`✅ Batch on-chain: id=${onChainId} stateRoot=${postStateRoot.slice(0, 12)}... challenge ends: ${challengeEndsAt.toISOString()}`);

        broadcast('batch_created', {
          id:          batch.id,
          onChainId,
          txCount:     successCount,
          txRoot,
          stateRoot:   postStateRoot,
          challengeEndsAt: challengeEndsAt.toISOString(),
        });

      } else {
        // DB-only mode: simulate challenge period
        const challengeSecs   = parseInt(process.env.CHALLENGE_PERIOD_SECONDS || '300');
        const challengeEndsAt = new Date(Date.now() + challengeSecs * 1000);

        await prisma.batch.update({
          where: { id: batch.id },
          data:  { status: 'challenge_period', challengeEndsAt }
        });

        console.log(`✅ Batch created (DB-only): ${batch.id.slice(0, 8)} — ${successCount} txs`);

        broadcast('batch_created', {
          id:       batch.id,
          onChainId: null,
          txCount:  successCount,
          txRoot,
          stateRoot: postStateRoot,
        });
      }

    } catch (err) {
      console.error('❌ Sequencer error:', err.message);
      // Roll back any processing txs to pending
      if (txIds.length > 0) {
        await prisma.pendingTransaction.updateMany({
          where: { id: { in: txIds } },
          data:  { status: 'pending', batchId: null },
        }).catch(() => {});
      }
      // If batch was created but errored, mark as failed
      if (batchId) {
        await prisma.batch.update({
          where: { id: batchId },
          data:  { status: 'failed' },
        }).catch(() => {});
      }
    }
  }, INTERVAL_MS);
}