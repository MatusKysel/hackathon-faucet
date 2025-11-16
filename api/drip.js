import { ethers } from "ethers";

const RPC_URL = process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet.bnbchain.org";
const PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY;
const FAUCET_CONTRACT = process.env.FAUCET_CONTRACT_ADDRESS;

// ABI: only need drip(address)
const FAUCET_ABI = [
  "function drip(address to) external"
];

export default async function handler(req, res) {
  // Allow GET or POST, but we will use POST from frontend
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Simple anti-abuse: IP in header (not strong, but better than nothing)
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

    const to = (req.query.to || req.body?.to || "").trim();
    if (!to || !ethers.isAddress(to)) {
      res.status(400).json({ error: "Invalid recipient address" });
      return;
    }

    if (!PRIVATE_KEY || !FAUCET_CONTRACT) {
      res.status(500).json({ error: "Faucet not configured" });
      return;
    }

    // You can plug a better rate-limit here (KV, Upstash, etc.)
    console.log(`Faucet request from IP ${ip} to ${to}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL, 97);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const faucet = new ethers.Contract(FAUCET_CONTRACT, FAUCET_ABI, wallet);

    console.log("Calling drip(", to, ")...");
    const tx = await faucet.drip(to);
    console.log("Tx hash:", tx.hash);

    const receipt = await tx.wait();

    res.status(200).json({
      ok: true,
      hash: tx.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
}
