import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { getAddress } from '../deployments';
import { baseSepolia, arbitrumSepolia } from 'wagmi/chains';
import { useRequireChain } from './ChainSwitcher';

const COLLATERAL_VAULT_ABI = [
  {
    inputs: [],
    name: 'depositNative',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

const PROTOCOL_CORE_ABI = [
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
] as const;

export default function BorrowerPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  
  const { writeContract: depositCollateral, data: collateralHash } = useWriteContract();
  const { writeContract: borrow, data: borrowHash } = useWriteContract();
  const { writeContract: repay, data: repayHash } = useWriteContract();
  
  const { isLoading: isDepositingCollateral } = useWaitForTransactionReceipt({ hash: collateralHash });
  const { isLoading: isBorrowing } = useWaitForTransactionReceipt({ hash: borrowHash });
  const { isLoading: isRepaying } = useWaitForTransactionReceipt({ hash: repayHash });

  const isOnBase = chainId === baseSepolia.id;
  const isOnArbitrum = chainId === arbitrumSepolia.id;

  const handleDepositCollateral = async () => {
    if (!collateralAmount) return;
    try {
      // Add extra ETH for LayerZero cross-chain message fee
      const collateralValue = parseEther(collateralAmount);
      const lzFee = parseEther('0.01'); // LayerZero fee estimate
      const totalValue = collateralValue + lzFee;
      
      depositCollateral({
        address: getAddress('baseSepolia', 'collateralVault'),
        abi: COLLATERAL_VAULT_ABI,
        functionName: 'depositNative',
        value: totalValue,
        chainId: baseSepolia.id,
        gas: 500000n, // Manual gas limit
      });
    } catch (error) {
      console.error('Deposit collateral error:', error);
      alert('Transaction failed. Make sure you have enough ETH for gas + LayerZero fees.');
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount) return;
    try {
      // Optimism Sepolia EID = 40232
      borrow({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'borrowCrossChain',
        args: [parseUnits(borrowAmount, 6), 40232, parseUnits(borrowAmount, 6)],
        value: parseEther('0.02'), // Increased LayerZero fee for OFT transfer
        chainId: arbitrumSepolia.id,
        gas: 1000000n, // Manual gas limit for complex cross-chain tx
      });
    } catch (error) {
      console.error('Borrow error:', error);
      alert('Transaction failed. Make sure you have collateral deposited and enough ETH for fees.');
    }
  };

  const handleRepay = async () => {
    if (!repayAmount) return;
    try {
      repay({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'repay',
        args: [parseUnits(repayAmount, 6)],
        chainId: arbitrumSepolia.id,
        gas: 300000n, // Manual gas limit
      });
    } catch (error) {
      console.error('Repay error:', error);
      alert('Transaction failed. Make sure you have approved USDC and have enough balance.');
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">🏦 Borrower Actions</h2>
      
      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
        <p className="text-yellow-200 text-xs">
          ⚠️ Cross-chain transactions include LayerZero fees (~0.01-0.02 ETH extra)
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Deposit Collateral */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            Collateral (ETH on Base) {!isOnBase && <span className="text-yellow-400">⚠️ Switch to Base</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="0.0001"
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={handleDepositCollateral}
              disabled={isDepositingCollateral || !collateralAmount || !isOnBase}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
            >
              {isDepositingCollateral ? 'Depositing...' : 'Deposit'}
            </button>
          </div>
        </div>

        {/* Borrow */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            Borrow (USDC to Optimism) {!isOnArbitrum && <span className="text-yellow-400">⚠️ Switch to Arbitrum</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="1.00"
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={handleBorrow}
              disabled={isBorrowing || !borrowAmount || !isOnArbitrum}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
            >
              {isBorrowing ? 'Borrowing...' : 'Borrow'}
            </button>
          </div>
        </div>

        {/* Repay */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            Repay (USDC on Arbitrum) {!isOnArbitrum && <span className="text-yellow-400">⚠️ Switch to Arbitrum</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="1.00"
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              onClick={handleRepay}
              disabled={isRepaying || !repayAmount || !isOnArbitrum}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
            >
              {isRepaying ? 'Repaying...' : 'Repay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

