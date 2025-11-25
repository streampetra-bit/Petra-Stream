const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const StreamerRegistry = await hre.ethers.getContractFactory("StreamerRegistry");
  const registry = await StreamerRegistry.deploy(deployer.address); // pass admin
  await registry.waitForDeployment();

  console.log("StreamerRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
