interface BalanceCardProps {
  chainName: string;
  nativeBalance: string;
  mockUSDCBalance: string;
}

export default function BalanceCard({
  chainName,
  nativeBalance,
  mockUSDCBalance,
}: BalanceCardProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
      <h3 className="text-2xl font-bold text-white mb-4">{chainName}</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white/80 text-sm">Native ETH</span>
          <span className="text-white font-mono text-lg">
            {parseFloat(nativeBalance).toFixed(4)} ETH
          </span>
        </div>
        
        <div className="h-px bg-white/20"></div>
        
        <div className="flex justify-between items-center">
          <span className="text-white/80 text-sm">MockUSDC</span>
          <span className="text-white font-mono text-lg">
            {parseFloat(mockUSDCBalance).toFixed(2)} USDC
          </span>
        </div>
      </div>
    </div>
  );
}

