import { useSwitchChain, useChainId } from 'wagmi';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';

interface ChainSwitcherProps {
  requiredChainId: number;
  chainName: string;
  children: React.ReactNode;
  onCorrectChain?: () => void;
}

export default function ChainSwitcher({ 
  requiredChainId, 
  chainName, 
  children,
  onCorrectChain 
}: ChainSwitcherProps) {
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectChain = currentChainId === requiredChainId;

  if (!isCorrectChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: requiredChainId })}
        className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
      >
        Switch to {chainName}
      </button>
    );
  }

  return <>{children}</>;
}

export function useRequireChain(chainId: number) {
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectChain = currentChainId === chainId;

  return {
    isCorrectChain,
    switchToChain: () => switchChain({ chainId }),
  };
}

