import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useReadContract,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getAddress } from '../deployments';
import toast from 'react-hot-toast';

interface ImprovedLenderPanelProps {
  selectedChainId: number;
  selectedChainName: string;
}

const MOCKUSDC_ABI = [
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
] as const;

const PROTOCOL_CORE_ABI = [
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
    inputs: [{ name: 'user', type: 'address' }],
    name: 'shares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default function ImprovedLenderPanel({
  selectedChainId,
  selectedChainName,
}: ImprovedLenderPanelProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'mint' | 'deposit' | 'withdraw'>('mint');
  
  const { 
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
  } = useWriteContract();
  
  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const chainKey = selectedChainName.toLowerCase().replace(' ', '') as 'arbitrumsepolia' | 'basesepolia' | 'optimismsepolia';
  const isArbitrum = chainKey === 'arbitrumsepolia';

  // Get addresses
  const mockUSDCAddress = getAddress(chainKey, 'mockUSDC');
  const protocolCoreAddress = isArbitrum ? getAddress('arbitrumSepolia', 'protocolCore') : undefined;

  // Get current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: mockUSDCAddress,
    abi: MOCKUSDC_ABI,
    functionName: 'allowance',
    args: address && protocolCoreAddress ? [address, protocolCoreAddress] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address && isArbitrum && !!mockUSDCAddress && !!protocolCoreAddress },
  });

  // Get user shares
  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: protocolCoreAddress,
    abi: PROTOCOL_CORE_ABI,
    functionName: 'shares',
    args: address ? [address] : undefined,
    chainId: 421614,
    query: { enabled: !!address && isArbitrum && !!protocolCoreAddress },
  });

  useEffect(() => {
    if (isTxSuccess) {
      toast.success('✅ Transaction successful!');
      refetchAllowance();
      refetchShares();
      setAmount('');
    }
  }, [isTxSuccess, refetchAllowance, refetchShares]);

  const handleMint = async () => {
    if (!amount || !address || !mockUSDCAddress) return;
    
    const toastId = toast.loading('Minting MockUSDC...');
    
    try {
      const amountBN = parseUnits(amount, 6);
      
      try {
        await writeContractAsync({
          address: mockUSDCAddress,
          abi: MOCKUSDC_ABI,
          functionName: 'mint',
          args: [address, amountBN],
          chainId: selectedChainId,
        });
        toast.dismiss(toastId);
      } catch (estimationError: any) {
        await writeContractAsync({
          address: mockUSDCAddress,
          abi: MOCKUSDC_ABI,
          functionName: 'mint',
          args: [address, amountBN],
          chainId: selectedChainId,
          gas: 200000n,
        });
        toast.dismiss(toastId);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleDeposit = async () => {
    if (!amount || !address || !isArbitrum || !protocolCoreAddress || !mockUSDCAddress) return;
    
    const toastId = toast.loading('Checking approval...');
    
    try {
      const amountBN = parseUnits(amount, 6);
      
      // Check if approval is needed
      const allowance = currentAllowance || 0n;
      
      if (allowance < amountBN) {
        toast.loading('Approving USDC... (1/2)', { id: toastId });
        
        try {
          await writeContractAsync({
            address: mockUSDCAddress,
            abi: MOCKUSDC_ABI,
            functionName: 'approve',
            args: [protocolCoreAddress, amountBN],
            chainId: 421614,
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          toast.loading('Depositing... (2/2)', { id: toastId });
        } catch {
          await writeContractAsync({
            address: mockUSDCAddress,
            abi: MOCKUSDC_ABI,
            functionName: 'approve',
            args: [protocolCoreAddress, amountBN],
            chainId: 421614,
            gas: 100000n,
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          toast.loading('Depositing... (2/2)', { id: toastId });
        }
      } else {
        toast.loading('Depositing USDC...', { id: toastId });
      }
      
      // Deposit
      try {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'deposit',
          args: [amountBN],
          chainId: 421614,
        });
        toast.dismiss(toastId);
      } catch {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'deposit',
          args: [amountBN],
          chainId: 421614,
          gas: 300000n,
        });
        toast.dismiss(toastId);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleWithdraw = async () => {
    if (!amount || !address || !isArbitrum || !protocolCoreAddress) return;
    
    const toastId = toast.loading('Withdrawing...');
    
    try {
      const shareAmount = parseUnits(amount, 6);
      
      try {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'withdraw',
          args: [shareAmount],
          chainId: 421614,
        });
        toast.dismiss(toastId);
      } catch {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'withdraw',
          args: [shareAmount],
          chainId: 421614,
          gas: 300000n,
        });
        toast.dismiss(toastId);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleAction = () => {
    if (action === 'mint') handleMint();
    else if (action === 'deposit') handleDeposit();
    else if (action === 'withdraw') handleWithdraw();
  };

  if (!isConnected) {
    return null;
  }

  const isProcessing = isWritePending || isTxLoading;
  const formattedShares = userShares ? formatUnits(userShares, 6) : '0';

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">💰 Lender Actions</h2>
      
      <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
        <p className="text-blue-200 text-sm">
          📍 Selected Chain: <span className="font-bold">{selectedChainName}</span>
        </p>
        {isArbitrum && (
          <p className="text-blue-200 text-xs mt-1">
            Your Shares: <span className="font-bold">{parseFloat(formattedShares).toFixed(2)}</span>
          </p>
        )}
      </div>

      {!isArbitrum && action !== 'mint' && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-xs">
            ⚠️ Deposit and Withdraw only available on Arbitrum Sepolia
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        {/* Action Selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setAction('mint')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              action === 'mint'
                ? 'bg-green-500 text-white'
                : 'bg-white/20 text-white/60 hover:bg-white/30'
            }`}
          >
            Mint
          </button>
          <button
            onClick={() => setAction('deposit')}
            disabled={!isArbitrum}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              action === 'deposit'
                ? 'bg-purple-500 text-white'
                : 'bg-white/20 text-white/60 hover:bg-white/30 disabled:opacity-50'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => setAction('withdraw')}
            disabled={!isArbitrum}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              action === 'withdraw'
                ? 'bg-orange-500 text-white'
                : 'bg-white/20 text-white/60 hover:bg-white/30 disabled:opacity-50'
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-white/80 text-sm mb-2">
            {action === 'withdraw' ? 'Shares to Withdraw' : 'Amount (USDC)'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={action === 'withdraw' ? '10.00' : '100.00'}
            disabled={isProcessing}
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
          />
        </div>

        {/* Execute Button */}
        <button
          onClick={handleAction}
          disabled={isProcessing || !amount || (action !== 'mint' && !isArbitrum)}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all transform hover:scale-105"
        >
          {isProcessing ? '⏳ Processing...' : `${action.charAt(0).toUpperCase() + action.slice(1)} USDC`}
        </button>

        {/* Instructions */}
        <div className="text-white/60 text-xs mt-4 space-y-1">
          {action === 'mint' && (
            <>
              <p>🎁 Mint free MockUSDC on {selectedChainName}</p>
              <p>💡 Available on all chains for testing</p>
            </>
          )}
          {action === 'deposit' && (
            <>
              <p>💰 Deposit USDC to earn yield</p>
              <p>💡 Approval is automatic if needed</p>
              <p>📊 Receive shares representing your deposit</p>
            </>
          )}
          {action === 'withdraw' && (
            <>
              <p>💸 Withdraw your USDC by burning shares</p>
              <p>💡 You'll receive USDC + earned interest</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

