import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";


describe("StreamerRegistry", function () {
  it("should register a new streamer", async function () {
    const [deployer, streamer] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("StreamerRegistry");
    const registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();

    await registry.connect(streamer).registerStreamer("ipfs://meta");
    expect(await registry.isRegistered(streamer.address)).to.equal(true);
    expect(await registry.metadataURI(streamer.address)).to.equal("ipfs://meta");
  });

  it("should not allow duplicate registration", async function () {
    const [deployer, streamer] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("StreamerRegistry");
    const registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();

    await registry.connect(streamer).registerStreamer("ipfs://meta");
    await expect(registry.connect(streamer).registerStreamer("ipfs://meta2"))
      .to.be.revertedWith("StreamerRegistry: already registered");
  });
});
