import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 20;
const INTERVAL_MS = 5000;
const MIN_BATCH_SIZE = 3;
export function startSequencer({ contract, wallet, broadcast }) {
  if (!contract || !wallet) {
    console.log("⚠️ Sequencer not started (no contract)");
    return;
  }

  console.log("🚀 Sequencer started...");

  setInterval(async () => {
    try {
      // 🔒 1. Fetch pending txs (FIFO)
      const pendingTxs = await prisma.pendingTransaction.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      if (pendingTxs.length < MIN_BATCH_SIZE) {
  console.log("⏳ Waiting for more txs...");
  return;
}

      console.log(`📦 Building batch (${pendingTxs.length} txs)`);

      // 🔐 2. Mark them as "processing" (avoid double batching)
      const txIds = pendingTxs.map(tx => tx.id);

      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data: { status: "processing" }
      });

      // 🧮 3. Build Merkle root
      const leaves = pendingTxs.map(tx =>
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256"],
            [
              tx.fromAddress,
              tx.toAddress,
              ethers.BigNumber.from(tx.valueWei)
            ]
          )
        )
      );

      let root = ethers.constants.HashZero;

      if (leaves.length > 0) {
        let layer = [...leaves];

        while (layer.length > 1) {
          const next = [];

          for (let i = 0; i < layer.length; i += 2) {
            const left = layer[i];
            const right = i + 1 < layer.length ? layer[i + 1] : layer[i];

            next.push(
              left <= right
                ? ethers.utils.keccak256(ethers.utils.concat([left, right]))
                : ethers.utils.keccak256(ethers.utils.concat([right, left]))
            );
          }

          layer = next;
        }

        root = layer[0];
      }

      // 🧾 4. Create batch in DB
      const batch = await prisma.batch.create({
        data: {
          transactionsRoot: root,
          status: "pending_submission",
          txCount: pendingTxs.length
        }
      });

      // 🔗 5. Link txs to batch
      await prisma.pendingTransaction.updateMany({
        where: { id: { in: txIds } },
        data: {
          batchId: batch.id,
          status: "batched"
        }
      });

      console.log(`🧱 Batch created: ${batch.id}`);

      // ⛓️ 6. Submit to blockchain
      const tx = await contract.submitBatch(root, pendingTxs.length);
      const receipt = await tx.wait();

      // 🧠 7. Parse event (robust way)
      let onChainId = null;
      const iface = contract.interface;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === "BatchSubmitted") {
            onChainId = parsed.args.batchId.toString();
            break;
          }
        } catch {}
      }

      if (!onChainId) {
        throw new Error("BatchSubmitted event not found");
      }

      // ⏱️ 8. Challenge period
      const challengeEndsAt = new Date(
        Date.now() + (parseInt(process.env.CHALLENGE_PERIOD_SECONDS || "300") * 1000)
      );

      // 🧩 9. Update batch
      // 🔒 Prevent duplicate onChainId crash
const existing = await prisma.batch.findUnique({
  where: { onChainId }
});

if (existing) {
  console.log("⚠️ Duplicate onChainId, skipping:", onChainId);

  // ❌ do NOT revert to pending → causes infinite loop

  await prisma.pendingTransaction.updateMany({
    where: { batchId: batch.id },
    data: {
      status: "failed"
    }
  });

  await prisma.batch.update({
    where: { id: batch.id },
    data: { status: "failed" }
  });

  return;
}

// ✅ Safe update
await prisma.batch.update({
  where: { id: batch.id },
  data: {
    onChainId,
    status: "challenge_period",
    challengeEndsAt,
    submitter: wallet.address,
    onChainTxHash: receipt.transactionHash,
  }
});

      console.log(`✅ Batch submitted on-chain: ${onChainId}`);

      // 📡 10. Broadcast
      broadcast("batch_created", {
        id: batch.id,
        onChainId,
        txCount: pendingTxs.length
      });

    } catch (err) {
      console.error("❌ Sequencer error:", err.message);

      // 🔄 Rollback stuck txs
      await prisma.pendingTransaction.updateMany({
  where: { id: { in: txIds } },
  data: { status: "pending" }
});
    }
  }, INTERVAL_MS);
}