// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title StreamerRegistry
/// @notice Manages streamer registration and their metadata URI
contract StreamerRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // streamer => metadataURI
    mapping(address => string) private _metadata;
    mapping(address => bool) private _registered;

    event StreamerRegistered(address indexed streamer, string metadataURI);
    event StreamerUpdated(address indexed streamer, string metadataURI);
    event StreamerUnregistered(address indexed streamer);

    constructor(address admin) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
    }

    /// @notice Register the calling address as a streamer with metadata URI
    function registerStreamer(string calldata metadataURI) external {
        require(!_registered[msg.sender], "StreamerRegistry: already registered");
        _registered[msg.sender] = true;
        _metadata[msg.sender] = metadataURI;
        emit StreamerRegistered(msg.sender, metadataURI);
    }

    /// @notice Update metadata for the calling streamer
    function updateMetadata(string calldata metadataURI) external {
        require(_registered[msg.sender], "StreamerRegistry: not registered");
        _metadata[msg.sender] = metadataURI;
        emit StreamerUpdated(msg.sender, metadataURI);
    }

    /// @notice Unregister yourself (optional)
    function unregister() external {
        require(_registered[msg.sender], "StreamerRegistry: not registered");
        _registered[msg.sender] = false;
        delete _metadata[msg.sender];
        emit StreamerUnregistered(msg.sender);
    }

    /// @notice Admin can forcibly register an address (for verified streamers)
    function adminRegister(address streamer, string calldata metadataURI) external onlyRole(ADMIN_ROLE) {
        _registered[streamer] = true;
        _metadata[streamer] = metadataURI;
        emit StreamerRegistered(streamer, metadataURI);
    }

    function isRegistered(address streamer) external view returns (bool) {
        return _registered[streamer];
    }

    function metadataURI(address streamer) external view returns (string memory) {
        require(_registered[streamer], "StreamerRegistry: not registered");
        return _metadata[streamer];
    }
}
