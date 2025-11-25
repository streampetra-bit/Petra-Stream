import { expect } from "chai";
import { ethers } from "hardhat";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("PaymentVault (TS integration)", function () {
  let deployer: any, streamer: any, tipper: any;
  let registry: any, vault: any, erc20: any, erc721: any;

  beforeEach(async function () {
    [deployer, streamer, tipper] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("StreamerRegistry");
    registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();

    const Vault = await ethers.getContractFactory("PaymentVault");
    vault = await Vault.deploy(await registry.getAddress(), 1000);
    await vault.waitForDeployment();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    erc20 = await ERC20Mock.deploy("MockToken", "MTK", deployer.address, ethers.parseEther("1000000"));
    await erc20.waitForDeployment();

    const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
    erc721 = await ERC721Mock.deploy("MockNFT", "MNFT");
    await erc721.waitForDeployment();

    await registry.connect(streamer).registerStreamer("ipfs://streamer-meta");
  });

  it("should allow tipping and withdrawal (native)", async function () {
    const tip = ethers.parseEther("1.0");
    const memo = ethers.encodeBytes32String("t");

    await vault.connect(tipper).depositTipNative(streamer.address, memo, { value: tip });

    const bal = await vault.balanceOf(streamer.address, ZERO_ADDRESS);
    const expected = tip - (tip * 1000n) / 10000n;
    expect(bal).to.equal(expected);

    const before = await ethers.provider.getBalance(streamer.address);
    const tx = await vault.connect(streamer).withdraw(ZERO_ADDRESS);
    const receipt = await tx.wait();

    const gasUsed = BigInt(receipt.gasUsed.toString());

    let effectiveGasPrice = 0n;
    if (receipt.effectiveGasPrice) {
      try {
        const egp = BigInt((receipt.effectiveGasPrice as any).toString());
        if (egp > 0n) effectiveGasPrice = egp;
      } catch {}
    }

    let txRaw: any = null;
    if (effectiveGasPrice === 0n) {
      txRaw = await ethers.provider.getTransaction(receipt.transactionHash || tx.hash);
      if (txRaw) {
        if (txRaw.gasPrice) effectiveGasPrice = BigInt(txRaw.gasPrice.toString());
        else if (txRaw.maxFeePerGas) effectiveGasPrice = BigInt(txRaw.maxFeePerGas.toString());
      }
    }

    const gasCost = gasUsed * effectiveGasPrice;
    const after = await ethers.provider.getBalance(streamer.address);
    const expectedAfter = before + BigInt(bal.toString()) - gasCost;
    const diff = after > expectedAfter ? after - expectedAfter : expectedAfter - after;
    const TOLERANCE = 100000n;

    if (diff > TOLERANCE) {
      console.warn("TS withdraw debug:", {
        before: before.toString(),
        bal: bal.toString(),
        gasUsed: gasUsed.toString(),
        receiptEffectiveGasPrice: receipt.effectiveGasPrice ? (receipt.effectiveGasPrice as any).toString() : null,
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
});
