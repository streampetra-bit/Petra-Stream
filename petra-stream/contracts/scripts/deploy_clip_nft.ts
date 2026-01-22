import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const registryAddress = process.env.REGISTRY_ADDRESS || ethers.ZeroAddress;

  const ClipNFT = await ethers.getContractFactory("ClipNFT");
  const clip = await ClipNFT.deploy(deployer.address, registryAddress);
  await clip.waitForDeployment();
  const clipAddress = await clip.getAddress();
  console.log("ClipNFT deployed to:", clipAddress);
  console.log("Registry set to:", registryAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
