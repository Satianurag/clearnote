export const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const invoiceRegistryAbi = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'inv',
        type: 'tuple',
        components: [
          { name: 'docHash', type: 'bytes32' },
          { name: 'pintProfileHash', type: 'bytes32' },
          { name: 'originator', type: 'address' },
          { name: 'obligor', type: 'address' },
          { name: 'faceValue', type: 'uint256' },
          { name: 'dueDate', type: 'uint64' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'currency', type: 'bytes3' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
    outputs: [{ name: 'invoiceId', type: 'bytes32' }],
  },
  {
    name: 'get',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'docHash', type: 'bytes32' },
          { name: 'pintProfileHash', type: 'bytes32' },
          { name: 'originator', type: 'address' },
          { name: 'obligor', type: 'address' },
          { name: 'faceValue', type: 'uint256' },
          { name: 'dueDate', type: 'uint64' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'currency', type: 'bytes3' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
  },
  {
    name: 'acceptByObligor',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'backingOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'noteToken', type: 'address' }],
    outputs: [{ name: 'invoiceId', type: 'bytes32' }],
  },
  {
    name: 'raiseDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

export const clearNoteControllerAbi = [
  {
    name: 'issueNote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'noteToken', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'units', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'settle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'noteToken', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'markDefault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'invoiceId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'primaryHolder',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'noteToken', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'lockedUntil',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'holder', type: 'address' },
    ],
    outputs: [{ type: 'uint64' }],
  },
  {
    name: 'investorCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const dvpEscrowAbi = [
  {
    name: 'postOffer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteToken', type: 'address' },
      { name: 'cashToken', type: 'address' },
      { name: 'units', type: 'uint256' },
      { name: 'pricePerUnit', type: 'uint256' },
      { name: 'minFill', type: 'uint256' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [{ name: 'offerId', type: 'uint256' }],
  },
  {
    name: 'fill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'offerId', type: 'uint256' },
      { name: 'units', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'cancel',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'offerId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'offers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'offerId', type: 'uint256' }],
    outputs: [
      { name: 'maker', type: 'address' },
      { name: 'noteToken', type: 'address' },
      { name: 'cashToken', type: 'address' },
      { name: 'pricePerUnit', type: 'uint256' },
      { name: 'minFill', type: 'uint256' },
      { name: 'expiry', type: 'uint64' },
      { name: 'remaining', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'nextOfferId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const clearNotePolicyAbi = [
  {
    name: 'inspect',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'ok', type: 'bool' },
      { name: 'code', type: 'bytes4' },
      { name: 'reason', type: 'string' },
    ],
  },
] as const

export const sanctionsRegistryAbi = [
  {
    name: 'verifyInclusion',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'who', type: 'address' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isSanctioned',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'who', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'rootCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'rootAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [
      { name: 'root', type: 'bytes32' },
      { name: 'sourceUri', type: 'string' },
      { name: 'publishedAt', type: 'uint64' },
    ],
  },
] as const

export const miniDvpAbi = [
  {
    name: 'settle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'note', type: 'address' },
      { name: 'cash', type: 'address' },
      { name: 'seller', type: 'address' },
      { name: 'buyer', type: 'address' },
      { name: 'noteAmt', type: 'uint256' },
      { name: 'cashAmt', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const auditAnchorAbi = [
  {
    name: 'anchorCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'anchors',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'packHash', type: 'bytes32' },
      { name: 'uri', type: 'string' },
      { name: 'periodStart', type: 'uint64' },
      { name: 'periodEnd', type: 'uint64' },
      { name: 'anchoredAt', type: 'uint64' },
    ],
  },
  {
    name: 'Anchored',
    type: 'event',
    inputs: [
      { name: 'anchorId', type: 'uint256', indexed: true },
      { name: 'packHash', type: 'bytes32', indexed: true },
      { name: 'uri', type: 'string', indexed: false },
      { name: 'periodStart', type: 'uint64', indexed: false },
      { name: 'periodEnd', type: 'uint64', indexed: false },
    ],
  },
] as const
