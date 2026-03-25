const hre = require("hardhat");

async function main() {
  console.log("=== Deploying LayerGlide Production Rollup ===");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await deployer.getBalance())} ETH`);

  // Challenge period: 5 minutes for demo (300s), 7 days for production (604800s)
  const CHALLENGE_PERIOD = 300; // 5 minutes for demo
  console.log(`Challenge period: ${CHALLENGE_PERIOD}s`);

  const Layer2Rollup = await hre.ethers.getContractFactory("Layer2Rollup");
  const rollup = await Layer2Rollup.deploy(CHALLENGE_PERIOD);
  await rollup.waitForDeployment();

  const addr = await rollup.getAddress();
  console.log(`\n✅ Layer2Rollup deployed to: ${addr}`);

  // Verify state
  const admin = await rollup.admin();
  const stateRoot = await rollup.currentStateRoot();
  const domain = await rollup.DOMAIN_SEPARATOR();
  
  console.log(`   Admin: ${admin}`);
  console.log(`   Genesis state root: ${stateRoot}`);
  console.log(`   EIP-712 domain: ${domain.slice(0, 20)}...`);

  console.log(`
=== UPDATE THESE FILES ===
1. .env:
   CONTRACT_ADDRESS="${addr}"
   VITE_CONTRACT_ADDRESS="${addr}"

2. src/config/contract.ts:
   export const CONTRACT_ADDRESS = '${addr}';

=== QUICK TEST ===
# Deposit 1 ETH as deployer
npx hardhat console --network localhost
> const c = await ethers.getContractAt("Layer2Rollup", "${addr}")
> await c.depositFunds({ value: ethers.parseEther("1.0") })
> await c.l1Balances(deployer.address) // should show 1 ETH in wei
`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
