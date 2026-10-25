// Sources flattened with hardhat v2.29.1 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File contracts/VerifyBOTRegistry.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VerifyBOTRegistry
 * @dev On-chain registry for BOT Chain smart contract risk analysis requests and reports.
 * 
 * Payment model: Gas only. No separate protocol fee is charged.
 * Important limitation: A report hash proves that the displayed report matches
 * the committed report. It does not prove that the report is accurate, and a clean
 * scan cannot guarantee that a contract is safe.
 */
contract VerifyBOTRegistry is Ownable {

    enum RiskScore {
        UNKNOWN,   // 0
        SAFE,      // 1
        LOW,       // 2
        MEDIUM,    // 3
        HIGH,      // 4
        CRITICAL   // 5
    }

    struct SecurityReport {
        bytes32 reportHash;      // Keccak-256 hash of the off-chain JSON audit report
        RiskScore riskScore;     // Categorical risk rating
        uint256 timestamp;       // Timestamp when the report was committed
        uint256 checkCount;      // Number of on-chain verification checks requested
        address reporter;        // Authorized oracle/analyzer address
        string metadataUri;      // URI or CID pointing to the full audit metadata
        bool exists;             // True if report has been published
    }

    struct ScanRequest {
        uint256 requestId;
        address targetContract;
        address requester;
        uint256 timestamp;
    }

    // Target contract address => SecurityReport
    mapping(address => SecurityReport) private _reports;

    // Authorized analyzer/oracle reporters
    mapping(address => bool) public authorizedReporters;

    // Request Tracking
    uint256 public totalScansCount;
    uint256 public totalReportsCount;
    uint256 public totalChecksCount;

    // Log of recent requests
    mapping(uint256 => ScanRequest) public scanRequests;

    // Contract address => Array of requester addresses
    mapping(address => address[]) private _targetRequesters;

    // ==========================================
    // Events
    // ==========================================

    event ScanRequested(
        uint256 indexed requestId,
        address indexed targetContract,
        address indexed requester,
        uint256 timestamp
    );

    event ReportChecked(
        address indexed targetContract,
        address indexed checker,
        uint256 checkCount,
        uint256 timestamp
    );

    event ReportPublished(
        address indexed targetContract,
        bytes32 indexed reportHash,
        RiskScore riskScore,
        address reporter,
        uint256 timestamp
    );

    event ReporterStatusUpdated(
        address indexed reporter,
        bool authorized
    );

    // ==========================================
    // Modifiers
    // ==========================================

    modifier onlyReporter() {
        require(msg.sender == owner() || authorizedReporters[msg.sender], "VerifyBOT: caller is not authorized reporter");
        _;
    }

    // ==========================================
    // Constructor
    // ==========================================

    constructor() Ownable(msg.sender) {
        authorizedReporters[msg.sender] = true;
        emit ReporterStatusUpdated(msg.sender, true);
    }

    // ==========================================
    // User Actions (Gas Only)
    // ==========================================

    /**
     * @notice Submit a contract address for automated risk investigation.
     * @dev User pays only network gas.
     * @param targetContract Address of the BOT Chain contract to scan.
     * @return requestId Unique ID for this scan request.
     */
    function requestScan(address targetContract) external returns (uint256 requestId) {
        require(targetContract != address(0), "VerifyBOT: invalid target address");

        totalScansCount++;
        requestId = totalScansCount;

        scanRequests[requestId] = ScanRequest({
            requestId: requestId,
            targetContract: targetContract,
            requester: msg.sender,
            timestamp: block.timestamp
        });

        _targetRequesters[targetContract].push(msg.sender);

        emit ScanRequested(requestId, targetContract, msg.sender, block.timestamp);
        return requestId;
    }

    /**
     * @notice Submit an on-chain check transaction before retrieving or refreshing an existing report.
     * @dev User pays only network gas.
     * @param targetContract Target contract address whose report is being inspected.
     */
    function checkReport(address targetContract) external returns (bool) {
        require(targetContract != address(0), "VerifyBOT: invalid target address");
        require(_reports[targetContract].exists, "VerifyBOT: report does not exist yet");

        _reports[targetContract].checkCount++;
        totalChecksCount++;

        emit ReportChecked(
            targetContract,
            msg.sender,
            _reports[targetContract].checkCount,
            block.timestamp
        );

        return true;
    }

    // ==========================================
    // Analyzer / Oracle Actions
    // ==========================================

    /**
     * @notice Commits an audited risk report hash and risk level to the registry.
     * @param targetContract Address of the inspected contract.
     * @param reportHash Cryptographic Keccak-256 hash of the complete audit report.
     * @param riskScore Categorical rating (1=SAFE, 2=LOW, 3=MEDIUM, 4=HIGH, 5=CRITICAL).
     * @param metadataUri URI / CID of full audit metadata.
     */
    function publishReport(
        address targetContract,
        bytes32 reportHash,
        RiskScore riskScore,
        string calldata metadataUri
    ) external onlyReporter {
        require(targetContract != address(0), "VerifyBOT: invalid target contract");
        require(reportHash != bytes32(0), "VerifyBOT: invalid report hash");
        require(uint8(riskScore) <= 5, "VerifyBOT: invalid risk score");

        bool isNew = !_reports[targetContract].exists;
        if (isNew) {
            totalReportsCount++;
        }

        uint256 currentCheckCount = _reports[targetContract].checkCount;

        _reports[targetContract] = SecurityReport({
            reportHash: reportHash,
            riskScore: riskScore,
            timestamp: block.timestamp,
            checkCount: currentCheckCount,
            reporter: msg.sender,
            metadataUri: metadataUri,
            exists: true
        });

        emit ReportPublished(targetContract, reportHash, riskScore, msg.sender, block.timestamp);
    }

    // ==========================================
    // Verification & View Methods
    // ==========================================

    /**
     * @notice Compares an off-chain computed hash against the on-chain committed report hash.
     * @param targetContract Target contract address.
     * @param clientComputedHash Keccak-256 hash calculated by the frontend.
     * @return isValid True if the client hash matches the on-chain registry hash exactly.
     */
    function verifyReportIntegrity(
        address targetContract,
        bytes32 clientComputedHash
    ) external view returns (bool isValid) {
        if (!_reports[targetContract].exists) {
            return false;
        }
        return (_reports[targetContract].reportHash == clientComputedHash);
    }

    /**
     * @notice Fetches the full report details for a target contract.
     */
    function getReport(address targetContract) external view returns (SecurityReport memory) {
        return _reports[targetContract];
    }

    /**
     * @notice Returns whether a report exists for a target contract.
     */
    function hasReport(address targetContract) external view returns (bool) {
        return _reports[targetContract].exists;
    }

    /**
     * @notice Get all requesters who have initiated a scan on a given target contract.
     */
    function getRequesters(address targetContract) external view returns (address[] memory) {
        return _targetRequesters[targetContract];
    }

    // ==========================================
    // Admin Controls
    // ==========================================

    function setReporter(address reporter, bool authorized) external onlyOwner {
        require(reporter != address(0), "VerifyBOT: invalid reporter address");
        authorizedReporters[reporter] = authorized;
        emit ReporterStatusUpdated(reporter, authorized);
    }
}
