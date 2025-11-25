const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying PaymentVault with account:", deployer.address);

  const PaymentVault = await hre.ethers.getContractFactory("PaymentVault");
  // constructor: (admin, initialFeeBps)
  const initialFeeBps = 1000; // 10%
  const vault = await PaymentVault.deploy(deployer.address, initialFeeBps);
  await vault.waitForDeployment();

  console.log("PaymentVault deployed to:", await vault.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
