// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CharityPlatform
 * @notice 公益捐赠溯源平台核心合约：项目登记 + 捐款记账 + 通用证据存证
 *
 * 设计思路（论文 §5.1 / §6.2.1）：
 * - 链上仅承载项目元数据、捐款流水以及业务对象哈希摘要；
 * - 业务详细数据保存在链下数据库，通过 (biz_type, biz_id) 与链上证据关联；
 * - 一旦数据库内容被篡改，链下重算哈希将无法与链上 dataHash 对齐，可被任何人检测。
 */
contract CharityPlatform {
    struct Project {
        address org;
        uint256 targetAmount;
        uint256 total;
        bool active;
        bytes32 infoHash;
        uint256 createdAt;
    }

    struct Evidence {
        bytes32 dataHash;
        address submitter;
        uint256 committedAt;
    }

    uint256 public projectCount;
    uint256 public donationCount;

    mapping(uint256 => Project) public projects;
    mapping(bytes32 => Evidence) public evidences;

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed org,
        uint256 targetAmount,
        bytes32 infoHash,
        uint256 timestamp
    );

    event DonationMade(
        uint256 indexed donationId,
        uint256 indexed projectId,
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );

    event EvidenceCommitted(
        bytes32 indexed key,
        bytes32 dataHash,
        address indexed submitter,
        uint256 timestamp
    );

    event ProjectActiveChanged(uint256 indexed projectId, bool active);

    /// @notice 创建一个公益项目
    /// @param targetAmount 目标募款金额（wei）
    /// @param infoHash 项目元数据哈希（链下 SHA-256 / keccak256）
    function createProject(uint256 targetAmount, bytes32 infoHash) external returns (uint256 projectId) {
        require(targetAmount > 0, "target=0");
        require(infoHash != bytes32(0), "infoHash=0");
        projectId = ++projectCount;
        projects[projectId] = Project({
            org: msg.sender,
            targetAmount: targetAmount,
            total: 0,
            active: true,
            infoHash: infoHash,
            createdAt: block.timestamp
        });
        emit ProjectCreated(projectId, msg.sender, targetAmount, infoHash, block.timestamp);
    }

    /// @notice 捐款（链上） — 论文 §6.2.1 核心函数
    function donate(uint256 projectId) external payable returns (uint256 donationId) {
        Project storage p = projects[projectId];
        require(p.org != address(0), "not found");
        require(p.active, "inactive");
        require(msg.value > 0, "amount=0");
        donationId = ++donationCount;
        p.total += msg.value;
        emit DonationMade(donationId, projectId, msg.sender, msg.value, block.timestamp);
    }

    /// @notice 切换项目激活状态（仅项目创建者）
    function setProjectActive(uint256 projectId, bool active) external {
        Project storage p = projects[projectId];
        require(p.org != address(0), "not found");
        require(msg.sender == p.org, "not org");
        p.active = active;
        emit ProjectActiveChanged(projectId, active);
    }

    /// @notice 通用业务证据存证 — 论文 §5.1 / §2.3.2 “biz_type + biz_id”
    /// @param key 证据键（推荐：keccak256(abi.encodePacked(biz_type, biz_id))）
    /// @param dataHash 业务对象关键字段 JSON 的 SHA-256/keccak256 摘要
    function commitEvidence(bytes32 key, bytes32 dataHash) external {
        require(key != bytes32(0), "key=0");
        require(dataHash != bytes32(0), "dataHash=0");
        evidences[key] = Evidence({
            dataHash: dataHash,
            submitter: msg.sender,
            committedAt: block.timestamp
        });
        emit EvidenceCommitted(key, dataHash, msg.sender, block.timestamp);
    }

    function getProject(uint256 projectId)
        external
        view
        returns (
            address org,
            uint256 targetAmount,
            uint256 total,
            bool active,
            bytes32 infoHash,
            uint256 createdAt
        )
    {
        Project memory p = projects[projectId];
        return (p.org, p.targetAmount, p.total, p.active, p.infoHash, p.createdAt);
    }
}
