import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useChainId, 
  useReadContract,
  useSwitchChain 
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getAddress } from '../deployments';
import { arbitrumSepolia } from 'wagmi/chains';
import toast from 'react-hot-toast';

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
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
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
] as const;

export default function LenderPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [amount, setAmount] = useState('');
  
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

  const isOnArbitrum = chainId === arbitrumSepolia.id;

  // Get USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: isOnArbitrum ? getAddress('arbitrumSepolia', 'mockUSDC') : undefined,
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
    query: {
      enabled: isOnArbitrum && !!address,
    },
  });

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && txHash) {
      toast.success('✅ Transaction successful!');
      refetchBalance();
      setAmount('');
    }
  }, [isTxSuccess, txHash, refetchBalance]);

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

  const handleMint = async () => {
    if (!amount || !isOnArbitrum || !address) return;
    
    const toastId = toast.loading('Preparing transaction...');
    
    try {
      const amountBN = parseUnits(amount, 6);
      
      // Try with auto gas estimation first
      try {
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'mockUSDC'),
          abi: MOCKUSDC_ABI,
          functionName: 'mint',
          args: [address, amountBN],
          chainId: arbitrumSepolia.id,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      } catch (estimationError: any) {
        // If estimation fails, retry with manual gas limit
        console.warn('Gas estimation failed, using manual limit:', estimationError);
        toast.loading('Retrying with manual gas limit...', { id: toastId });
        
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'mockUSDC'),
          abi: MOCKUSDC_ABI,
          functionName: 'mint',
          args: [address, amountBN],
          chainId: arbitrumSepolia.id,
          gas: 200000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Mint error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleApprove = async () => {
    if (!amount || !isOnArbitrum || !address) return;
    
    const toastId = toast.loading('Preparing transaction...');
    
    try {
      const amountBN = parseUnits(amount, 6);
      
      try {
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'mockUSDC'),
          abi: MOCKUSDC_ABI,
          functionName: 'approve',
          args: [getAddress('arbitrumSepolia', 'protocolCore'), amountBN],
          chainId: arbitrumSepolia.id,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      } catch (estimationError: any) {
        console.warn('Gas estimation failed, using manual limit:', estimationError);
        toast.loading('Retrying with manual gas limit...', { id: toastId });
        
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'mockUSDC'),
          abi: MOCKUSDC_ABI,
          functionName: 'approve',
          args: [getAddress('arbitrumSepolia', 'protocolCore'), amountBN],
          chainId: arbitrumSepolia.id,
          gas: 100000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Approve error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleDeposit = async () => {
    if (!amount || !isOnArbitrum || !address) return;
    
    const toastId = toast.loading('Preparing transaction...');
    
    try {
      const amountBN = parseUnits(amount, 6);
      
      try {
        const hash = await writeContractAsync({
          address: getAddress('arbitrumSepolia', 'protocolCore'),
          abi: PROTOCOL_CORE_ABI,
          functionName: 'deposit',
          args: [amountBN],
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
          functionName: 'deposit',
          args: [amountBN],
          chainId: arbitrumSepolia.id,
          gas: 300000n,
        });
        
        toast.dismiss(toastId);
        toast.loading('Waiting for confirmation...', { id: hash });
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Deposit error:', error);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleSwitchChain = () => {
    switchChain({ chainId: arbitrumSepolia.id });
  };

  if (!isConnected) {
    return null;
  }

  const formattedBalance = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const isProcessing = isWritePending || isTxLoading;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">💰 Lender Actions</h2>
      
      {!isOnArbitrum ? (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
          <p className="text-yellow-200 text-sm mb-3">
            ⚠️ Please switch to Arbitrum Sepolia to use lender features
          </p>
          <button
            onClick={handleSwitchChain}
            className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
          >
            Switch to Arbitrum Sepolia
          </button>
        </div>
      ) : (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
          <p className="text-blue-200 text-sm">
            💵 Your Balance: <span className="font-bold">{parseFloat(formattedBalance).toFixed(2)} USDC</span>
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-white/80 text-sm mb-2">Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            disabled={isProcessing || !isOnArbitrum}
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleMint}
            disabled={isProcessing || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isProcessing ? '⏳' : 'Mint'}
          </button>
          
          <button
            onClick={handleApprove}
            disabled={isProcessing || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isProcessing ? '⏳' : 'Approve'}
          </button>
          
          <button
            onClick={handleDeposit}
            disabled={isProcessing || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isProcessing ? '⏳' : 'Deposit'}
          </button>
        </div>

        <div className="text-white/60 text-xs mt-4 space-y-1">
          <p>1️⃣ Mint free MockUSDC (testnet only)</p>
          <p>2️⃣ Approve ProtocolCore to spend your USDC</p>
          <p>3️⃣ Deposit USDC to start earning yield</p>
        </div>
      </div>
    </div>
  );
}
