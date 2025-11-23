import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useReadContract,
  useSwitchChain,
  useChainId
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getAddress } from '../deployments';
import type { DeploymentAddresses } from '../deployments';
import toast from 'react-hot-toast';

import { MOCKUSDC_ABI, PROTOCOL_CORE_ABI, LENDER_VAULT_ABI } from '../abis';

interface LenderPanelProps {
  selectedChainId: number;
  selectedChainName: string;
}

export default function LenderPanel({
  selectedChainId,
  selectedChainName,
}: LenderPanelProps) {
  const { address, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
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
    isError: isTxError,
    error: txError
  } = useWaitForTransactionReceipt({ hash: txHash });

  const chainKey: keyof DeploymentAddresses =
    selectedChainName.startsWith('Arbitrum') ? 'arbitrumSepolia'
    : selectedChainName.startsWith('Base') ? 'baseSepolia'
    : 'optimismSepolia';
  const isArbitrum = chainKey === 'arbitrumSepolia';

  // Get addresses
  const mockUSDCAddress = getAddress(chainKey, 'mockUSDC');
  const lenderVaultAddress = getAddress(chainKey, 'lenderVault');
  const protocolCoreAddress = isArbitrum ? getAddress('arbitrumSepolia', 'protocolCore') : undefined;

  // Get current allowance for vault or protocol core
  const spenderAddress = isArbitrum ? protocolCoreAddress : lenderVaultAddress;
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: mockUSDCAddress,
    abi: MOCKUSDC_ABI,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    chainId: selectedChainId,
    query: { enabled: !!address && !!mockUSDCAddress && !!spenderAddress },
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
      if (isArbitrum) {
        toast.success('✅ Transaction successful!');
      } else {
        // Cross-chain message
        toast.success('✅ Cross-chain transaction sent!');
        toast('⏳ Assets will arrive on Arbitrum in ~2 mins', {
          icon: '🚚',
          duration: 8000,
        });
      }
      refetchAllowance();
      refetchShares();
      setAmount('');
    }
    if (isTxError) {
      toast.error(`Transaction failed: ${txError?.message || 'Unknown error'}`);
    }
  }, [isTxSuccess, isTxError, refetchAllowance, refetchShares, isArbitrum, txError]);

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
    if (!amount || !address || !mockUSDCAddress) return;
    
    const targetAddress = isArbitrum ? protocolCoreAddress : lenderVaultAddress;
    if (!targetAddress) return;

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
            args: [targetAddress, amountBN],
            chainId: selectedChainId,
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          await refetchAllowance();
          
          toast.loading('Depositing... (2/2)', { id: toastId });
        } catch {
          // Try with higher gas limit if estimation fails
          await writeContractAsync({
            address: mockUSDCAddress,
            abi: MOCKUSDC_ABI,
            functionName: 'approve',
            args: [targetAddress, amountBN],
            chainId: selectedChainId,
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
        if (isArbitrum) {
          // Direct deposit to ProtocolCore on Arbitrum
          await writeContractAsync({
            address: protocolCoreAddress!,
            abi: PROTOCOL_CORE_ABI,
            functionName: 'deposit',
            args: [amountBN],
            chainId: 421614,
          });
        } else {
          // Cross-chain deposit via LenderVault
          // Fees are paid in native token (ETH) but here we use a simplified flow
          // In a real implementation, we would need to quote the LayerZero fee first
          // We use a safe margin for the Hackathon
          const lzFee = parseUnits('0.02', 18); // Increased from 0.01 to 0.02
          
          await writeContractAsync({
            address: lenderVaultAddress!,
            abi: LENDER_VAULT_ABI,
            functionName: 'deposit',
            args: [amountBN, amountBN], // amount, minAmountLD
            chainId: selectedChainId,
            value: lzFee, 
          });
        }
        toast.dismiss(toastId);
      } catch (error: any) {
        console.error('Deposit error:', error);
        // Fallback with gas limit
        try {
            if (isArbitrum) {
                await writeContractAsync({
                    address: protocolCoreAddress!,
                    abi: PROTOCOL_CORE_ABI,
                    functionName: 'deposit',
                    args: [amountBN],
                    chainId: 421614,
                    gas: 300000n,
                });
            } else {
                const lzFee = parseUnits('0.02', 18);
                await writeContractAsync({
                    address: lenderVaultAddress!,
                    abi: LENDER_VAULT_ABI,
                    functionName: 'deposit',
                    args: [amountBN, amountBN],
                    chainId: selectedChainId,
                    value: lzFee,
                    gas: 500000n,
                });
            }
            toast.dismiss(toastId);
        } catch (fallbackError: any) {
            throw fallbackError;
        }
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleWithdraw = async () => {
    if (!amount || !address || !protocolCoreAddress) return;
    
    // Ensure we are on Arbitrum Sepolia
    if (currentChainId !== 421614) {
      try {
        await switchChainAsync({ chainId: 421614 });
      } catch (error) {
        toast.error('Please switch to Arbitrum Sepolia to withdraw');
        return;
      }
    }

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

      {action === 'withdraw' && !isArbitrum && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-xs">
            ⚠️ You will be prompted to switch to Arbitrum Sepolia to withdraw
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
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              action === 'deposit'
                ? 'bg-purple-500 text-white'
                : 'bg-white/20 text-white/60 hover:bg-white/30'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => setAction('withdraw')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              action === 'withdraw'
                ? 'bg-orange-500 text-white'
                : 'bg-white/20 text-white/60 hover:bg-white/30'
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
          disabled={isProcessing || !amount}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all transform hover:scale-105"
        >
          {isProcessing ? '⏳ Processing...' : `${action.charAt(0).toUpperCase() + action.slice(1)} USDC`}
        </button>

        {/* Instructions */}
        <div className="text-white/60 text-xs mt-4 space-y-1">
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
              {!isArbitrum && <p className="text-yellow-200">⚠️ Note: Withdrawal requires switching to Arbitrum</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

