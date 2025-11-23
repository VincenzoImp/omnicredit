import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { getAddress } from '../deployments';
import { arbitrumSepolia } from 'wagmi/chains';
import toast from 'react-hot-toast';

const MOCKUSDC_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
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
  const [amount, setAmount] = useState('');
  
  const { writeContract: mint, data: mintHash, isPending: isMintPending } = useWriteContract();
  const { writeContract: approve, data: approveHash, isPending: isApprovePending } = useWriteContract();
  const { writeContract: deposit, data: depositHash, isPending: isDepositPending } = useWriteContract();
  
  const { isLoading: isMinting, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHash });
  const { isLoading: isApproving, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositing, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

  const isOnArbitrum = chainId === arbitrumSepolia.id;

  // Get USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: isOnArbitrum ? getAddress('arbitrumSepolia', 'mockUSDC') : undefined,
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
  });

  // Handle transaction success notifications
  useEffect(() => {
    if (isMintSuccess) {
      toast.success('✅ MockUSDC minted successfully!');
      refetchBalance();
      setAmount('');
    }
  }, [isMintSuccess, refetchBalance]);

  useEffect(() => {
    if (isApproveSuccess) {
      toast.success('✅ USDC approved successfully!');
    }
  }, [isApproveSuccess]);

  useEffect(() => {
    if (isDepositSuccess) {
      toast.success('✅ Deposit successful! You are now earning yield.');
      refetchBalance();
      setAmount('');
    }
  }, [isDepositSuccess, refetchBalance]);

  const handleMint = async () => {
    if (!amount || !isOnArbitrum) return;
    
    try {
      const amountBN = parseUnits(amount, 6);
      toast.loading('Minting MockUSDC...', { id: 'mint' });
      
      mint({
        address: getAddress('arbitrumSepolia', 'mockUSDC'),
        abi: MOCKUSDC_ABI,
        functionName: 'mint',
        args: [amountBN],
        chainId: arbitrumSepolia.id,
        gas: 200000n,
      });
      
      toast.dismiss('mint');
    } catch (error: any) {
      console.error('Mint error:', error);
      toast.error(`Mint failed: ${error.message || 'Unknown error'}`, { id: 'mint' });
    }
  };

  const handleApprove = async () => {
    if (!amount || !isOnArbitrum) return;
    
    try {
      const amountBN = parseUnits(amount, 6);
      toast.loading('Approving USDC...', { id: 'approve' });
      
      approve({
        address: getAddress('arbitrumSepolia', 'mockUSDC'),
        abi: MOCKUSDC_ABI,
        functionName: 'approve',
        args: [getAddress('arbitrumSepolia', 'protocolCore'), amountBN],
        chainId: arbitrumSepolia.id,
        gas: 100000n,
      });
      
      toast.dismiss('approve');
    } catch (error: any) {
      console.error('Approve error:', error);
      toast.error(`Approve failed: ${error.message || 'Unknown error'}`, { id: 'approve' });
    }
  };

  const handleDeposit = async () => {
    if (!amount || !isOnArbitrum) return;
    
    try {
      const amountBN = parseUnits(amount, 6);
      toast.loading('Depositing USDC...', { id: 'deposit' });
      
      deposit({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'deposit',
        args: [amountBN],
        chainId: arbitrumSepolia.id,
        gas: 300000n,
      });
      
      toast.dismiss('deposit');
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast.error(`Deposit failed: ${error.message || 'Unknown error'}`, { id: 'deposit' });
    }
  };

  if (!isConnected) {
    return null;
  }

  const formattedBalance = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const isProcessing = isMintPending || isMinting || isApprovePending || isApproving || isDepositPending || isDepositing;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">💰 Lender Actions</h2>
      
      {!isOnArbitrum && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
          <p className="text-yellow-200 text-xs">
            ⚠️ Please switch to Arbitrum Sepolia to use lender features
          </p>
        </div>
      )}

      {isOnArbitrum && (
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
            disabled={isProcessing}
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleMint}
            disabled={isMintPending || isMinting || !amount || !isOnArbitrum || isProcessing}
            className="px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isMintPending || isMinting ? 'Minting...' : 'Mint'}
          </button>
          
          <button
            onClick={handleApprove}
            disabled={isApprovePending || isApproving || !amount || !isOnArbitrum || isProcessing}
            className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isApprovePending || isApproving ? 'Approving...' : 'Approve'}
          </button>
          
          <button
            onClick={handleDeposit}
            disabled={isDepositPending || isDepositing || !amount || !isOnArbitrum || isProcessing}
            className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {isDepositPending || isDepositing ? 'Depositing...' : 'Deposit'}
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
