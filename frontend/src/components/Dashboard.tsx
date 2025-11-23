import { ConnectButton } from '@rainbow-me/rainbowkit';
import MultiChainBalances from './MultiChainBalances';
import LenderPanel from './LenderPanel';
import BorrowerPanel from './BorrowerPanel';

export default function Dashboard() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-5xl font-bold text-white">
            OmniCredit Protocol
          </h1>
          <ConnectButton />
        </div>

        {/* Multi-Chain Balance Cards */}
        <MultiChainBalances />

        {/* Action Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
          <LenderPanel />
          <BorrowerPanel />
        </div>
      </div>
    </div>
  );
}

