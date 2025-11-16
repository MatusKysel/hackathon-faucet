// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Faucet {
    address public owner;
    uint256 public constant DRIP_AMOUNT = 0.3 ether; // 0.3 tBNB
    uint256 public cooldown = 1 hours;

    mapping(address => uint256) public lastClaim;

    event Dripped(address indexed to, uint256 amount);
    event CooldownUpdated(uint256 cooldown);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    // allow funding the contract with tBNB
    receive() external payable {}

    function setCooldown(uint256 _cooldown) external {
        require(msg.sender == owner, "Not owner");
        cooldown = _cooldown;
        emit CooldownUpdated(_cooldown);
    }

    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(amount);
        emit Withdrawn(owner, amount);
    }

    function drip(address to) external {
        require(address(this).balance >= DRIP_AMOUNT, "Faucet empty");
        require(to != address(0), "Zero address");
        require(
            block.timestamp - lastClaim[to] >= cooldown,
            "Please wait before next claim"
        );

        lastClaim[to] = block.timestamp;
        payable(to).transfer(DRIP_AMOUNT);
        emit Dripped(to, DRIP_AMOUNT);
    }
}

