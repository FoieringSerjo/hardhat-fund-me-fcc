const { assert, expect } = require('chai') //note: chai overwritten with waffle
const { network, deployments, ethers, getNamedAccounts } = require('hardhat')

const { developmentChains } = require('../../helper-hardhat-config')

//note: build tests based on group functions

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('FundMe', function () {
      let fundMe
      let mockV3Aggregator
      let deployer
      const sendValue = ethers.utils.parseEther('1')
      beforeEach(async () => {
        // const accounts = await ethers.getSigners()
        // deployer = accounts[0]
        deployer = (await getNamedAccounts()).deployer
        // console.log('deployer:', deployer)

        //note: fixture allow to deploy everything in the deploy folder with tag "all"
        await deployments.fixture(['all'])
        fundMe = await ethers.getContract('FundMe', deployer)
        mockV3Aggregator = await ethers.getContract('MockV3Aggregator', deployer)
      })

      describe('constructor', function () {
        it('sets the aggregator addresses correctly', async () => {
          const response = await fundMe.getPriceFeed()
          assert.equal(response, mockV3Aggregator.address)
        })
      })

      describe('fund', function () {
        // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
        // could also do assert.fail
        it("Fails if you don't send enough ETH", async () => {
          await expect(fundMe.fund()).to.be.revertedWith('You need to spend more ETH!')
        })

        it('Updates the amount funded data structure', async () => {
          await fundMe.fund({ value: sendValue })
          const response = await fundMe.getAddressToAmountFunded(deployer)
          assert.equal(response.toString(), sendValue.toString())
        })

        it('Adds funder to array of funders', async () => {
          await fundMe.fund({ value: sendValue })
          const response = await fundMe.getFunder(0)
          assert.equal(response, deployer)
        })
      })
      describe('withdraw', function () {
        beforeEach(async () => {
          await fundMe.fund({ value: sendValue })
        })

        it('withdraws ETH from a single funder', async () => {
          // Arrange
          const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const startingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Act
          const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait()

          //note: gasUsed and effectiveGasPrice both objects can be found in transaction response in our case it's transactionReceipt
          // gasUsed: 0x8b38 --> 35640
          // effectiveGasPrice: 0x5f1f711f ---> 1595896095
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const endingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Assert
          // Maybe clean up to understand the testing
          assert.equal(endingFundMeBalance, 0)
          // deployer paid gas hence we need to add gasCost
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          )
        })

        // this test is overloaded. Ideally we'd split it into multiple tests
        // but for simplicity we left it as one
        it('is allows us to withdraw with multiple funders', async () => {
          // Arrange
          const accounts = await ethers.getSigners()
          // index 0 will be the deployer hence starting with index 1
          for (i = 1; i < 6; i++) {
            //note: need to reconnect each account because inside beforeEach the deployer connected to the contract
            const fundMeConnectedContract = await fundMe.connect(accounts[i])
            await fundMeConnectedContract.fund({ value: sendValue })
          }
          const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const startingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Act
          const transactionResponse = await fundMe.withdraw()
          // Let's comapre gas costs :)
          // const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait()
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
          console.log(`GasCost: ${withdrawGasCost}`)
          console.log(`GasUsed: ${gasUsed}`)
          console.log(`GasPrice: ${effectiveGasPrice}`)
          // const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const endingDeployerBalance = await fundMe.provider.getBalance(deployer)
          // Assert
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(withdrawGasCost).toString()
          )
          // Make a getter for storage variables, Make sure that the funders are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted

          for (i = 1; i < 6; i++) {
            assert.equal(await fundMe.getAddressToAmountFunded(accounts[i].address), 0)
          }
        })

        it('Only allows the owner to withdraw', async function () {
          const accounts = await ethers.getSigners()
          const fundMeConnectedAttackerContract = await fundMe.connect(accounts[1])
          await expect(fundMeConnectedAttackerContract.withdraw()).to.be.revertedWith(
            'FundMe__NotOwner'
          )
        })

        it('withdraws ETH from a single funder - cheaperWithdraw', async () => {
          // Arrange
          const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const startingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Act
          const transactionResponse = await fundMe.cheaperWithdraw()
          const transactionReceipt = await transactionResponse.wait()

          //note: gasUsed and effectiveGasPrice both objects can be found in transaction response in our case it's transactionReceipt
          // gasUsed: 0x8b38 --> 35640
          // effectiveGasPrice: 0x5f1f711f ---> 1595896095
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const gasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const endingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Assert
          // Maybe clean up to understand the testing
          assert.equal(endingFundMeBalance, 0)
          // deployer paid gas hence we need to add gasCost
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(gasCost).toString()
          )
        })

        it('is allows us to withdraw with multiple funders with cheaperWithdraw', async () => {
          // Arrange
          const accounts = await ethers.getSigners()
          // index 0 will be the deployer hence starting with index 1
          for (i = 1; i < 6; i++) {
            //note: need to reconnect each account because inside beforeEach the deployer connected to the contract
            const fundMeConnectedContract = await fundMe.connect(accounts[i])
            await fundMeConnectedContract.fund({ value: sendValue })
          }
          const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const startingDeployerBalance = await fundMe.provider.getBalance(deployer)

          // Act
          const transactionResponse = await fundMe.cheaperWithdraw()
          // Let's comapre gas costs :)
          // const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait()
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
          console.log(`GasCost: ${withdrawGasCost}`)
          console.log(`GasUsed: ${gasUsed}`)
          console.log(`GasPrice: ${effectiveGasPrice}`)
          // const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address)
          const endingDeployerBalance = await fundMe.provider.getBalance(deployer)
          // Assert
          assert.equal(
            startingFundMeBalance.add(startingDeployerBalance).toString(),
            endingDeployerBalance.add(withdrawGasCost).toString()
          )
          // Make a getter for storage variables, Make sure that the funders are reset properly
          await expect(fundMe.getFunder(0)).to.be.reverted

          for (i = 1; i < 6; i++) {
            assert.equal(await fundMe.getAddressToAmountFunded(accounts[i].address), 0)
          }
        })
      })
    })
