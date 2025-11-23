import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSwitchChain } from 'wagmi';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';
import ImprovedBalanceCard from './ImprovedBalanceCard';
import ImprovedLenderPanel from './ImprovedLenderPanel';
import ImprovedBorrowerPanel from './ImprovedBorrowerPanel';

const CHAINS = [
  { id: arbitrumSepolia.id, name: 'Arbitrum Sepolia' },
  { id: baseSepolia.id, name: 'Base Sepolia' },
  { id: optimismSepolia.id, name: 'Optimism Sepolia' },
];

export default function ImprovedDashboard() {
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = useState<number>(arbitrumSepolia.id);
  const [selectedChainName, setSelectedChainName] = useState<string>('Arbitrum Sepolia');

  console.log('🎨 ImprovedDashboard rendering, isConnected:', isConnected);

  const handleChainSelect = (chainId: number, chainName: string) => {
    setSelectedChainId(chainId);
    setSelectedChainName(chainName);
    // Also switch the wallet to this chain
    if (switchChain) {
      switchChain({ chainId });
    }
  };

  return (
    <div className="min-h-screen p-8">
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">
              OmniCredit Protocol
            </h1>
            <p className="text-white/60 text-sm">
              Omnichain Lending & Borrowing Powered by LayerZero
            </p>
          </div>
          <ConnectButton />
        </div>

        {isConnected ? (
          <>
            {/* Chain Selection Info */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm mb-1">Currently Selected Chain for Actions:</p>
                  <p className="text-white text-2xl font-bold">{selectedChainName}</p>
                </div>
                <div className="text-white/60 text-sm text-right">
                  <p>💡 Click on a balance card below to select a chain</p>
                  <p>Your wallet will automatically switch</p>
                </div>
              </div>
            </div>

            {/* Balance Cards - Click to Select Chain */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                📊 Your Balances Across All Chains
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {CHAINS.map((chain) => (
                  <ImprovedBalanceCard
                    key={chain.id}
                    chainId={chain.id}
                    chainName={chain.name}
                    isSelected={selectedChainId === chain.id}
                    onSelect={() => handleChainSelect(chain.id, chain.name)}
                  />
                ))}
              </div>
              <p className="text-white/60 text-sm mt-4 text-center">
                👆 Click on a card to select that chain for your next action
              </p>
            </div>

            {/* Action Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ImprovedLenderPanel
                selectedChainId={selectedChainId}
                selectedChainName={selectedChainName}
              />
              <ImprovedBorrowerPanel
                selectedChainId={selectedChainId}
                selectedChainName={selectedChainName}
              />
            </div>

            {/* Instructions */}
            <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">📖 How to Use</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white/80 text-sm">
                <div>
                  <h4 className="font-semibold text-white mb-2">💰 For Lenders:</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Select any chain by clicking its balance card</li>
                    <li>Mint MockUSDC on that chain (testnet only)</li>
                    <li>Switch to Arbitrum Sepolia</li>
                    <li>Deposit USDC to start earning yield</li>
                    <li>Withdraw anytime by burning shares</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">🏦 For Borrowers:</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Select any chain and deposit ETH as collateral</li>
                    <li>Switch to Arbitrum Sepolia</li>
                    <li>Choose destination chain for your loan</li>
                    <li>Borrow USDC (arrives on selected chain in 1-2 min)</li>
                    <li>Repay on Arbitrum when ready</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 inline-block">
              <h2 className="text-3xl font-bold text-white mb-4">
                Welcome to OmniCredit
              </h2>
              <p className="text-white/80 mb-6">
                Connect your wallet to start lending or borrowing across multiple chains
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

