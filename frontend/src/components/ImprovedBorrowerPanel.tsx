import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useBalance,
  useReadContract
} from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { getAddress, DeploymentAddresses } from '../deployments';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';
import toast from 'react-hot-toast';

interface ImprovedBorrowerPanelProps {
  selectedChainId: number;
  selectedChainName: string;
}

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
] as const;

// LayerZero Endpoint IDs
const CHAIN_EIDS = {
  arbitrumSepolia: 40231,
  baseSepolia: 40245,
  optimismSepolia: 40232,
};

export default function ImprovedBorrowerPanel({
  selectedChainId,
  selectedChainName,
}: ImprovedBorrowerPanelProps) {
  const { address, isConnected } = useAccount();
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState<'arbitrumSepolia' | 'baseSepolia' | 'optimismSepolia'>('optimismSepolia');
  
  const { 
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
  } = useWriteContract();
  
  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const chainKey: keyof DeploymentAddresses =
    selectedChainName.startsWith('Arbitrum') ? 'arbitrumSepolia'
    : selectedChainName.startsWith('Base') ? 'baseSepolia'
    : 'optimismSepolia';
  const isArbitrum = chainKey === 'arbitrumSepolia';

  // Get addresses
  const collateralVaultAddress = getAddress(chainKey, 'collateralVault');
  const mockUSDCAddress = isArbitrum ? getAddress('arbitrumSepolia', 'mockUSDC') : undefined;
  const protocolCoreAddress = isArbitrum ? getAddress('arbitrumSepolia', 'protocolCore') : undefined;

  // Get ETH balance on selected chain
  const { data: ethBalance, refetch: refetchBalance } = useBalance({
    address,
    chainId: selectedChainId,
  });

  // Get USDC allowance for repay
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: mockUSDCAddress,
    abi: MOCKUSDC_ABI,
    functionName: 'allowance',
    args: address && protocolCoreAddress ? [address, protocolCoreAddress] : undefined,
    chainId: 421614,
    query: { enabled: !!address && isArbitrum && !!mockUSDCAddress && !!protocolCoreAddress },
  });

  // Get loan details
  const { data: loanData, refetch: refetchLoan } = useReadContract({
    address: protocolCoreAddress,
    abi: PROTOCOL_CORE_ABI,
    functionName: 'loans',
    args: address ? [address] : undefined,
    chainId: 421614,
    query: { enabled: !!address && isArbitrum && !!protocolCoreAddress },
  });

  useEffect(() => {
    if (isTxSuccess) {
      toast.success('✅ Transaction successful!');
      refetchBalance();
      refetchAllowance();
      refetchLoan();
      setCollateralAmount('');
      setBorrowAmount('');
      setRepayAmount('');
    }
  }, [isTxSuccess, refetchBalance, refetchAllowance, refetchLoan]);

  const handleDepositCollateral = async () => {
    if (!collateralAmount || !address || !collateralVaultAddress) return;
    
    const toastId = toast.loading('Depositing collateral...');
    
    try {
      const collateralValue = parseEther(collateralAmount);
      const lzFee = parseEther('0.01');
      const totalValue = collateralValue + lzFee;
      
      if (ethBalance && ethBalance.value < totalValue) {
        toast.dismiss(toastId);
        toast.error('Insufficient balance. Need ~0.01 ETH extra for LayerZero fees');
        return;
      }
      
      try {
        await writeContractAsync({
          address: collateralVaultAddress,
          abi: COLLATERAL_VAULT_ABI,
          functionName: 'depositNative',
          value: totalValue,
          chainId: selectedChainId,
        });
        toast.dismiss(toastId);
      } catch {
        await writeContractAsync({
          address: collateralVaultAddress,
          abi: COLLATERAL_VAULT_ABI,
          functionName: 'depositNative',
          value: totalValue,
          chainId: selectedChainId,
          gas: 500000n,
        });
        toast.dismiss(toastId);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || !address || !isArbitrum || !protocolCoreAddress) return;
    
    const toastId = toast.loading('Initiating cross-chain borrow...');
    
    try {
      const amountBN = parseUnits(borrowAmount, 6);
      const dstEid = CHAIN_EIDS[destinationChain];
      
      try {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'borrowCrossChain',
          args: [amountBN, dstEid, amountBN],
          value: parseEther('0.02'),
          chainId: 421614,
        });
        toast.dismiss(toastId);
        toast.success(`USDC will arrive on ${destinationChain.replace('Sepolia', ' Sepolia')} in 1-2 minutes`);
      } catch {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'borrowCrossChain',
          args: [amountBN, dstEid, amountBN],
          value: parseEther('0.02'),
          chainId: 421614,
          gas: 1000000n,
        });
        toast.dismiss(toastId);
        toast.success(`USDC will arrive on ${destinationChain.replace('Sepolia', ' Sepolia')} in 1-2 minutes`);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  const handleRepay = async () => {
    if (!repayAmount || !address || !isArbitrum || !protocolCoreAddress || !mockUSDCAddress) return;
    
    const toastId = toast.loading('Checking approval...');
    
    try {
      const amountBN = parseUnits(repayAmount, 6);
      
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
          
          toast.loading('Repaying... (2/2)', { id: toastId });
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
          
          toast.loading('Repaying... (2/2)', { id: toastId });
        }
      } else {
        toast.loading('Repaying loan...', { id: toastId });
      }
      
      try {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'repay',
          args: [amountBN],
          chainId: 421614,
        });
        toast.dismiss(toastId);
      } catch {
        await writeContractAsync({
          address: protocolCoreAddress,
          abi: PROTOCOL_CORE_ABI,
          functionName: 'repay',
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

  if (!isConnected) {
    return null;
  }

  const isProcessing = isWritePending || isTxLoading;
  const formattedEth = ethBalance ? formatEther(ethBalance.value) : '0';
  
  const loanPrincipal = loanData && loanData[6] ? formatUnits(loanData[0], 6) : '0';
  const loanInterest = loanData && loanData[6] ? formatUnits(loanData[3], 6) : '0';
  const hasActiveLoan = loanData && loanData[6];

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
      <h2 className="text-3xl font-bold text-white mb-6">🏦 Borrower Actions</h2>
      
      <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
        <p className="text-blue-200 text-sm">
          📍 Selected Chain: <span className="font-bold">{selectedChainName}</span>
        </p>
        <p className="text-blue-200 text-xs mt-1">
          Your ETH: <span className="font-bold">{parseFloat(formattedEth).toFixed(4)}</span>
        </p>
      </div>

      {hasActiveLoan && isArbitrum && (
        <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 mb-4">
          <p className="text-orange-200 text-sm font-semibold">⚠️ Active Loan</p>
          <p className="text-orange-100 text-xs mt-1">
            Debt: {(parseFloat(loanPrincipal) + parseFloat(loanInterest)).toFixed(2)} USDC
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Deposit Collateral */}
        <div>
          <label className="block text-white font-semibold mb-2">
            1️⃣ Deposit Collateral (ETH on {selectedChainName})
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
              disabled={isProcessing || !collateralAmount}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Deposit'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Includes ~0.01 ETH LayerZero fee</p>
        </div>

        {/* Borrow with Destination Selector */}
        <div>
          <label className="block text-white font-semibold mb-2">
            2️⃣ Borrow USDC {!isArbitrum && <span className="text-yellow-400">(Switch to Arbitrum)</span>}
          </label>
          
          {/* Destination Chain Selector */}
          <div className="mb-3">
            <p className="text-white/80 text-sm mb-2">Receive USDC on:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDestinationChain('arbitrumSepolia')}
                disabled={!isArbitrum}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'arbitrumSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                } disabled:opacity-50`}
              >
                Arbitrum
              </button>
              <button
                onClick={() => setDestinationChain('baseSepolia')}
                disabled={!isArbitrum}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'baseSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                } disabled:opacity-50`}
              >
                Base
              </button>
              <button
                onClick={() => setDestinationChain('optimismSepolia')}
                disabled={!isArbitrum}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'optimismSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                } disabled:opacity-50`}
              >
                Optimism
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing || !isArbitrum}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleBorrow}
              disabled={isProcessing || !borrowAmount || !isArbitrum}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Borrow'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Requires 0.02 ETH for LayerZero + OFT fees</p>
        </div>

        {/* Repay */}
        <div>
          <label className="block text-white font-semibold mb-2">
            3️⃣ Repay Loan {!isArbitrum && <span className="text-yellow-400">(Switch to Arbitrum)</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="10.00"
              disabled={isProcessing || !isArbitrum}
              className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleRepay}
              disabled={isProcessing || !repayAmount || !isArbitrum || !hasActiveLoan}
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

