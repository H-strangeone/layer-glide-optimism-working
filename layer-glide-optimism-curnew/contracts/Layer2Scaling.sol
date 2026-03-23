// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Layer2Scaling {
<<<<<<< HEAD

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
=======
    struct Batch {
        uint256 batchId;
        bytes32 transactionsRoot;
        uint256 timestamp;
        bool verified;
        bool finalized;
    }

    struct Transaction {
        address sender;
        address recipient;
        uint256 amount;
    }

    mapping(uint256 => Batch) public batches;
    uint256 public nextBatchId;
    mapping(address => uint256) public balances;
    uint256 public slashingPenalty = 0.05 ether;

    // Add admin role
    address public admin;
    mapping(address => bool) public isOperator;

    // Additions from Rollup.sol
    mapping(uint256 => bytes32) public batchMerkleRoots;
    mapping(uint256 => bool) public isBatchFraudulent;
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d

    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
<<<<<<< HEAD
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
=======
    event BatchSubmitted(uint256 indexed batchId, bytes32 transactionsRoot);
    event BatchVerified(uint256 indexed batchId);
    event FraudReported(uint256 indexed batchId, bytes32 fraudProof);
    event FundsDeposited(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);
    event FraudPenaltyApplied(address indexed user, uint256 penalty);
    event BatchFinalized(uint256 indexed batchId);
    event TransactionExecuted(address indexed sender, address indexed recipient, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        _;
    }

    modifier onlyOperator() {
<<<<<<< HEAD
        require(isOperator[msg.sender] || msg.sender == admin, "Only operators");
=======
        require(isOperator[msg.sender] || msg.sender == admin, "Only operators can call this function");
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        _;
    }

    modifier batchExists(uint256 _batchId) {
<<<<<<< HEAD
        require(batches[_batchId].submittedAt != 0, "Batch does not exist");
        _;
    }

    constructor(uint256 _challengePeriod) {
        admin = msg.sender;
        nextBatchId = 1;
        challengePeriod = _challengePeriod;
=======
        require(batches[_batchId].batchId != 0, "Batch does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
        nextBatchId = 1;
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        isOperator[msg.sender] = true;
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
<<<<<<< HEAD
        require(newAdmin != address(0), "Zero address");
        address old = admin;
        admin = newAdmin;
        emit AdminChanged(old, newAdmin);
    }

    function addOperator(address operator) external onlyAdmin {
        require(!isOperator[operator], "Already operator");
=======
        require(newAdmin != address(0), "New admin cannot be zero address");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminChanged(oldAdmin, newAdmin);
    }

    function addOperator(address operator) external onlyAdmin {
        require(!isOperator[operator], "Already an operator");
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        isOperator[operator] = true;
        emit OperatorAdded(operator);
    }

    function removeOperator(address operator) external onlyAdmin {
<<<<<<< HEAD
        require(operator != admin, "Cannot remove admin");
        require(isOperator[operator], "Not operator");
=======
        require(operator != admin, "Cannot remove admin as operator");
        require(isOperator[operator], "Not an operator");
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        isOperator[operator] = false;
        emit OperatorRemoved(operator);
    }

<<<<<<< HEAD
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
=======
    function submitBatch(bytes32[] memory _transactionsRoots) external onlyOperator {
        require(_transactionsRoots.length > 0, "Batch must contain transactions");
        for (uint256 i = 0; i < _transactionsRoots.length; i++) {
            batches[nextBatchId] = Batch(nextBatchId, _transactionsRoots[i], block.timestamp, false, false);
            batchMerkleRoots[nextBatchId] = _transactionsRoots[i];
            emit BatchSubmitted(nextBatchId, _transactionsRoots[i]);
            nextBatchId++;
        }
    }

    function verifyBatch(uint256 _batchId) external batchExists(_batchId) {
        require(!batches[_batchId].finalized, "Batch is finalized");
        require(!batches[_batchId].verified, "Batch already verified");
        batches[_batchId].verified = true;
        emit BatchVerified(_batchId);
    }

    function reportFraud(uint256 batchId, bytes32 fraudProofHash, bytes32[] calldata merkleProof) external {
        require(!isBatchFraudulent[batchId], "Batch already marked as fraudulent");

        // Verify the fraud proof using the Merkle proof
        bytes32 root = batchMerkleRoots[batchId];
        require(verifyMerkleProof(fraudProofHash, merkleProof, root), "Invalid fraud proof");

        // Mark the batch as fraudulent
        isBatchFraudulent[batchId] = true;
        emit FraudReported(batchId, fraudProofHash);
    }

    function detectFraud(uint256 _batchId, bytes32 _fraudProof, Transaction memory _tx, bytes32[] memory _merkleProof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_tx.sender, _tx.recipient, _tx.amount));
        bytes32 root = batches[_batchId].transactionsRoot;
        return verifyMerkleProof(leaf, _merkleProof, root) && _fraudProof != leaf; // Fraud if proof doesn't match expected tx
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

    function finalizeBatch(uint256 _batchId) external batchExists(_batchId) {
        require(!batches[_batchId].finalized, "Batch already finalized");
        require(block.timestamp > batches[_batchId].timestamp + 1 weeks, "Challenge period not over");
        batches[_batchId].finalized = true;
        emit BatchFinalized(_batchId);
    }

    function depositFunds() external payable {
        require(msg.value > 0, "Deposit must be greater than zero");
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
        balances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdrawFunds(uint256 _amount) external {
<<<<<<< HEAD
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
=======
        uint256 userBalance = balances[msg.sender];
        require(userBalance >= _amount, "Insufficient balance");
        balances[msg.sender] = userBalance - _amount;
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(msg.sender, _amount);
    }

    // New function to execute a Layer 2 transaction
    function executeL2Transaction(address _recipient, uint256 _amount) external {
        require(balances[msg.sender] >= _amount, "Insufficient Layer 2 balance");
        balances[msg.sender] -= _amount;
        balances[_recipient] += _amount;
        emit TransactionExecuted(msg.sender, _recipient, _amount);
    }

    // New function to execute multiple Layer 2 transactions in a batch
    function executeL2BatchTransaction(address[] memory _recipients, uint256[] memory _amounts) external {
        require(_recipients.length == _amounts.length, "Mismatched arrays");
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        require(balances[msg.sender] >= totalAmount, "Insufficient Layer 2 balance");

        balances[msg.sender] -= totalAmount;
        for (uint256 i = 0; i < _recipients.length; i++) {
            balances[_recipients[i]] += _amounts[i];
            emit TransactionExecuted(msg.sender, _recipients[i], _amounts[i]);
        }
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }
}
>>>>>>> 5727fd269cc713f4edd3f15e203d610b874b468d
