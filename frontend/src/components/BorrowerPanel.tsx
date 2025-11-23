import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
import { parseEther, parseUnits, formatEther } from 'viem';
import { getAddress } from '../deployments';
import { baseSepolia, arbitrumSepolia } from 'wagmi/chains';
import toast from 'react-hot-toast';

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
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  
  const { writeContract: depositCollateral, data: collateralHash, isPending: isCollateralPending } = useWriteContract();
  const { writeContract: borrow, data: borrowHash, isPending: isBorrowPending } = useWriteContract();
  const { writeContract: repay, data: repayHash, isPending: isRepayPending } = useWriteContract();
  
  const { isLoading: isDepositingCollateral, isSuccess: isCollateralSuccess } = useWaitForTransactionReceipt({ hash: collateralHash });
  const { isLoading: isBorrowing, isSuccess: isBorrowSuccess } = useWaitForTransactionReceipt({ hash: borrowHash });
  const { isLoading: isRepaying, isSuccess: isRepaySuccess } = useWaitForTransactionReceipt({ hash: repayHash });

  const isOnBase = chainId === baseSepolia.id;
  const isOnArbitrum = chainId === arbitrumSepolia.id;

  // Get ETH balance on Base
  const { data: baseBalance, refetch: refetchBaseBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  // Handle transaction success notifications
  useEffect(() => {
    if (isCollateralSuccess) {
      toast.success('✅ Collateral deposited! Cross-chain message sent to Arbitrum.');
      refetchBaseBalance();
      setCollateralAmount('');
    }
  }, [isCollateralSuccess, refetchBaseBalance]);

  useEffect(() => {
    if (isBorrowSuccess) {
      toast.success('✅ Borrow initiated! USDC will arrive on Optimism in 1-2 minutes.');
      setBorrowAmount('');
    }
  }, [isBorrowSuccess]);

  useEffect(() => {
    if (isRepaySuccess) {
      toast.success('✅ Loan repaid successfully!');
      setRepayAmount('');
    }
  }, [isRepaySuccess]);

  const handleDepositCollateral = async () => {
    if (!collateralAmount || !isOnBase) return;
    
    try {
      const collateralValue = parseEther(collateralAmount);
      const lzFee = parseEther('0.01'); // LayerZero fee estimate
      const totalValue = collateralValue + lzFee;
      
      // Check if user has enough balance
      if (baseBalance && baseBalance.value < totalValue) {
        toast.error('Insufficient balance. You need extra ETH for LayerZero fees (~0.01 ETH)');
        return;
      }
      
      toast.loading('Depositing collateral...', { id: 'collateral' });
      
      depositCollateral({
        address: getAddress('baseSepolia', 'collateralVault'),
        abi: COLLATERAL_VAULT_ABI,
        functionName: 'depositNative',
        value: totalValue,
        chainId: baseSepolia.id,
        gas: 500000n,
      });
      
      toast.dismiss('collateral');
    } catch (error: any) {
      console.error('Deposit collateral error:', error);
      toast.error(`Deposit failed: ${error.shortMessage || error.message || 'Unknown error'}`, { id: 'collateral' });
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || !isOnArbitrum) return;
    
    try {
      const amountBN = parseUnits(borrowAmount, 6);
      toast.loading('Initiating cross-chain borrow...', { id: 'borrow' });
      
      // Optimism Sepolia EID = 40232
      borrow({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'borrowCrossChain',
        args: [amountBN, 40232, amountBN],
        value: parseEther('0.02'), // Increased LayerZero fee for OFT transfer
        chainId: arbitrumSepolia.id,
        gas: 1000000n,
      });
      
      toast.dismiss('borrow');
    } catch (error: any) {
      console.error('Borrow error:', error);
      toast.error(`Borrow failed: ${error.shortMessage || error.message || 'Unknown error'}`, { id: 'borrow' });
    }
  };

  const handleRepay = async () => {
    if (!repayAmount || !isOnArbitrum) return;
    
    try {
      const amountBN = parseUnits(repayAmount, 6);
      toast.loading('Repaying loan...', { id: 'repay' });
      
      repay({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'repay',
        args: [amountBN],
        chainId: arbitrumSepolia.id,
        gas: 300000n,
      });
      
      toast.dismiss('repay');
    } catch (error: any) {
      console.error('Repay error:', error);
      toast.error(`Repay failed: ${error.shortMessage || error.message || 'Unknown error'}`, { id: 'repay' });
    }
  };

  if (!isConnected) {
    return null;
  }

  const formattedBaseBalance = baseBalance ? formatEther(baseBalance.value) : '0';
  const isProcessing = isCollateralPending || isDepositingCollateral || isBorrowPending || isBorrowing || isRepayPending || isRepaying;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">🏦 Borrower Actions</h2>
      
      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
        <p className="text-yellow-200 text-xs">
          ⚠️ Cross-chain transactions include LayerZero fees (~0.01-0.02 ETH extra)
        </p>
      </div>

      {isOnBase && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
          <p className="text-blue-200 text-sm">
            💎 Your Balance: <span className="font-bold">{parseFloat(formattedBaseBalance).toFixed(4)} ETH</span>
          </p>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Deposit Collateral */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            1️⃣ Collateral (ETH on Base) {!isOnBase && <span className="text-yellow-400">⚠️ Switch to Base</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="0.001"
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleDepositCollateral}
              disabled={isCollateralPending || isDepositingCollateral || !collateralAmount || !isOnBase || isProcessing}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isCollateralPending || isDepositingCollateral ? 'Depositing...' : 'Deposit'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Includes ~0.01 ETH LayerZero fee</p>
        </div>

        {/* Borrow */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            2️⃣ Borrow (USDC to Optimism) {!isOnArbitrum && <span className="text-yellow-400">⚠️ Switch to Arbitrum</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleBorrow}
              disabled={isBorrowPending || isBorrowing || !borrowAmount || !isOnArbitrum || isProcessing}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isBorrowPending || isBorrowing ? 'Borrowing...' : 'Borrow'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Requires 0.02 ETH for LayerZero + OFT fees</p>
        </div>

        {/* Repay */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            3️⃣ Repay (USDC on Arbitrum) {!isOnArbitrum && <span className="text-yellow-400">⚠️ Switch to Arbitrum</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleRepay}
              disabled={isRepayPending || isRepaying || !repayAmount || !isOnArbitrum || isProcessing}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isRepayPending || isRepaying ? 'Repaying...' : 'Repay'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Approve USDC first in Lender panel</p>
        </div>
      </div>
    </div>
  );
}
