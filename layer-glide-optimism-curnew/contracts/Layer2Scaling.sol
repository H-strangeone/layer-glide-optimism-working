// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Layer2Scaling {

    uint256 public constant MIN_BOND    = 0.1 ether;
    uint256 public constant SLASH_AMOUNT = 0.05 ether;
    uint256 public constant CHALLENGER_REWARD_BPS = 5000;

    struct Batch {
        uint256 batchId;
        bytes32 transactionsRoot;
        uint256 submittedAt;
        address submitter;
        bool    finalized;
        bool    fraudulent;
        uint256 txCount;
    }

    address public admin;
    uint256 public nextBatchId;
    uint256 public challengePeriod;
    uint256 public protocolFeeWei;

    mapping(address => uint256) public balances;
    mapping(address => bool)    public isOperator;
    mapping(address => uint256) public operatorBonds;
    mapping(uint256 => Batch)   public batches;
    mapping(uint256 => bool)    public isBatchFraudulent;

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event OperatorBonded(address indexed operator, uint256 amount);
    event OperatorSlashed(address indexed operator, uint256 amount, address challenger);
    event BatchSubmitted(uint256 indexed batchId, bytes32 transactionsRoot, address submitter, uint256 txCount);
    event BatchFinalized(uint256 indexed batchId);
    event BatchRejected(uint256 indexed batchId, address challenger);
    event FraudReported(uint256 indexed batchId, bytes32 fraudProofHash, address challenger);
    event FundsDeposited(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyOperator() {
        require(isOperator[msg.sender] || msg.sender == admin, "Only operators");
        _;
    }

    modifier batchExists(uint256 _batchId) {
        require(batches[_batchId].submittedAt != 0, "Batch does not exist");
        _;
    }

    constructor(uint256 _challengePeriod) {
        admin = msg.sender;
        nextBatchId = 1;
        challengePeriod = _challengePeriod;
        isOperator[msg.sender] = true;
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        address old = admin;
        admin = newAdmin;
        emit AdminChanged(old, newAdmin);
    }

    function addOperator(address operator) external onlyAdmin {
        require(!isOperator[operator], "Already operator");
        isOperator[operator] = true;
        emit OperatorAdded(operator);
    }

    function removeOperator(address operator) external onlyAdmin {
        require(operator != admin, "Cannot remove admin");
        require(isOperator[operator], "Not operator");
        isOperator[operator] = false;
        emit OperatorRemoved(operator);
    }

    function setChallengePeriod(uint256 _seconds) external onlyAdmin {
        challengePeriod = _seconds;
    }

    function withdrawProtocolFees() external onlyAdmin {
        uint256 amount = protocolFeeWei;
        protocolFeeWei = 0;
        (bool ok,) = payable(admin).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function depositOperatorBond() external payable {
        require(isOperator[msg.sender] || msg.sender == admin, "Not operator");
        operatorBonds[msg.sender] += msg.value;
        emit OperatorBonded(msg.sender, msg.value);
    }

    function withdrawOperatorBond(uint256 amount) external {
        require(operatorBonds[msg.sender] >= amount, "Insufficient bond");
        operatorBonds[msg.sender] -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
    }

    function submitBatch(bytes32 _transactionsRoot, uint256 _txCount) external onlyOperator {
        require(_transactionsRoot != bytes32(0), "Empty root");
        uint256 batchId = nextBatchId++;
        batches[batchId] = Batch({
            batchId:          batchId,
            transactionsRoot: _transactionsRoot,
            submittedAt:      block.timestamp,
            submitter:        msg.sender,
            finalized:        false,
            fraudulent:       false,
            txCount:          _txCount
        });
        emit BatchSubmitted(batchId, _transactionsRoot, msg.sender, _txCount);
    }

    function finalizeBatch(uint256 _batchId) external batchExists(_batchId) {
        Batch storage b = batches[_batchId];
        require(!b.finalized,  "Already finalized");
        require(!b.fraudulent, "Batch fraudulent");
        require(block.timestamp >= b.submittedAt + challengePeriod, "Challenge period not over");
        b.finalized = true;
        emit BatchFinalized(_batchId);
    }

    function reportFraud(
        uint256   batchId,
        bytes32   fraudProofHash,
        bytes32[] calldata merkleProof
    ) external batchExists(batchId) {
        Batch storage b = batches[batchId];
        require(!b.finalized,  "Already finalized");
        require(!b.fraudulent, "Already fraudulent");
        require(block.timestamp < b.submittedAt + challengePeriod, "Challenge period over");
        require(_verifyMerkleProof(fraudProofHash, merkleProof, b.transactionsRoot), "Invalid proof");

        b.fraudulent = true;
        isBatchFraudulent[batchId] = true;

        address submitter = b.submitter;
        uint256 slashable = operatorBonds[submitter] >= SLASH_AMOUNT
            ? SLASH_AMOUNT : operatorBonds[submitter];

        if (slashable > 0) {
            operatorBonds[submitter] -= slashable;
            uint256 reward      = (slashable * CHALLENGER_REWARD_BPS) / 10000;
            uint256 protocolFee = (slashable * 500) / 10000;
            protocolFeeWei += protocolFee;
            (bool ok,) = payable(msg.sender).call{value: reward}("");
            require(ok, "Reward failed");
            emit OperatorSlashed(submitter, slashable, msg.sender);
        }

        emit FraudReported(batchId, fraudProofHash, msg.sender);
        emit BatchRejected(batchId, msg.sender);
    }

    function depositFunds() external payable {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdrawFunds(uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
        (bool ok,) = payable(msg.sender).call{value: _amount}("");
        require(ok, "Transfer failed");
        emit FundsWithdrawn(msg.sender, _amount);
    }

    function _verifyMerkleProof(bytes32 leaf, bytes32[] memory proof, bytes32 root)
        internal pure returns (bool)
    {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            computed = computed <= p
                ? keccak256(abi.encodePacked(computed, p))
                : keccak256(abi.encodePacked(p, computed));
        }
        return computed == root;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
}