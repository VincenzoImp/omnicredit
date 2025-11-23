import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import { getAddress } from '../deployments';
import { arbitrumSepolia } from 'wagmi/chains';

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
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState('');
  
  const { writeContract: mint, data: mintHash } = useWriteContract();
  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { writeContract: deposit, data: depositHash } = useWriteContract();
  
  const { isLoading: isMinting } = useWaitForTransactionReceipt({ hash: mintHash });
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositHash });

  const isOnArbitrum = chainId === arbitrumSepolia.id;

  const handleMint = async () => {
    if (!amount) return;
    try {
      mint({
        address: getAddress('arbitrumSepolia', 'mockUSDC'),
        abi: MOCKUSDC_ABI,
        functionName: 'mint',
        args: [parseUnits(amount, 6)],
        chainId: arbitrumSepolia.id,
        gas: 200000n,
      });
    } catch (error) {
      console.error('Mint error:', error);
      alert('Transaction failed. Check console for details.');
    }
  };

  const handleApprove = async () => {
    if (!amount) return;
    try {
      approve({
        address: getAddress('arbitrumSepolia', 'mockUSDC'),
        abi: MOCKUSDC_ABI,
        functionName: 'approve',
        args: [getAddress('arbitrumSepolia', 'protocolCore'), parseUnits(amount, 6)],
        chainId: arbitrumSepolia.id,
        gas: 100000n,
      });
    } catch (error) {
      console.error('Approve error:', error);
      alert('Transaction failed. Check console for details.');
    }
  };

  const handleDeposit = async () => {
    if (!amount) return;
    try {
      deposit({
        address: getAddress('arbitrumSepolia', 'protocolCore'),
        abi: PROTOCOL_CORE_ABI,
        functionName: 'deposit',
        args: [parseUnits(amount, 6)],
        chainId: arbitrumSepolia.id,
        gas: 300000n,
      });
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Transaction failed. Make sure you have approved USDC first.');
    }
  };

  if (!isConnected) {
    return null;
  }

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
      
      <div className="space-y-4">
        <div>
          <label className="block text-white/80 text-sm mb-2">Amount (USDC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleMint}
            disabled={isMinting || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
          >
            {isMinting ? 'Minting...' : 'Mint'}
          </button>
          
          <button
            onClick={handleApprove}
            disabled={isApproving || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
          
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !amount || !isOnArbitrum}
            className="px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
          >
            {isDepositing ? 'Depositing...' : 'Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}

