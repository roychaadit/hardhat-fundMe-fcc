const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

describe("FundMe", async () => {
    let FundMe
    let signer
    let MockV3Aggregator
    const sendValue = ethers.parseEther("1")
    beforeEach(async () => {
        // don't use (await getNamedAccounts()).deployer, as a parameter to the getContractAt function, it will report an error !!!
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
        const MockV3AggregatorDeployment = await deployments.get(
            "MockV3Aggregator"
        )
        MockV3Aggregator = await ethers.getContractAt(
            MockV3AggregatorDeployment.abi,
            MockV3AggregatorDeployment.address,
            signer
        )
    })

    describe("constructor", async () => {
        it("sets the aggregator address correctly", async () => {
            const response = await FundMe.priceFeed()
            assert.equal(response, MockV3Aggregator.target) // get address using target instead of address property
        })
    })

    describe("fund", async function () {
        it("Fails if you do not send enough ETH", async function () {
            await expect(FundMe.fund()).to.be.revertedWith(
                "You need to spend more ETH!"
            )
        })

        it("updated the amount funded data structure", async () => {
            await FundMe.fund({ value: sendValue })
            const response = await FundMe.addressToAmountFunded(signer.address)
            assert.equal(response.toString(), sendValue.toString())
        })

        it("Adds funder to array of funders", async () => {
            await FundMe.fund({ value: sendValue })
            const funder = await FundMe.funders(0)
            assert.equal(funder, signer.address)
        })
    })

    describe("withdraw", async function () {
        beforeEach(async function () {
            await FundMe.fund({ value: sendValue })
        })

        it("Withdraw ETH from a single founder", async function () {
            const startingFundMeBalance = await ethers.provider.getBalance(
                await FundMe.getAddress()
            )
            const startingDeployerBalance = await ethers.provider.getBalance(
                signer.address
            )

            const transactionResponse = await FundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, gasPrice } = transactionReceipt
            console.log(gasUsed)
            console.log(gasPrice)
            const gasCost = gasUsed * gasPrice

            const endingFundMeBalance = await ethers.provider.getBalance(
                await FundMe.getAddress()
            )
            const endingDeployerBalance = await ethers.provider.getBalance(
                signer.address
            )

            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFundMeBalance + startingDeployerBalance,
                endingDeployerBalance + gasCost
            )
        })
        it("Allows us to withdraw with multiple funders", async () => {
            const accounts = await ethers.getSigners()
            for (i = 1; i < 6; ++i) {
                const fundMeConnectedContract = await FundMe.connect(
                    accounts[i]
                )
                await fundMeConnectedContract.fund({ value: sendValue })
            }

            const startingFundMeBalance = await ethers.provider.getBalance(
                FundMe.getAddress()
            )
            const startingDeployerBalance = await ethers.provider.getBalance(
                signer.address
            )

            const transactionResponse = await FundMe.withdraw()
            const transactionReceipt = await transactionResponse.wait(1)

            const { gasUsed, gasPrice } = transactionReceipt
            const gasCost = gasUsed * gasPrice

            const endingFundMeBalance = await ethers.provider.getBalance(
                await FundMe.getAddress()
            )
            const endingDeployerBalance = await ethers.provider.getBalance(
                signer.address
            )

            assert.equal(endingFundMeBalance, 0)
            assert.equal(
                startingFundMeBalance + startingDeployerBalance,
                endingDeployerBalance + gasCost
            )

            await expect(FundMe.funders(0)).to.be.reverted
            for (i = 1; i < 6; ++i) {
                assert.equal(
                    await FundMe.addressToAmountFunded(
                        accounts[i].getAddress()
                    ),
                    0
                )
            }
        })

        it("Allows only the owner to withdraw", async function () {
            const accounts = await ethers.getSigners()
            const attacker = accounts[1]
            const attackerConnectedContract = await FundMe.connect(attacker)
            await expect(attackerConnectedContract.withdraw()).to.be.reverted
        })
    })
})
