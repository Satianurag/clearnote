// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IInvoiceRegistryView {
    function backingOf(address noteToken) external view returns (bytes32 invoiceId);
}
