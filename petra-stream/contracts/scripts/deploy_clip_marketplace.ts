import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const clipAddress =
    process.env.CLIP_NFT_ADDRESS ||
    process.env.VITE_CLIP_NFT_ADDRESS ||
    "";

  if (!clipAddress || !ethers.isAddress(clipAddress)) {
    throw new Error("Missing CLIP_NFT_ADDRESS (set in contracts/.env)");
  }

  const Marketplace = await ethers.getContractFactory("ClipMarketplace");
  const market = await Marketplace.deploy(clipAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();

  console.log("ClipMarketplace deployed to:", marketAddress);
  console.log("ClipNFT linked:", clipAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
