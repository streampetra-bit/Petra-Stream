import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const StreamerRegistry = await ethers.getContractFactory("StreamerRegistry");
  const registry = await StreamerRegistry.deploy(deployer.address);
  await registry.deployed();
  console.log("StreamerRegistry deployed to:", registry.address);

  const PaymentVault = await ethers.getContractFactory("PaymentVault");
  const initialFeeBps = 1000; // 10% default, adjust as desired
  const vault = await PaymentVault.deploy(deployer.address, initialFeeBps);
  await vault.deployed();
  console.log("PaymentVault deployed to:", vault.address);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
