const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("PaymentVault (integration)", function () {
  let deployer, streamer, tipper;
  let registry, vault, erc20, erc721;

  beforeEach(async function () {
    [deployer, streamer, tipper] = await ethers.getSigners();

    // Deploy StreamerRegistry
    const Registry = await ethers.getContractFactory("StreamerRegistry");
    registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();

    // Deploy PaymentVault with registry address and 1000 bps (10%)
    const PaymentVault = await ethers.getContractFactory("PaymentVault");
    vault = await PaymentVault.deploy(await registry.getAddress(), 1000);
    await vault.waitForDeployment();

    // Deploy mocks (adjust constructors if your mocks differ)
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    erc20 = await ERC20Mock.deploy("MockToken", "MTK", deployer.address, ethers.parseEther("1000000"));
    await erc20.waitForDeployment();

    const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
    erc721 = await ERC721Mock.deploy("MockNFT", "MNFT");
    await erc721.waitForDeployment();

    // Register streamer (address)
    await registry.connect(streamer).registerStreamer("ipfs://streamer-meta");
  });

  it("accepts native tip and credits streamer with net amount", async function () {
    const tip = ethers.parseEther("1.0");
    const memo = ethers.encodeBytes32String("t1");

    await vault.connect(tipper).depositTipNative(streamer.address, memo, { value: tip });

    const bal = await vault.balanceOf(streamer.address, ZERO_ADDRESS);
    const expected = tip - (tip * 1000n) / 10000n; // 10% fee
    expect(bal).to.equal(expected);

    const platform = await vault.platformCollected(ZERO_ADDRESS);
    expect(platform).to.equal((tip * 1000n) / 10000n);
  });

  it("allows streamer to withdraw native balance", async function () {
    const tip = ethers.parseEther("1.0");
    const memo = ethers.encodeBytes32String("t2");

    await vault.connect(tipper).depositTipNative(streamer.address, memo, { value: tip });

    const bal = await vault.balanceOf(streamer.address, ZERO_ADDRESS);
    const before = await ethers.provider.getBalance(streamer.address);

    // Withdraw tx
    const tx = await vault.connect(streamer).withdraw(ZERO_ADDRESS);
    const receipt = await tx.wait();

    // gasUsed (BigInt)
    const gasUsed = BigInt(receipt.gasUsed.toString());

    // Try receipt.effectiveGasPrice first; if missing/zero, fallback to provider.getTransaction
    let effectiveGasPrice = 0n;
    try {
      if (receipt.effectiveGasPrice) {
        const egp = BigInt(receipt.effectiveGasPrice.toString());
        if (egp > 0n) effectiveGasPrice = egp;
      }
    } catch (e) {
      effectiveGasPrice = 0n;
    }

    let txRaw = null;
    if (effectiveGasPrice === 0n) {
      // Fallback: fetch the transaction to read gas price fields
      txRaw = await ethers.provider.getTransaction(receipt.transactionHash || tx.hash);
      if (txRaw) {
        if (txRaw.gasPrice) {
          effectiveGasPrice = BigInt(txRaw.gasPrice.toString());
        } else if (txRaw.maxFeePerGas) {
          effectiveGasPrice = BigInt(txRaw.maxFeePerGas.toString());
        }
      }
    }

    const gasCost = gasUsed * effectiveGasPrice;
    const after = await ethers.provider.getBalance(streamer.address);
    const expectedAfter = before + BigInt(bal.toString()) - gasCost;

    const diff = after > expectedAfter ? after - expectedAfter : expectedAfter - after;
    const TOLERANCE = 100000n;

    if (diff > TOLERANCE) {
      console.warn("withdraw debug:", {
        before: before.toString(),
        bal: bal.toString(),
        gasUsed: gasUsed.toString(),
        receiptEffectiveGasPrice: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : null,
        txGasPrice: txRaw ? (txRaw.gasPrice ? txRaw.gasPrice.toString() : null) : null,
        txMaxFeePerGas: txRaw ? (txRaw.maxFeePerGas ? txRaw.maxFeePerGas.toString() : null) : null,
        effectiveGasPrice: effectiveGasPrice.toString(),
        gasCost: gasCost.toString(),
        expectedAfter: expectedAfter.toString(),
        after: after.toString(),
        diff: diff.toString()
      });
    }

    expect(diff).to.be.lte(TOLERANCE);
  });

  it("accepts ERC20 tip and owner can sweep platform fees", async function () {
    const amount = ethers.parseUnits("100", 18);

    // send tokens to tipper and approve vault
    await erc20.transfer(tipper.address, ethers.parseUnits("1000", 18));
    await erc20.connect(tipper).approve(await vault.getAddress(), amount);

    const memo = ethers.encodeBytes32String("t3");
    await vault.connect(tipper).depositTipERC20(await erc20.getAddress(), streamer.address, amount, memo);

    const streamerBal = await vault.balanceOf(streamer.address, await erc20.getAddress());
    expect(streamerBal).to.equal(ethers.parseUnits("90", 18)); // 90 after 10% fee

    const pf = await vault.platformCollected(await erc20.getAddress());
    expect(pf).to.equal(ethers.parseUnits("10", 18));

    const beforeOwner = await erc20.balanceOf(deployer.address);
    await vault.connect(deployer).withdrawPlatformFees(await erc20.getAddress(), deployer.address);
    const afterOwner = await erc20.balanceOf(deployer.address);
    expect(afterOwner).to.equal(beforeOwner + ethers.parseUnits("10", 18));
  });

  it("accepts NFT gift (vault custody)", async function () {
    await erc721.mint(tipper.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(tipper.address);

    await erc721.connect(tipper).setApprovalForAll(await vault.getAddress(), true);
    await vault.connect(tipper).giftNFT(await erc721.getAddress(), 1, streamer.address);

    expect(await erc721.ownerOf(1)).to.equal(await vault.getAddress());
  });
});
