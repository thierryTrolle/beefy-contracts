// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface ICronaMasterChefV2LP {
    function poolLength() external view returns (uint256);
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
    function pendingCrona(uint256 _pid, address _user) external view returns (uint256);
    function deposit(uint256 pid, uint256 amount) external;
    function withdraw(uint256 pid, uint256 amount) external;
    function harvest() external;
    function harvestAllRewards(address _user) external;
    function emergencyWithdraw(uint256 pid) external;
} 