// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title ClipMarketplace
/// @notice Simple fixed-price marketplace for Petra Stream Clip NFTs.
contract ClipMarketplace is ReentrancyGuard {
    IERC721 public immutable nft;

    struct Listing {
        address seller;
        uint256 price;
    }

    mapping(uint256 => Listing) public listings;

    event ListingCreated(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event ListingPurchased(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address nftAddress) {
        require(nftAddress != address(0), "Marketplace: zero nft");
        nft = IERC721(nftAddress);
    }

    function list(uint256 tokenId, uint256 price) external {
        require(price > 0, "Marketplace: price=0");
        require(nft.ownerOf(tokenId) == msg.sender, "Marketplace: not owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace: not approved"
        );

        listings[tokenId] = Listing({ seller: msg.sender, price: price });
        emit ListingCreated(tokenId, msg.sender, price);
    }

    function cancel(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];
        require(listing.seller != address(0), "Marketplace: not listed");
        require(listing.seller == msg.sender, "Marketplace: not seller");

        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.seller != address(0), "Marketplace: not listed");
        require(msg.value == listing.price, "Marketplace: bad price");

        delete listings[tokenId];
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);

        (bool ok, ) = listing.seller.call{ value: msg.value }("");
        require(ok, "Marketplace: payout failed");
        emit ListingPurchased(tokenId, listing.seller, msg.sender, listing.price);
    }
}
