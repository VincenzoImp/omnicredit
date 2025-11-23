import { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useBalance,
  useReadContract,
  useSwitchChain,
  useChainId
} from 'wagmi';
import { parseEther, parseUnits, formatEther, formatUnits } from 'viem';
import { getAddress } from '../deployments';
import type { DeploymentAddresses } from '../deployments';
import toast from 'react-hot-toast';

import { COLLATERAL_VAULT_ABI, MOCKUSDC_ABI, PROTOCOL_CORE_ABI } from '../abis';

interface BorrowerPanelProps {
  selectedChainId: number;
  selectedChainName: string;
}

// LayerZero Endpoint IDs
const CHAIN_EIDS = {
  arbitrumSepolia: 40231,
  baseSepolia: 40245,
  optimismSepolia: 40232,
};

export default function BorrowerPanel({
  selectedChainId,
  selectedChainName,
}: BorrowerPanelProps) {
  const { address, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
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
    isError: isTxError,
    error: txError
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

  // Get total collateral value (USD) from ProtocolCore
  const { data: collateralValueUSD, refetch: refetchCollateralValue } = useReadContract({
    address: protocolCoreAddress,
    abi: PROTOCOL_CORE_ABI,
    functionName: 'getBorrowerCollateralValue',
    args: address ? [address] : undefined,
    chainId: 421614,
    query: { enabled: !!address && !!protocolCoreAddress },
  });

  useEffect(() => {
    if (isTxSuccess) {
      if (chainKey === 'arbitrumSepolia') {
        toast.success('✅ Transaction successful!');
      } else {
        toast.success('✅ Cross-chain transaction sent!');
        toast('⏳ Assets will arrive on Arbitrum in ~2 mins', {
          icon: '🚚',
          duration: 8000,
        });
      }
      refetchBalance();
      refetchAllowance();
      refetchLoan();
      refetchCollateralValue();
      setCollateralAmount('');
      setBorrowAmount('');
      setRepayAmount('');
    }
    if (isTxError) {
      toast.error(`Transaction failed: ${txError?.message || 'Unknown error'}`);
    }
  }, [isTxSuccess, isTxError, refetchBalance, refetchAllowance, refetchLoan, refetchCollateralValue, chainKey, txError]);

  const handleDepositCollateral = async () => {
    if (!collateralAmount || !address || !collateralVaultAddress) return;

    // Ensure we are on the selected chain
    if (currentChainId !== selectedChainId) {
      try {
        await switchChainAsync({ chainId: selectedChainId });
      } catch (error) {
        toast.error(`Please switch to ${selectedChainName} to deposit collateral`);
        return;
      }
    }
    
    const toastId = toast.loading('Depositing collateral...');
    
    try {
      const collateralValue = parseEther(collateralAmount);
      const lzFee = parseEther('0.002'); // Reduced estimation for LayerZero fees
      const totalValue = collateralValue + lzFee;
      
      if (ethBalance && ethBalance.value < totalValue) {
        toast.dismiss(toastId);
        toast.error('Insufficient balance. Need ~0.002 ETH extra for LayerZero fees');
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
    
    // Ensure we are on Arbitrum Sepolia
    if (currentChainId !== 421614) {
      try {
        await switchChainAsync({ chainId: 421614 });
      } catch (error) {
        toast.error('Please switch to Arbitrum Sepolia to borrow');
        return;
      }
    }

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
          value: parseEther('0.002'),
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
          value: parseEther('0.002'),
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

    // Ensure we are on Arbitrum Sepolia
    if (currentChainId !== 421614) {
      try {
        await switchChainAsync({ chainId: 421614 });
      } catch (error) {
        toast.error('Please switch to Arbitrum Sepolia to repay');
        return;
      }
    }
    
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
  const formattedCollateralValue = collateralValueUSD ? formatUnits(collateralValueUSD, 6) : '0';

  const handleDepositAndBorrow = async () => {
    if (!collateralAmount || !borrowAmount || !address || !collateralVaultAddress) return;

    if (isArbitrum) {
        toast.error("One-Click Borrow is only available on Satellite Chains (Base, Optimism). On Arbitrum, please Deposit then Borrow.");
        return;
    }

    // Ensure we are on the selected chain
    if (currentChainId !== selectedChainId) {
      try {
        await switchChainAsync({ chainId: selectedChainId });
      } catch (error) {
        toast.error(`Please switch to ${selectedChainName} to deposit collateral`);
        return;
      }
    }

    const toastId = toast.loading('Executing One-Click Borrow...');

    try {
      const collateralValue = parseEther(collateralAmount);
      const borrowAmountBN = parseUnits(borrowAmount, 6);
      // Fee is higher because it sends 2 messages (Deposit + Borrow) + OFT bridging
      const lzFee = parseEther('0.005'); 
      const totalValue = collateralValue + lzFee;
      const dstEid = CHAIN_EIDS[destinationChain]; // Where to receive funds

      if (ethBalance && ethBalance.value < totalValue) {
        toast.dismiss(toastId);
        toast.error('Insufficient balance. Need ~0.005 ETH extra for LayerZero fees');
        return;
      }

      await writeContractAsync({
        address: collateralVaultAddress,
        abi: COLLATERAL_VAULT_ABI,
        functionName: 'depositNativeAndBorrow',
        args: [borrowAmountBN, dstEid, borrowAmountBN], // minAmountLD = borrowAmount (no slippage for mock)
        value: totalValue,
        chainId: selectedChainId,
      });
      toast.dismiss(toastId);
      toast.success(`One-Click Borrow sent! USDC will arrive on ${destinationChain.replace('Sepolia', '')} in ~2 mins`);

    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(error.shortMessage || error.message || 'Transaction failed');
    }
  };

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

      {!isArbitrum ? (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl border border-purple-500/30">
            <h3 className="text-xl font-bold text-white mb-2">⚡ One-Click Borrow</h3>
            <p className="text-white/70 text-sm mb-4">Deposit ETH and Borrow USDC in a single transaction!</p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-white/80 text-sm mb-1">Deposit Collateral (ETH)</label>
                    <input
                        type="number"
                        value={collateralAmount}
                        onChange={(e) => setCollateralAmount(e.target.value)}
                        placeholder="0.01"
                        className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    />
                </div>
                <div>
                    <label className="block text-white/80 text-sm mb-1">Borrow USDC</label>
                    <input
                        type="number"
                        value={borrowAmount}
                        onChange={(e) => setBorrowAmount(e.target.value)}
                        placeholder="10.00"
                        className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    />
                </div>
                <div>
                    <label className="block text-white/80 text-sm mb-1">Receive on</label>
                    <select 
                        value={destinationChain}
                        onChange={(e) => setDestinationChain(e.target.value as any)}
                        className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    >
                        <option value="arbitrumSepolia">Arbitrum Sepolia</option>
                        <option value="baseSepolia">Base Sepolia</option>
                        <option value="optimismSepolia">Optimism Sepolia</option>
                    </select>
                </div>
                
                <button
                    onClick={handleDepositAndBorrow}
                    disabled={isProcessing || !collateralAmount || !borrowAmount}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-lg font-bold text-white transition-all"
                >
                    {isProcessing ? '⏳ Processing...' : '🚀 Deposit & Borrow'}
                </button>
                <p className="text-center text-white/40 text-xs">Includes ~0.005 ETH LayerZero Fee</p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/20">
                <h3 className="text-lg font-bold text-white mb-4">Advanced Actions</h3>
                <div className="space-y-6">
                    {/* Manual Deposit (Standard) */}
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Manual Collateral Deposit (ETH)
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
                          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
                        >
                          {isProcessing ? '⏳' : 'Deposit Only'}
                        </button>
                      </div>
                    </div>
                </div>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
        
        {/* Arbitrum Info Message */}
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
            <p className="text-blue-200 text-sm">
                ℹ️ <strong>Collateral Management:</strong> Please switch to a Satellite Chain (Base, Optimism) to deposit collateral.
            </p>
        </div>

        {/* Borrow with Destination Selector */}
        <div>
          <label className="block text-white font-semibold mb-2">
            1️⃣ Borrow USDC
          </label>
          
          <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-3 mb-3">
            <p className="text-purple-200 text-sm">
              Available Collateral (on Hub): <span className="font-bold">${parseFloat(formattedCollateralValue).toFixed(2)}</span>
            </p>
            <p className="text-purple-200 text-xs mt-1">
               (Deposits from satellite chains may take 1-2 mins to appear here)
            </p>
          </div>

          {/* Destination Chain Selector */}
          <div className="mb-3">
            <p className="text-white/80 text-sm mb-2">Receive USDC on:</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDestinationChain('arbitrumSepolia')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'arbitrumSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                }`}
              >
                Arbitrum
              </button>
              <button
                onClick={() => setDestinationChain('baseSepolia')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'baseSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                }`}
              >
                Base
              </button>
              <button
                onClick={() => setDestinationChain('optimismSepolia')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  destinationChain === 'optimismSepolia'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white/60 hover:bg-white/30'
                }`}
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
              disabled={isProcessing || !borrowAmount}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Borrow'}
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">Requires 0.002 ETH for LayerZero + OFT fees</p>
        </div>

        {/* Repay */}
        <div>
          <label className="block text-white font-semibold mb-2">
            2️⃣ Repay Loan
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
              disabled={isProcessing || !repayAmount || !hasActiveLoan}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isProcessing ? '⏳' : 'Repay'}
            </button>
          </div>
          <div className="text-white/50 text-xs mt-1 space-y-1">
            <p>Approval is automatic if needed</p>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
