import { formatEther } from 'ethers';

export function displayEth(weiStr: string | undefined | null): string {
  if (!weiStr || weiStr === '0') return '0 ETH';
  try {
    const n = BigInt(weiStr);
    if (n < 1_000_000_000n) return `${weiStr} ETH`;
    return `${formatEther(n)} ETH`;
  } catch {
    return `${weiStr} ETH`;
  }
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function toUnixSeconds(ts: string | number | Date | undefined | null): number {
  if (!ts) return Math.floor(Date.now() / 1000);
  if (ts instanceof Date) return Math.floor(ts.getTime() / 1000);
  if (typeof ts === 'number') return ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return Math.floor(new Date(ts).getTime() / 1000);
}