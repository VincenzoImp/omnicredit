import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useChainId, 
  useBalance,
  useSwitchChain 
} from 'wagmi';
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

const MOCKUSDC_ABI = [
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
  const { switchChain } = useSwitchChain();
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  
  const { 
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
    error: writeError 
  } = useWriteContract();
  
  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
    error: txError 
  } = useWaitForTransactionReceipt({ 
    hash: txHash,
  });

  const isOnBase = chainId === baseSepolia.id;
  const isOnArbitrum = chainId === arbitrumSepolia.id;

  // Get ETH balance on Base
  const { data: baseBalance, refetch: refetchBaseBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  // Get current USDC allowance for repay
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: isOnArbitrum ? getAddress('arbitrumSepolia', 'mockUSDC') : undefined,
    abi: MOCKUSDC_ABI,
    functionName: 'allowance',
    args: address ? [address, getAddress('arbitrumSepolia', 'protocolCore')] : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled: isOnArbitrum && !!address,
    },
  });

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && txHash) {
      toast.success('✅ Transaction successful!');
      refetchBaseBalance();
      setCollateralAmount('');
      setBorrowAmount('');
      setRepayAmount('');
    }
  }, [isTxSuccess, txHash, refetchBaseBalance]);

  // Handle errors
  useEffect(() => {
    if (writeError) {
      console.error('Write error:', writeError);
      toast.error(`Transaction failed: ${writeError.shortMessage || writeError.message}`);
    }
    if (txError) {
      console.error('TX error:', txError);
      toast.error(`Transaction failed: ${txError.message}`);
    }
  }, [writeError, txError]);

  const handleDepositCollateral = async () => {
    if (!collateralAmount || !isOnBase || !address) return;
    
    const toastId = toast.loading('Preparing transaction...');
    
    try {
      const collateralValue = parseEther(collateralAmount);
      const lzFee = parseEther('0.01'); // LayerZero fee estimate
      const totalValue = collateralValue + lzFee;
      
      // Check if user has enough balance
      if (baseBalance && baseBalance.value < totalValue) {
        toast.dismiss(toastId);
        toast.error('Insufficient balance. You need extra ETH for LayerZero fees (~0.01 ETH)');
        return;
      }
      
      try {
        const hash = await writeContractAsync({
          address: getAddress('baseSepolia', 'collateralVault'),
          abi: COLLATERAL_VAULT_ABI,
          functionName: 'depositNative',
          value: totalValue,
          chainId: baseSepolia.id,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      } catch (estimationError: any) {
        console.warn('Gas estimation failed, using manual limit:', estimationError);
        toast.loading('Retrying with manual gas limit...', { id: toastId });
        
        const hash = await writeContractAsync({
          address: getAddress('baseSepolia', 'collateralVault'),
          abi: COLLATERAL_VAULT_ABI,
          functionName: 'depositNative',
          value: totalValue,
          chainId: baseSepolia.id,
          gas: 500000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Deposit collateral error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || !isOnArbitrum || !address) return;
    
    const toastId = toast.loading('Preparing transaction...');
    
    try {
      const amountBN = parseUnits(borrowAmount, 6);
      
      // Optimism Sepolia EID = 40232
      try {
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'protocolCore'),
          abi: PROTOCOL_CORE_ABI,
          functionName: 'borrowCrossChain',
          args: [amountBN, 40232, amountBN],
          value: parseEther('0.02'), // LayerZero fee for OFT transfer
          chainId: arbitrumSepolia.id,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      } catch (estimationError: any) {
        console.warn('Gas estimation failed, using manual limit:', estimationError);
        toast.loading('Retrying with manual gas limit...', { id: toastId });
        
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'protocolCore'),
          abi: PROTOCOL_CORE_ABI,
          functionName: 'borrowCrossChain',
          args: [amountBN, 40232, amountBN],
          value: parseEther('0.02'),
          chainId: arbitrumSepolia.id,
          gas: 1000000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Borrow error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleRepay = async () => {
    if (!repayAmount || !isOnArbitrum || !address) return;
    
    const toastId = toast.loading('Checking approval...');
    
    try {
      const amountBN = parseUnits(repayAmount, 6);
      const protocolCoreAddress = getAddress('arbitrumSepolia', 'protocolCore');
      
      // Check if approval is needed
      const allowance = currentAllowance || 0n;
      
      if (allowance < amountBN) {
        // Need to approve first
        toast.loading('Approving USDC... (1/2)', { id: toastId });
        
        try {
          const approveHash = await writeContractAsync({
            address: getAddress('arbitrumSepolia', 'mockUSDC'),
            abi: MOCKUSDC_ABI,
            functionName: 'approve',
            args: [protocolCoreAddress, amountBN],
            chainId: arbitrumSepolia.id,
          });
          
          toast.loading('Waiting for approval confirmation...', { id: toastId });
          
          // Wait for approval to be mined
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          toast.loading('Approval confirmed! Now repaying... (2/2)', { id: toastId });
        } catch (approveError: any) {
          // Try with manual gas
          console.warn('Approval gas estimation failed, using manual limit');
          const approveHash = await writeContractAsync({
            address: getAddress('arbitrumSepolia', 'mockUSDC'),
            abi: MOCKUSDC_ABI,
            functionName: 'approve',
            args: [protocolCoreAddress, amountBN],
            chainId: arbitrumSepolia.id,
            gas: 100000n,
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          toast.loading('Approval confirmed! Now repaying... (2/2)', { id: toastId });
        }
      } else {
        toast.loading('Repaying loan...', { id: toastId });
      }
      
      // Now repay
      try {
        const hash = await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'repay',
          args: [amountBN],
          chainId: arbitrumSepolia.id,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for repayment confirmation...', { id: hash });
      } catch (estimationError: any) {
        console.warn('Gas estimation failed, using manual limit:', estimationError);
        
        const hash = await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'repay',
          args: [amountBN],
          chainId: arbitrumSepolia.id,
          gas: 300000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for repayment confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Repay error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  if (!isConnected) {
    return null;
  }

  const formattedBaseBalance = baseBalance ? formatEther(baseBalance.value) : '0';
  const isProcessing = isWritePending || isTxLoading;

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
            1️⃣ Collateral (ETH on Base)
          </label>
          {!isOnBase && (
            <button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              className="w-full mb-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Switch to Base Sepolia
            </button>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              placeholder="0.001"
              disabled={isProcessing || !isOnBase}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleDepositCollateral}
              disabled={isProcessing || !collateralAmount || !isOnBase}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Deposit'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Includes ~0.01 ETH LayerZero fee</p>
        </div>

        {/* Borrow */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            2️⃣ Borrow (USDC to Optimism)
          </label>
          {!isOnArbitrum && (
            <button
              onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
              className="w-full mb-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Switch to Arbitrum Sepolia
            </button>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing || !isOnArbitrum}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleBorrow}
              disabled={isProcessing || !borrowAmount || !isOnArbitrum}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Borrow'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Requires 0.02 ETH for LayerZero + OFT fees</p>
        </div>

        {/* Repay */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            3️⃣ Repay (USDC on Arbitrum)
          </label>
          {!isOnArbitrum && (
            <button
              onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
              className="w-full mb-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Switch to Arbitrum Sepolia
            </button>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing || !isOnArbitrum}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleRepay}
              disabled={isProcessing || !repayAmount || !isOnArbitrum}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Repay'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Approval is automatic if needed</p>
        </div>
      </div>
    </div>
  );
}
