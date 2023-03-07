//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

interface IERC721 {
    function transferFrom(
        address _from,
        address _to,
        uint256 _id
    ) external;
}

contract Escrow {
    address payable public seller;
    address public nftAddress;
    address public lender;
    address public inspector;

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this method");
        _;
    }

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer can send this method");
        _;
    }

    modifier onlyInpector() {
        require(msg.sender == inspector, "Only the inspector can call this method");
        _;
    }

    modifier sufficientAmount(uint256 _nftID) {
        require(msg.value >= escrowAmount[_nftID], "Insufficient payment");
        _;
    }

    modifier salesConditions(uint _nftID) {
        require(inspectionPassed[_nftID]);
        require(approval[_nftID][buyer[_nftID]]);
        require(approval[_nftID][seller]);
        require(approval[_nftID][lender]);
        require(address(this).balance >= purchasePrice[_nftID]);
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(address payable _seller, address _nftAdress, address _lender, address _inspector) {
        seller = _seller;
        nftAddress = _nftAdress;
        lender = _lender;
        inspector = _inspector;
    }

    function _changeListingStatus(uint256 _nftID, bool _status) internal {
        isListed[_nftID] = _status;
    }

    function list(uint256 _nftID, address _buyer, uint256 _purchasePrice, uint256 _escrowAmount) public payable onlySeller{
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);
        _changeListingStatus(_nftID, true);
        purchasePrice[_nftID] = _purchasePrice;
        buyer[_nftID] = _buyer;
        escrowAmount[_nftID] = _escrowAmount;
    }

    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) sufficientAmount(_nftID) {}

    function updatedInspectionStatus(uint256 _nftID, bool _passed) public onlyInpector {
        inspectionPassed[_nftID] = _passed;
    }

    function appoveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    function finalizeSale(uint256 _nftID) public salesConditions(_nftID) {
        _changeListingStatus(_nftID, false);

        (bool success, ) = payable(seller).call{value: address(this).balance}("");
        require(success);

        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
