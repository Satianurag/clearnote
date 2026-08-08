// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ClearNoteController} from "./ClearNoteController.sol";

/// @title DvPEscrow
/// @notice Non-custodial DvP secondary market — cash leg first, then note leg.
contract DvPEscrow is AccessControl {
    ClearNoteController public immutable controller;

    struct Offer {
        address maker;
        address noteToken;
        address cashToken;
        uint256 pricePerUnit;
        uint256 minFill;
        uint64 expiry;
        uint256 remaining;
        bool active;
    }

    uint256 public nextOfferId;
    mapping(uint256 => Offer) public offers;
    uint256[] private _openOffers;

    event OfferPosted(
        uint256 indexed offerId,
        address indexed maker,
        address noteToken,
        address cashToken,
        uint256 units,
        uint256 pricePerUnit,
        uint256 minFill,
        uint64 expiry
    );
    event OfferFilled(uint256 indexed offerId, address indexed buyer, uint256 units, uint256 cashPaid);
    event OfferCancelled(uint256 indexed offerId, address indexed maker);

    error CashLegFailed();
    error OfferExpired();
    error BelowMinFill();
    error OfferNotFound();
    error NotOfferMaker();
    error InsufficientRemaining();
    error OfferInactive();

    constructor(address controller_, address admin) {
        controller = ClearNoteController(controller_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function postOffer(
        address noteToken,
        address cashToken,
        uint256 units,
        uint256 pricePerUnit,
        uint256 minFill,
        uint64 expiry
    ) external returns (uint256 offerId) {
        if (units == 0 || expiry <= block.timestamp) revert OfferExpired();
        if (minFill == 0 || minFill > units) revert BelowMinFill();

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            maker: msg.sender,
            noteToken: noteToken,
            cashToken: cashToken,
            pricePerUnit: pricePerUnit,
            minFill: minFill,
            expiry: expiry,
            remaining: units,
            active: true
        });
        _openOffers.push(offerId);
        emit OfferPosted(offerId, msg.sender, noteToken, cashToken, units, pricePerUnit, minFill, expiry);
    }

    function fill(uint256 offerId, uint256 units) external {
        Offer storage offer = offers[offerId];
        if (offer.maker == address(0)) revert OfferNotFound();
        if (!offer.active) revert OfferInactive();
        if (block.timestamp > offer.expiry) revert OfferExpired();
        if (units == 0 || units > offer.remaining) revert InsufficientRemaining();

        uint256 remainingAfter = offer.remaining - units;
        if (units < offer.minFill && remainingAfter != 0) revert BelowMinFill();

        address seller = offer.maker;
        address buyer = msg.sender;
        uint256 cashAmt = (units * offer.pricePerUnit) / 1e18;

        if (!IERC20(offer.cashToken).transferFrom(buyer, seller, cashAmt)) revert CashLegFailed();
        if (!IERC20(offer.noteToken).transferFrom(seller, buyer, units)) revert CashLegFailed();

        controller.onTransfer(offer.noteToken, seller, buyer, units);

        offer.remaining = remainingAfter;
        if (remainingAfter == 0) {
            offer.active = false;
            _removeOpen(offerId);
        }

        emit OfferFilled(offerId, buyer, units, cashAmt);
    }

    function cancel(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        if (offer.maker == address(0)) revert OfferNotFound();
        if (offer.maker != msg.sender) revert NotOfferMaker();
        if (!offer.active) revert OfferInactive();
        offer.active = false;
        offer.remaining = 0;
        _removeOpen(offerId);
        emit OfferCancelled(offerId, msg.sender);
    }

    function offerOf(uint256 offerId)
        external
        view
        returns (
            address maker,
            address noteToken,
            address cashToken,
            uint256 pricePerUnit,
            uint256 minFill,
            uint64 expiry,
            uint256 remaining,
            bool active
        )
    {
        Offer memory o = offers[offerId];
        return (
            o.maker, o.noteToken, o.cashToken, o.pricePerUnit, o.minFill, o.expiry, o.remaining, o.active
        );
    }

    function openOffers() external view returns (uint256[] memory) {
        return _openOffers;
    }

    function _removeOpen(uint256 offerId) internal {
        uint256 len = _openOffers.length;
        for (uint256 i = 0; i < len; i++) {
            if (_openOffers[i] == offerId) {
                _openOffers[i] = _openOffers[len - 1];
                _openOffers.pop();
                break;
            }
        }
    }
}
