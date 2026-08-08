// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title InvoiceRegistry
/// @notice Single source of truth for invoice lifecycle and duplicate-financing detection.
contract InvoiceRegistry is AccessControl, EIP712 {
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    bytes32 private constant INVOICE_ACCEPTANCE_TYPEHASH =
        keccak256(
            "InvoiceAcceptance(bytes32 invoiceId,address obligor,uint256 faceValue,uint64 dueDate,uint256 deadline)"
        );

    enum Status {
        None,
        Registered,
        ObligorAccepted,
        Financed,
        Settled,
        Defaulted,
        Disputed
    }

    struct Invoice {
        bytes32 docHash;
        bytes32 pintProfileHash;
        address originator;
        address obligor;
        uint256 faceValue;
        uint64 dueDate;
        uint64 registeredAt;
        bytes3 currency;
        Status status;
    }

    mapping(bytes32 => Invoice) private _invoices;
    mapping(address => bytes32) private _backing;
    mapping(bytes32 => uint256) private _duplicateAttempts;

    event InvoiceRegistered(bytes32 indexed invoiceId, address indexed originator, address indexed obligor);
    event ObligorAccepted(bytes32 indexed invoiceId, address indexed obligor, uint256 deadline);
    event InvoiceFinanced(bytes32 indexed invoiceId, address indexed noteToken, uint256 units);
    event InvoiceSettled(bytes32 indexed invoiceId);
    event InvoiceDefaulted(bytes32 indexed invoiceId);
    event DisputeRaised(bytes32 indexed invoiceId, bytes32 evidenceHash);
    event DuplicateAttempted(bytes32 indexed invoiceId, address wouldBeOriginator, address existingOriginator);

    error InvoiceAlreadyFinanced(bytes32 invoiceId, address firstOriginator);
    error InvoiceAlreadyRegistered(bytes32 invoiceId);
    error BadObligorSignature();
    error AcceptanceExpired();
    error WrongStatus(uint8 have, uint8 want);
    error NotObligor();

    constructor(address admin) EIP712("ClearNote", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function register(Invoice calldata inv) external returns (bytes32 invoiceId) {
        if (inv.originator != msg.sender) revert NotObligor();

        invoiceId = inv.docHash;
        Invoice storage existing = _invoices[invoiceId];

        if (existing.status != Status.None) {
            address existingOriginator = existing.originator;
            _duplicateAttempts[invoiceId]++;
            emit DuplicateAttempted(invoiceId, inv.originator, existingOriginator);

            if (existing.status >= Status.Financed) {
                return bytes32(0);
            }
            revert InvoiceAlreadyRegistered(invoiceId);
        }

        _invoices[invoiceId] = Invoice({
            docHash: inv.docHash,
            pintProfileHash: inv.pintProfileHash,
            originator: inv.originator,
            obligor: inv.obligor,
            faceValue: inv.faceValue,
            dueDate: inv.dueDate,
            registeredAt: uint64(block.timestamp),
            currency: inv.currency,
            status: Status.Registered
        });

        emit InvoiceRegistered(invoiceId, inv.originator, inv.obligor);
    }

    function acceptByObligor(bytes32 invoiceId, uint256 deadline, bytes calldata sig) external {
        if (block.timestamp > deadline) revert AcceptanceExpired();

        Invoice storage inv = _invoices[invoiceId];
        if (inv.status != Status.Registered) {
            revert WrongStatus(uint8(inv.status), uint8(Status.Registered));
        }

        bytes32 structHash = keccak256(
            abi.encode(
                INVOICE_ACCEPTANCE_TYPEHASH,
                invoiceId,
                inv.obligor,
                inv.faceValue,
                inv.dueDate,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, sig);
        if (signer != inv.obligor) revert BadObligorSignature();

        inv.status = Status.ObligorAccepted;
        emit ObligorAccepted(invoiceId, inv.obligor, deadline);
    }

    function markFinanced(bytes32 invoiceId, address noteToken, uint256 units) external onlyRole(CONTROLLER_ROLE) {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status != Status.ObligorAccepted) {
            revert WrongStatus(uint8(inv.status), uint8(Status.ObligorAccepted));
        }
        inv.status = Status.Financed;
        _backing[noteToken] = invoiceId;
        emit InvoiceFinanced(invoiceId, noteToken, units);
    }

    function markSettled(bytes32 invoiceId) external onlyRole(CONTROLLER_ROLE) {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status != Status.Financed) {
            revert WrongStatus(uint8(inv.status), uint8(Status.Financed));
        }
        inv.status = Status.Settled;
        emit InvoiceSettled(invoiceId);
    }

    function markDefaulted(bytes32 invoiceId) external onlyRole(CONTROLLER_ROLE) {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status != Status.Financed) {
            revert WrongStatus(uint8(inv.status), uint8(Status.Financed));
        }
        inv.status = Status.Defaulted;
        emit InvoiceDefaulted(invoiceId);
    }

    function raiseDispute(bytes32 invoiceId, bytes32 evidenceHash) external {
        Invoice storage inv = _invoices[invoiceId];
        if (inv.status == Status.None) {
            revert WrongStatus(uint8(inv.status), uint8(Status.Registered));
        }
        if (msg.sender != inv.originator && msg.sender != inv.obligor) revert NotObligor();
        if (inv.status >= Status.Settled) {
            revert WrongStatus(uint8(inv.status), uint8(Status.Financed));
        }
        inv.status = Status.Disputed;
        emit DisputeRaised(invoiceId, evidenceHash);
    }

    function get(bytes32 invoiceId) external view returns (Invoice memory) {
        return _invoices[invoiceId];
    }

    function isFinanced(bytes32 invoiceId) external view returns (bool) {
        return _invoices[invoiceId].status >= Status.Financed;
    }

    function backingOf(address noteToken) external view returns (bytes32 invoiceId) {
        return _backing[noteToken];
    }

    function duplicateAttempts(bytes32 invoiceId) external view returns (uint256) {
        return _duplicateAttempts[invoiceId];
    }
}
