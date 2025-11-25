// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IStreamerRegistry {
    function isRegistered(address streamer) external view returns (bool);
}

contract PaymentVault is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // token == address(0) => native token (ETH)
    // balances[streamer][token]
    mapping(address => mapping(address => uint256)) private balances;

    // platform fees collected per token
    mapping(address => uint256) private platformFees;

    // registry to validate streamers
    IStreamerRegistry public registry;

    // fee in basis points (10000 = 100%)
    uint256 public platformFeeBps;

    event TipReceived(
        address indexed from,
        address indexed to,
        address token,
        uint256 amount,
        uint256 netAmount,
        bytes32 memo
    );

    event NFTGift(
        address indexed from,
        address indexed to,
        address token,
        uint256 tokenId
    );

    event Withdrawn(address indexed to, address token, uint256 amount);
    event PlatformFeesWithdrawn(address indexed to, address token, uint256 amount);
    event RegistryUpdated(address indexed registry);

    constructor(address registryAddress, uint256 initialFeeBps) {
        require(registryAddress != address(0), "PaymentVault: invalid registry");
        registry = IStreamerRegistry(registryAddress);
        require(initialFeeBps <= 10000, "PaymentVault: bad fee");
        platformFeeBps = initialFeeBps;
        transferOwnership(msg.sender);
    }

    /// @notice Update the streamer registry address
    function setRegistry(address registryAddress) external onlyOwner {
        require(registryAddress != address(0), "PaymentVault: invalid registry");
        registry = IStreamerRegistry(registryAddress);
        emit RegistryUpdated(registryAddress);
    }

    /// @notice Update platform fee (in bps). Owner only.
    function setPlatformFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 10000, "PaymentVault: fee too high");
        platformFeeBps = bps;
    }

    /// @notice Deposit native token (ETH) as tip for a streamer
    function depositTipNative(address streamer, bytes32 memo) external payable nonReentrant {
        require(registry.isRegistered(streamer), "PaymentVault: streamer not registered");
        require(msg.value > 0, "PaymentVault: zero tip");

        uint256 fee = (msg.value * platformFeeBps) / 10000;
        uint256 net = msg.value - fee;

        balances[streamer][address(0)] += net;
        platformFees[address(0)] += fee;

        emit TipReceived(msg.sender, streamer, address(0), msg.value, net, memo);
    }

    /// @notice Deposit ERC20 tip (must approve first)
    function depositTipERC20(address token, address streamer, uint256 amount, bytes32 memo) external nonReentrant {
        require(token != address(0), "PaymentVault: token is zero");
        require(registry.isRegistered(streamer), "PaymentVault: streamer not registered");
        require(amount > 0, "PaymentVault: zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 net = amount - fee;

        balances[streamer][token] += net;
        platformFees[token] += fee;

        emit TipReceived(msg.sender, streamer, token, amount, net, memo);
    }

    /// @notice Gift an ERC721 to a streamer (vault will hold custody)
    function giftNFT(address nftContract, uint256 tokenId, address streamer) external nonReentrant {
        require(nftContract != address(0), "PaymentVault: nft zero");
        require(registry.isRegistered(streamer), "PaymentVault: streamer not registered");

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        emit NFTGift(msg.sender, streamer, nftContract, tokenId);
        // Vault holds the NFT. Off-chain mapping/DB should map custody to streamer.
    }

    /// @notice Streamer withdraws their balance for a specific token (address(0) for native)
    function withdraw(address token) external nonReentrant {
        require(registry.isRegistered(msg.sender), "PaymentVault: not a registered streamer");
        uint256 bal = balances[msg.sender][token];
        require(bal > 0, "PaymentVault: zero balance");
        balances[msg.sender][token] = 0;

        if (token == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: bal}("");
            require(ok, "PaymentVault: native transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, bal);
        }

        emit Withdrawn(msg.sender, token, bal);
    }

    /// @notice Owner withdraws platform fees for a token to an address
    function withdrawPlatformFees(address token, address to) external onlyOwner nonReentrant {
        require(to != address(0), "PaymentVault: zero recipient");
        uint256 amt = platformFees[token];
        require(amt > 0, "PaymentVault: zero fees");
        platformFees[token] = 0;

        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amt}("");
            require(ok, "PaymentVault: native transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amt);
        }

        emit PlatformFeesWithdrawn(to, token, amt);
    }

    /// @notice View balance of a streamer for a token
    function balanceOf(address streamer, address token) external view returns (uint256) {
        return balances[streamer][token];
    }

    /// @notice View platform-collected fees for token
    function platformCollected(address token) external view returns (uint256) {
        return platformFees[token];
    }

    // Allow receiving ETH (e.g. accidental) — store into owner's platform fee bucket
    receive() external payable {
        platformFees[address(0)] += msg.value;
    }

    // Implement ERC721 receiver so safeTransferFrom works
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
