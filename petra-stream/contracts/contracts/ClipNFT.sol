// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

interface IStreamerRegistry {
    function isRegistered(address streamer) external view returns (bool);
}

/// @title ClipNFT
/// @notice Simple NFT contract for minting Petra Stream highlights.
contract ClipNFT is ERC721URIStorage, Ownable {
    uint256 private _nextId;
    address public registry;

    event RegistryUpdated(address indexed registry);

    constructor(address owner_, address registry_) ERC721("Petra Stream Clip", "PCLIP") {
        registry = registry_;
        _transferOwnership(owner_);
    }

    function setRegistry(address registry_) external onlyOwner {
        registry = registry_;
        emit RegistryUpdated(registry_);
    }

    function mint(address to, string memory tokenURI) external returns (uint256) {
        if (registry != address(0)) {
            require(IStreamerRegistry(registry).isRegistered(msg.sender), "ClipNFT: not registered");
        }
        require(bytes(tokenURI).length > 0, "ClipNFT: empty tokenURI");
        uint256 tokenId = ++_nextId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }
}
