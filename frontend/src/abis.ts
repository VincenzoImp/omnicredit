export const MOCKUSDC_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const PROTOCOL_CORE_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'deposit',
    outputs: [{ name: 'sharesIssued', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'shareAmount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [{ name: 'amountWithdrawn', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'shareAmount', type: 'uint256' },
      { name: 'dstEid', type: 'uint32' },
      { name: 'minAmountLD', type: 'uint256' },
    ],
    name: 'withdrawCrossChain',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'shares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'dstEid', type: 'uint32' },
      { name: 'minAmountLD', type: 'uint256' },
    ],
    name: 'borrowCrossChain',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'loans',
    outputs: [
      { name: 'principal', type: 'uint256' },
      { name: 'interestRate', type: 'uint256' },
      { name: 'lastAccrualTimestamp', type: 'uint256' },
      { name: 'accruedInterest', type: 'uint256' },
      { name: 'collateralValueUSD', type: 'uint256' },
      { name: 'dueDate', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'borrower', type: 'address' }],
    name: 'getBorrowerCollateralValue',
    outputs: [{ name: 'valueUSD', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const COLLATERAL_VAULT_ABI = [
  {
    inputs: [],
    name: 'depositNative',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'borrowAmount', type: 'uint256' },
      { name: 'dstEid', type: 'uint32' },
      { name: 'minAmountLD', type: 'uint256' },
    ],
    name: 'depositNativeAndBorrow',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'depositToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'asset', type: 'address' },
    ],
    name: 'getUserCollateral',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const LENDER_VAULT_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'minAmountLD', type: 'uint256' }
    ],
    name: 'deposit',
    outputs: [{ name: 'guid', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'guid', type: 'bytes32' }],
    name: 'checkAndRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
