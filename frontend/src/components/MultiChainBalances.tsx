import { useAccount, useBalance, useReadContract } from 'wagmi';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';
import { getAddress } from '../deployments';
import { formatEther, formatUnits } from 'viem';
import BalanceCard from './BalanceCard';

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
  const { data: arbEthBalance } = useBalance({
    address,
    chainId: arbitrumSepolia.id,
  });

  const { data: arbUsdcBalance } = useReadContract({
    address: getAddress('arbitrumSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
  });

  // Base Sepolia balances
  const { data: baseEthBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  const { data: baseUsdcBalance } = useReadContract({
    address: getAddress('baseSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
  });

  // Optimism Sepolia balances
  const { data: opEthBalance } = useBalance({
    address,
    chainId: optimismSepolia.id,
  });

  const { data: opUsdcBalance } = useReadContract({
    address: getAddress('optimismSepolia', 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: optimismSepolia.id,
  });

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

