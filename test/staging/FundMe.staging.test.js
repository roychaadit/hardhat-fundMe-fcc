const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          let FundMe, signer
          const sendValue = ethers.parseEther("1")
          beforeEach(async function () {
            const accounts = await ethers.getSigners()
            signer = accounts[0]
            await deployments.fixture(["all"])

            // there is no getContract function in ethers, so using getContractAt
            const FundMeDeployment = await deployments.get("FundMe")
            FundMe = await ethers.getContractAt(
                FundMeDeployment.abi,
                FundMeDeployment.address,
                signer
            )
          })

          it("Allows people to fund and withdraw", async function () {
              await FundMe.fund({ value: sendValue })
              await FundMe.withdraw()
              const endingBalance = await ethers.provider.getBalance(
                  FundMe.getAddress()
              )
              assert(endingBalance.toString(), "0")
          })
      })
