import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatEther, formatUnits } from 'viem';
import { getAddress } from '../deployments';

interface ImprovedBalanceCardProps {
  chainId: number;
  chainName: string;
  isSelected: boolean;
  onSelect: () => void;
}

const MOCKUSDC_ABI = [
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
    inputs: [{ name: 'user', type: 'address' }],
    name: 'shares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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

export default function ImprovedBalanceCard({
  chainId,
  chainName,
  isSelected,
  onSelect,
}: ImprovedBalanceCardProps) {
  const { address } = useAccount();
  
  const chainKey = chainName.toLowerCase().replace(' ', '') as 'arbitrumsepolia' | 'basesepolia' | 'optimismsepolia';

  // Get native ETH balance
  const { data: ethBalance } = useBalance({
    address,
    chainId,
  });

  // Get MockUSDC balance
  const { data: usdcBalance } = useReadContract({
    address: getAddress(chainKey, 'mockUSDC'),
    abi: MOCKUSDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  // Get lending shares (only on Arbitrum)
  const { data: lendingShares } = useReadContract({
    address: chainKey === 'arbitrumsepolia' ? getAddress('arbitrumSepolia', 'protocolCore') : undefined,
    abi: PROTOCOL_CORE_ABI,
    functionName: 'shares',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    query: { enabled: !!address && chainKey === 'arbitrumsepolia' },
  });

  // Get loan details (only on Arbitrum)
  const { data: loanData } = useReadContract({
    address: chainKey === 'arbitrumsepolia' ? getAddress('arbitrumSepolia', 'protocolCore') : undefined,
    abi: PROTOCOL_CORE_ABI,
    functionName: 'loans',
    args: address ? [address] : undefined,
    chainId: 421614, // Arbitrum Sepolia
    query: { enabled: !!address && chainKey === 'arbitrumsepolia' },
  });

  const formattedEth = ethBalance ? formatEther(ethBalance.value) : '0';
  const formattedUsdc = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const formattedShares = lendingShares ? formatUnits(lendingShares, 6) : '0';
  
  const loanPrincipal = loanData && loanData[6] ? formatUnits(loanData[0], 6) : '0'; // isActive check
  const loanInterest = loanData && loanData[6] ? formatUnits(loanData[3], 6) : '0';
  const hasActiveLoan = loanData && loanData[6];

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer transition-all duration-300 rounded-2xl p-6 border-2 ${
        isSelected
          ? 'bg-white/20 border-white shadow-2xl scale-105'
          : 'bg-white/10 border-white/20 shadow-xl hover:bg-white/15'
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">{chainName}</h3>
        {isSelected && (
          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
            SELECTED
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Wallet Balances */}
        <div className="bg-white/10 rounded-lg p-3">
          <p className="text-white/60 text-xs mb-2 font-semibold">💼 Wallet</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-white/80 text-sm">ETH</span>
              <span className="text-white font-mono text-sm">
                {parseFloat(formattedEth).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/80 text-sm">USDC</span>
              <span className="text-white font-mono text-sm">
                {parseFloat(formattedUsdc).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Lending Position (only Arbitrum) */}
        {chainKey === 'arbitrumsepolia' && (
          <div className="bg-green-500/20 rounded-lg p-3 border border-green-500/30">
            <p className="text-green-200 text-xs mb-2 font-semibold">💰 Lending</p>
            <div className="flex justify-between">
              <span className="text-green-100 text-sm">Shares</span>
              <span className="text-green-100 font-mono text-sm font-bold">
                {parseFloat(formattedShares).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Active Loan (only Arbitrum) */}
        {chainKey === 'arbitrumsepolia' && hasActiveLoan && (
          <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
            <p className="text-red-200 text-xs mb-2 font-semibold">🏦 Active Loan</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-red-100 text-sm">Principal</span>
                <span className="text-red-100 font-mono text-sm">
                  {parseFloat(loanPrincipal).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-100 text-sm">Interest</span>
                <span className="text-red-100 font-mono text-sm">
                  {parseFloat(loanInterest).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-red-500/30 pt-1 mt-1">
                <span className="text-red-100 text-sm font-bold">Total Debt</span>
                <span className="text-red-100 font-mono text-sm font-bold">
                  {(parseFloat(loanPrincipal) + parseFloat(loanInterest)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {chainKey === 'arbitrumsepolia' && !hasActiveLoan && (
          <div className="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
            <p className="text-blue-200 text-xs text-center">No active loan</p>
          </div>
        )}
      </div>
    </div>
  );
}

