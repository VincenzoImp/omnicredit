import { useAccount, useBalance, useReadContract } from 'wagmi';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';
import { getAddress } from '../deployments';
import { formatEther, formatUnits } from 'viem';
import BalanceCard from './BalanceCard';
import { useEffect } from 'react';

const MOCKUSDC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface ChainBalance {
  chainId: number;
  chainName: string;
  nativeBalance: string;
  mockUSDCBalance: string;
}

export default function MultiChainBalances() {
  const { address, isConnected } = useAccount();

  // Arbitrum Sepolia balances
  const { data: arbEthBalance, refetch: refetchArbEth } = useBalance({
    address,
    chainId: arbitrumSepolia.id,
  });

  const { data: arbUsdcBalance, refetch: refetchArbUsdc } = useReadContract({
    address: getAddress('arbitrumSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
  });

  // Base Sepolia balances
  const { data: baseEthBalance, refetch: refetchBaseEth } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  const { data: baseUsdcBalance, refetch: refetchBaseUsdc } = useReadContract({
    address: getAddress('baseSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
  });

  // Optimism Sepolia balances
  const { data: opEthBalance, refetch: refetchOpEth } = useBalance({
    address,
    chainId: optimismSepolia.id,
  });

  const { data: opUsdcBalance, refetch: refetchOpUsdc } = useReadContract({
    address: getAddress('optimismSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: optimismSepolia.id,
  });

  // Auto-refresh balances every 10 seconds
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      refetchArbEth();
      refetchArbUsdc();
      refetchBaseEth();
      refetchBaseUsdc();
      refetchOpEth();
      refetchOpUsdc();
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected, refetchArbEth, refetchArbUsdc, refetchBaseEth, refetchBaseUsdc, refetchOpEth, refetchOpUsdc]);

  if (!isConnected) {
    return (
      <div className="text-center text-white text-xl py-12">
        Connect your wallet to see balances across all chains
      </div>
    );
  }

  const balances: ChainBalance[] = [
    {
      chainId: arbitrumSepolia.id,
      chainName: 'Arbitrum Sepolia',
      nativeBalance: arbEthBalance ? formatEther(arbEthBalance.value) : '0',
      mockUSDCBalance: arbUsdcBalance ? formatUnits(arbUsdcBalance, 6) : '0',
    },
    {
      chainId: baseSepolia.id,
      chainName: 'Base Sepolia',
      nativeBalance: baseEthBalance ? formatEther(baseEthBalance.value) : '0',
      mockUSDCBalance: baseUsdcBalance ? formatUnits(baseUsdcBalance, 6) : '0',
    },
    {
      chainId: optimismSepolia.id,
      chainName: 'Optimism Sepolia',
      nativeBalance: opEthBalance ? formatEther(opEthBalance.value) : '0',
      mockUSDCBalance: opUsdcBalance ? formatUnits(opUsdcBalance, 6) : '0',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {balances.map((balance) => (
        <BalanceCard key={balance.chainId} {...balance} />
      ))}
    </div>
  );
}

