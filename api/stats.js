import { ethers } from "ethers";

const RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet.bnbchain.org";
const FAUCET_CONTRACT = process.env.FAUCET_CONTRACT_ADDRESS;
const DEPLOY_BLOCK = parseInt(process.env.FAUCET_DEPLOY_BLOCK || "0", 10);

export default async function handler(req, res) {
  try {
    if (!FAUCET_CONTRACT) {
      res.status(500).json({ error: "FAUCET_CONTRACT_ADDRESS not set" });
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL, 97);

    const nowBlock = await provider.getBlockNumber();
    const qp = req.query || {};

    let fromBlock = Number.isFinite(DEPLOY_BLOCK) ? DEPLOY_BLOCK : 0;
    if (qp.fromBlock) {
      const fb = parseInt(qp.fromBlock, 10);
      if (!Number.isNaN(fb)) fromBlock = Math.max(fb, fromBlock);
    }

    const hours = qp.hours ? parseInt(qp.hours, 10) : null;
    if (hours && hours > 0) {
      // Approximate BSC block time ~3s
      const approxBlocks = Math.floor((hours * 3600) / 3);
      fromBlock = Math.max(nowBlock - approxBlocks, fromBlock);
    }

    let toBlock = nowBlock;
    if (qp.toBlock) {
      const tb = parseInt(qp.toBlock, 10);
      if (!Number.isNaN(tb)) toBlock = tb;
    }

    const topic0 = ethers.id("Dripped(address,uint256)");
    const logs = await provider.getLogs({
      address: FAUCET_CONTRACT,
      fromBlock,
      toBlock,
      topics: [topic0],
    });

    const iface = new ethers.Interface([
      "event Dripped(address indexed to, uint256 amount)",
    ]);

    let totalWei = 0n;
    const recipients = new Map();
    const events = [];

    for (const log of logs) {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      const to = parsed.args.to;
      const amountWei = BigInt(parsed.args.amount.toString());

      totalWei += amountWei;
      recipients.set(to, (recipients.get(to) || 0) + 1);
      events.push({
        to,
        amountWei: amountWei.toString(),
        amount: ethers.formatEther(amountWei),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      });
    }

    let latestBlock = null;
    let latestTimestamp = null;
    if (logs.length) {
      latestBlock = logs[logs.length - 1].blockNumber;
      const block = await provider.getBlock(latestBlock);
      latestTimestamp = block?.timestamp ?? null;
    }

    res.status(200).json({
      ok: true,
      contract: FAUCET_CONTRACT,
      fromBlock,
      toBlock,
      totalDrips: logs.length,
      uniqueRecipients: recipients.size,
      totalAmountWei: totalWei.toString(),
      totalAmount: ethers.formatEther(totalWei),
      latestBlock,
      latestTimestamp,
      sample: events.slice(-10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
}

