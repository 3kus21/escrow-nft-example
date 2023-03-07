const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender
    let realEstate, escrow

    beforeEach(async () => {
        [buyer, seller, inspector, lender] = await ethers.getSigners();

        const RealEstate = await ethers.getContractFactory('RealEstate');
        realEstate = await RealEstate.deploy();

        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS");
        await transaction.wait();

        const Escrow = await ethers.getContractFactory("Escrow");
        escrow = await Escrow.deploy(seller.address, realEstate.address, lender.address, inspector.address);

        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait();

        transaction = await escrow.connect(seller).list(1,  buyer.address, tokens(10), tokens(5));
        await transaction.wait();
    });

    describe("Deployment", () => {
        it("Returns NFT Address", async () => {
            const result = await escrow.nftAddress();
            expect(result).to.be.equal(realEstate.address);
        });
        it("Returns Seller Address", async () => {
            const result = await escrow.seller();
            expect(result).to.be.equal(seller.address);
        });
        it("Returns Inspector Address", async () => {
            const result = await escrow.inspector();
            expect(result).to.be.equal(inspector.address);
        });
        it("Returns Lender Address", async () => {
            const result = await escrow.lender();
            expect(result).to.be.equal(lender.address);
        });
    });

    describe("Listing", () => {
        it('Updates ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
        });
        it("Should reject someone other than the seller calling the function", async () => {
            await expect(escrow.connect(buyer).list(1,  buyer.address, tokens(10), tokens(5))).to.be.revertedWith("Only seller can call this method");
        });
        it("Updates token as listed", async () => {
            const result = await escrow.isListed(1);
            expect(result).to.be.equal(true);
        });
        it('Returns buyer', async () => {
            const result = await escrow.buyer(1);
            expect(result).to.be.equal(buyer.address);
        });
        it('Returns purchase price', async () => {
            const result = await escrow.purchasePrice(1)
            expect(result).to.be.equal(tokens(10))
        });
        it('Returns escrow amount', async () => {
            const result = await escrow.escrowAmount(1)
            expect(result).to.be.equal(tokens(5))
        });
    });

    describe("Deposits", () => {
        it("Should reject a payment with insufficient funds", async () => {
            await expect(escrow.connect(buyer).depositEarnest(1, {value: tokens(3)})).to.be.revertedWith("Insufficient payment");
        });
        it("Should reject a call that is not from the buyer", async () => {
            await expect(escrow.connect(seller).depositEarnest(1, {value: tokens(3)})).to.be.revertedWith("Only buyer can send this method");
        });
        it("Updates contract balance", async () => {
            const transaction = await escrow.connect(buyer).depositEarnest(1, {value: tokens(5)});
            await transaction.wait();
            const result = await escrow.getBalance();
            expect(result).to.be.equal(tokens(5));
        }); 
    });

    describe("Inspection", () => {
        it("Should reject a call that is not from the inspector", async () => {
            await expect(escrow.connect(seller).updatedInspectionStatus(1, true)).to.be.revertedWith("Only the inspector can call this method");
        });
        it("Updates inspection status", async () => {
            const transaction = await escrow.connect(inspector).updatedInspectionStatus(1, true);
            await transaction.wait();
            const result = await escrow.inspectionPassed(1);
            expect(result).to.be.equal(true);
        }); 
    });

    describe("Approval", () => {
        it("Updates approval status", async () => {
            let transaction = await escrow.connect(buyer).appoveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).appoveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).appoveSale(1);
            await transaction.wait();

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
            expect(await escrow.approval(1, seller.address)).to.be.equal(true);
            expect(await escrow.approval(1, lender.address)).to.be.equal(true);
        }); 
    });

    describe("Sale", async () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5)});
            await transaction.wait();
            transaction = await escrow.connect(inspector).updatedInspectionStatus(1, true);
            await transaction.wait();
            transaction = await escrow.connect(buyer).appoveSale(1);
            await transaction.wait();
            transaction = await escrow.connect(seller).appoveSale(1);
            await transaction.wait();
            transaction = await escrow.connect(lender).appoveSale(1);
            await transaction.wait();
            await lender.sendTransaction({to: escrow.address, value: tokens(5)});
            transaction = await escrow.connect(seller).finalizeSale(1);
            await transaction.wait();
        });

        it("Updates balance", async () => {
            expect(await escrow.getBalance()).to.be.equal(0);
        });

        it("Updates the ownershipt", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
        });

        it("Updates token as unlisted", async () => {
            const result = await escrow.isListed(1);
            expect(result).to.be.equal(false);
        });
    })
})
