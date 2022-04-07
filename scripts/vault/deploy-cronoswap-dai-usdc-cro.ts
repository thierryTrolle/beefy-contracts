import hardhat, { ethers, web3 } from "hardhat";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";
// import { checkGas } from "../../utils/checkGas";

import { cronos } from "blockchain-addressbook/build/address-book/cronos";

import { BigNumber } from "ethers";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { crona, beefyfinance },
  tokens: {
    WCRO : { address: WCRO },
    CRONA: { address: CRONA },
    DAI: { address: DAI },
    USDC: { address: USDC },
  },
} = cronos;

const shouldCheckGas = false; // You can use this on a live deployment to delay until gas is cheap
const shouldVerifyOnEtherscan = false; // Always verify on live deployment
const shouldTransferOwner = true; // Always
const shouldSetPendingRewardsFunctionName = false; // Used for some strats and not others
const shouldHarvestOnDeposit = false; // Used for low fee chains (callFee = 11)

const gasLimit = BigNumber.from(web3.utils.toWei("30", "Gwei"));

const vaultParams = {
  mooName: "Moo cronaV2 DAI-USDC",
  mooSymbol: "MooCronaV2DAI-USDC",
  delay: 21600,
};

const vaultOwner = beefyfinance.vaultOwner;
const strategyOwner = beefyfinance.strategyOwner;

const strategyParams = {
  want: "0xaebafdbe975db0bfbf4e95a6493cb93d02cc86ae",
  chef: "0x7B1982b896CF2034A0674Acf67DC7924444637E4",//FIXME put on addressbook
  poolId: 10,
  unirouter: "0xcd7d16fB918511BF7269eC4f48d61D79Fb26f918",//FIXME put on addressbook
  strategist: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // insert your wallet here
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [CRONA, WCRO],
  outputToLp0Route: [CRONA, USDC],
  outputToLp1Route: [CRONA, WCRO, DAI],
  pendingRewardsFunctionName: "pendingSpirit", // unused for GaugeLP
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCronaMasterChefV2LP",
};

async function main() {
  if (
    Object.values(vaultParams).some(v => v === undefined) ||
    Object.values(strategyParams).some(v => v === undefined) ||
    Object.values(contractNames).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }
//   if (!checksumAddresses()) {
//     console.error("one of address checksums is invalid");
//     return;
//   }

  await hardhat.run("compile");

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  const [deployer] = await ethers.getSigners();

//   if (shouldCheckGas) {
//     await checkGasLimits();
//   }

  console.log("Deploying:", vaultParams.mooName);

  const predictedAddresses = await predictAddresses({ creator: deployer.address });

  const vaultConstructorArguments = [
    predictedAddresses.strategy,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];

  const vault = await Vault.deploy(...vaultConstructorArguments);
  await vault.deployed();


  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.poolId,
    strategyParams.chef,
    vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();


  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("Pool ID:", strategyParams.poolId);

  console.log();
  console.log("Running post deployment");

  const verifyContractsPromises: Promise<any>[] = [];
  if (shouldVerifyOnEtherscan) {
    // skip await as this is a long running operation, and you can do other stuff to prepare vault while this finishes
    verifyContractsPromises.push(
      verifyContract(vault.address, vaultConstructorArguments),
      verifyContract(strategy.address, strategyConstructorArguments)
    );
  }
  if (shouldSetPendingRewardsFunctionName) {
    await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  }
  await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain);
  if (shouldHarvestOnDeposit) {
    await strategy.setHarvestOnDeposit(true);
  }
  if (shouldTransferOwner) {
    console.log(`Transfering Vault Owner to ${beefyfinance.vaultOwner}`);
    await vault.transferOwnership(beefyfinance.vaultOwner);
  }

  console.log();

  await Promise.all(verifyContractsPromises);

  if (hardhat.network.name === "bsc") {
    await registerSubsidy(vault.address, deployer);
    await registerSubsidy(strategy.address, deployer);
  }
}

const checksumAddresses = () => {
  const result =
    web3.utils.checkAddressChecksum(strategyParams.want) && web3.utils.checkAddressChecksum(strategyParams.strategist);
  if (!result) {
    console.log(`want: ${web3.utils.checkAddressChecksum(strategyParams.want)}
      strategist: ${web3.utils.checkAddressChecksum(strategyParams.strategist)}`);
  }
  return result;
};

// const checkGasLimits = async () => {
//   console.log(`Checking gas price against limit ${gasLimit}`);
//   let gasPrice = await checkGas();
//   while (gasPrice >= gasLimit) {
//     console.log(
//       `Gas price ${ethers.utils.formatEther(gasPrice)} is higher than limit ${ethers.utils.formatEther(gasLimit)}`
//     );
//     await new Promise(resolve => setTimeout(resolve, 15 * 1000)); // sleep 60 seconds
//     gasPrice = await checkGas();
//   }
//   return gasPrice;
// };

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });