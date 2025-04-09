// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Rollup {
    mapping(uint256 => bytes32) public batchMerkleRoots;
    mapping(uint256 => bool) public isBatchFraudulent;

    function reportFraud(uint256 batchId, bytes32 fraudProofHash, bytes32[] calldata merkleProof) external {
        require(!isBatchFraudulent[batchId], "Batch already marked as fraudulent");

        // Verify the fraud proof using the Merkle proof
        bytes32 root = batchMerkleRoots[batchId];
        require(verifyMerkleProof(fraudProofHash, merkleProof, root), "Invalid fraud proof");

        // Mark the batch as fraudulent
        isBatchFraudulent[batchId] = true;
    }

    function verifyMerkleProof(bytes32 leaf, bytes32[] memory proof, bytes32 root) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }
}
