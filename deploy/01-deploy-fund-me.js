const { network } = require('hardhat')
const { networkConfig, developmentChains } = require('../helper-hardhat-config')
const { verify } = require('../utils/verify')
require('dotenv').config()

//* getNamedAccounts, deployments - destructure from hre
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  //note: if chainId is Z use address A
  //note: if chainId ix X use address B

  //note: if the contract doesn't exists, we deploy a minimal version of for our local testing
  let ethUsdPriceFeedAddress
  if (chainId == 31337) {
    const ethUsdAggregator = await deployments.get('MockV3Aggregator')
    ethUsdPriceFeedAddress = ethUsdAggregator.address
  } else {
    ethUsdPriceFeedAddress = networkConfig[chainId]['ethUsdPriceFeed']
  }
  log('----------------------------------------------------')
  log('Deploying FundMe and waiting for confirmations...')
  const fundMe = await deploy('FundMe', {
    from: deployer,
    args: [ethUsdPriceFeedAddress], //note: Accept price feed contract address
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: network.config.blockConfirmations || 1,
  })
  log(`FundMe deployed at ${fundMe.address}`)

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verify(fundMe.address, [ethUsdPriceFeedAddress])
  }
}

module.exports.tags = ['all', 'fundme']
