import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrumSepolia, baseSepolia, optimismSepolia } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'OmniCredit Protocol',
  projectId: '8c3b8e8e8f8e8e8e8e8e8e8e8e8e8e8e', // Public project ID for testing
  chains: [arbitrumSepolia, baseSepolia, optimismSepolia],
  transports: {
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
    [optimismSepolia.id]: http('https://sepolia.optimism.io'),
  },
  ssr: false,
});

