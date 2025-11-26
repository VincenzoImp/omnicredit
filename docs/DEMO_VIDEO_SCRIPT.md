# 🎬 OmniCredit Demo Video Script

**Target Length**: 3-5 minutes  
**Format**: Screen recording + voiceover  
**Tools**: Loom, OBS, or QuickTime + iMovie

---

## 📋 Pre-Recording Checklist

- [ ] Frontend running at http://localhost:5174
- [ ] MetaMask installed with testnet ETH on all 3 chains
- [ ] Browser console hidden (or interesting logs visible)
- [ ] Full screen browser mode
- [ ] Audio test (clear, no background noise)
- [ ] Script practiced (sounds natural, not reading)
- [ ] Screen resolution: 1920x1080 or 1280x720

---

## 🎯 Video Structure (3 minutes)

**Intro** (20 seconds) → **Problem** (30 seconds) → **Solution** (40 seconds) → **Live Demo** (90 seconds) → **Impact** (20 seconds) → **Call to Action** (20 seconds)

---

## 🎬 SCENE 1: INTRO (0:00 - 0:20)

**Visual**: GitHub repository README or landing page

**Script**:
```
Hi! I'm [Your Name], and I'm excited to show you OmniCredit—
the first omnichain lending protocol with continuous credit scoring.

We're solving three critical problems in DeFi: 
fragmented liquidity, lack of credit history, 
and collateral lock-up inefficiency.

Let me show you how it works.
```

**Tips**:
- Smile and be enthusiastic
- Speak clearly and at moderate pace
- Show GitHub star count if impressive

---

## 🎬 SCENE 2: THE PROBLEM (0:20 - 0:50)

**Visual**: Diagram or animation showing fragmented chains

**Script**:
```
Today, DeFi has over $50 billion in total value locked, 
but it's scattered across more than 100 different blockchains.

If you have ETH on Ethereum but need USDC on Arbitrum, 
you're forced to bridge your collateral—
costing time, gas fees, and creating a poor user experience.

Even worse? DeFi treats all borrowers equally.
Whether you've repaid 100 loans or zero, 
you need the same 150% collateralization.

There's no credit history, no reputation, no reward for being responsible.

That's inefficient. And we're fixing it.
```

**Visuals to Show**:
- Slide 1: "$50B+ TVL Fragmented"
- Slide 2: "No Credit History = 150% Collateral Always"
- Slide 3: "$200M+ Annual Bridging Costs"

**Tips**:
- Use animations or simple slides
- Emphasize pain points
- Keep numbers memorable

---

## 🎬 SCENE 3: THE SOLUTION (0:50 - 1:30)

**Visual**: Architecture diagram (hub-and-spoke)

**Script**:
```
OmniCredit solves this with three key innovations:

First, omnichain architecture powered by LayerZero V2.
We maintain a single liquidity pool on Arbitrum 
while allowing users to interact from any chain—
Base, Optimism, or wherever they hold assets.

Deposit collateral on Base, borrow USDC on Optimism. 
No bridging required.

Second, continuous credit scoring.
Users start with a score of zero and build up to 1,000 
by repaying loans on time.

A new user gets 60% loan-to-value ratio.
But someone with a 700 score? They get 80% LTV.
That's 33% more borrowing power, just for being responsible.

Third, anti-gaming security.
We cap your maximum borrow not just by collateral, 
but also by lifetime interest paid.
This prevents users from building high scores on tiny loans 
and then immediately defaulting on big ones.

It's mathematically impossible to profit from gaming the system.
```

**Visuals to Show**:
- Architecture diagram (hub on Arbitrum, satellites)
- Credit score formula: "0-1000 = (Interest/$10) × Streak"
- LTV chart: "0-400: 60%, 400-700: 70%, 700-1000: 80%"
- Fee-based limits formula

**Tips**:
- Use hand gestures or cursor to point at diagram
- Simplify technical concepts
- Emphasize "mathematically impossible to game"

---

## 🎬 SCENE 4: LIVE DEMO (1:30 - 3:00)

**Visual**: Frontend application with real interactions

### Part A: Lender Flow (30 seconds)

**Script**:
```
Let me show you how it works in practice.
I'm connected to Arbitrum Sepolia with MetaMask.

As a lender, I can mint some test MockUSDC here—
this is just for demo purposes, but on mainnet it would be real USDC.

[Click "Mint MockUSDC", wait for transaction]

Great, now I have 100 USDC.
I'll approve the protocol to spend it...

[Click "Approve", wait]

...and deposit 50 USDC into the lending pool.

[Click "Deposit", wait]

Perfect. You can see my shares increase here in the balance card.
These shares represent my ownership of the pool 
and will appreciate as borrowers pay interest.
```

**Actions**:
1. Show MetaMask connected to Arbitrum
2. Click "Mint MockUSDC" → Show toast notification
3. Enter "50" in approve field → Click "Approve"
4. Enter "50" in deposit field → Click "Deposit"
5. Point to updated balance showing shares

**Tips**:
- Keep cursor movements smooth
- Highlight successful transactions
- Show real-time balance updates

### Part B: Borrower Flow (60 seconds)

**Script**:
```
Now let's be a borrower.
I'll switch to Base Sepolia and deposit some ETH as collateral.

[Use chain switcher, select Base Sepolia]

On Base, I can deposit native ETH directly.
Let me deposit 0.001 ETH—about $3 worth.

[Enter "0.001", click "Deposit Collateral"]

This sends a LayerZero message to the hub contract on Arbitrum,
updating my collateral balance there.

[Wait ~10 seconds, show loading state]

Great. Now let's borrow some USDC.
I'll switch back to Arbitrum and request a cross-chain loan.

[Switch to Arbitrum Sepolia]

I want to borrow 20 USDC... 
but here's the cool part—I can receive it on Optimism.

[Select Optimism in destination dropdown]
[Enter "20" in borrow amount]
[Click "Borrow Cross-Chain"]

This transaction does several things:
- Checks my credit score (currently zero, so 60% LTV)
- Validates my collateral
- Records the loan on Arbitrum
- Bridges USDC via LayerZero OFT to Optimism

[Wait for confirmation]

Now watch what happens when I switch to Optimism...

[Switch to Optimism Sepolia]
[Wait for balance to update]

There it is! 20 USDC arrived on Optimism,
even though my collateral is on Base 
and the loan is recorded on Arbitrum.

That's the power of omnichain infrastructure.
```

**Actions**:
1. Switch to Base Sepolia
2. Show ETH balance
3. Deposit 0.001 ETH as collateral
4. Show loading/toast notifications
5. Switch to Arbitrum
6. Show borrow panel with destination chain selector
7. Select Optimism, enter 20 USDC
8. Click "Borrow Cross-Chain"
9. Switch to Optimism
10. Point to updated USDC balance

**Tips**:
- Explain each step clearly
- Show LayerZero messaging in action
- Emphasize "deposit one chain, borrow another"
- If possible, show LayerZeroScan message tracking

---

## 🎬 SCENE 5: CREDIT SCORE DEMO (Optional, +30 seconds)

**Visual**: Dashboard showing credit score

**Script**:
```
And here's where it gets interesting.
Let me repay this loan.

[Switch back to Arbitrum]
[Go to Borrower panel, click "Repay"]
[Enter amount, confirm]

When I repay on time, my credit score increases.
You can see it went from 0 to 20 points.

[Point to credit score display]

After 10 on-time payments, I'd have a 600+ score,
unlocking 70% LTV instead of 60%.

That means with the same $3 of collateral,
I could borrow $2.10 instead of $1.80.

More borrowing power, just for being responsible.
That's the game-changer.
```

**Actions**:
1. Show repay functionality
2. Point to credit score before and after
3. Show LTV improvement

**Tips**:
- Make the credit score concept very clear
- Use concrete dollar examples
- Show enthusiasm about the innovation

---

## 🎬 SCENE 6: TECHNICAL OVERVIEW (3:00 - 3:30)

**Visual**: VS Code showing smart contracts OR architecture diagram

**Script**:
```
Under the hood, OmniCredit is built with cutting-edge technology.

We have 9 smart contracts deployed across 3 testnets:
- Arbitrum Sepolia as the hub
- Base and Optimism as satellites

The entire system runs on LayerZero V2—
we use OApp for cross-chain messaging 
and OFT for token bridging.

For price feeds, we integrate Pyth Network's real-time oracles
with confidence checks to ensure security.

Liquidations use Uniswap v4's PoolManager 
with a Dutch auction mechanism.

Everything is deployed with Hardhat 3.0 Ignition 
for deterministic, reproducible deployments.

[Show quick scroll through contracts directory]

The frontend is React with TypeScript,
using wagmi for Web3 interactions 
and RainbowKit for wallet connections.

[Show frontend code briefly]

It's production-ready, fully tested, 
and comprehensively documented.
```

**Visuals**:
- Briefly show contracts directory structure
- Show frontend components
- Show documentation files
- Show deployments.json

**Tips**:
- Don't dwell too long on code
- Mention key technologies clearly
- Show you built something substantial

---

## 🎬 SCENE 7: IMPACT & VISION (3:30 - 3:50)

**Visual**: Impact metrics slide or closing slide

**Script**:
```
The impact potential here is massive.

If just 10% of DeFi adopts credit scoring,
we could free up over $8 billion in locked capital 
and save users $50 million annually in bridging costs.

We're starting with over-collateralized lending,
but our vision is to enable under-collateralized loans 
for users with excellent credit scores.

Imagine a world where a 900+ credit score 
lets you borrow with just 80% collateral, 
or even 50% for trusted institutional borrowers.

That's the credit layer DeFi has been missing.
And we're building it.
```

**Visuals**:
- "$8B Capital Efficiency"
- "$50M+ User Savings"
- "$200M TVL Target (Year 1)"
- "Vision: Under-Collateralized Lending"

**Tips**:
- Be visionary but realistic
- Use big, memorable numbers
- Show passion for the mission

---

## 🎬 SCENE 8: CALL TO ACTION (3:50 - 4:10)

**Visual**: GitHub repo, links, contact info

**Script**:
```
OmniCredit is fully open source under MIT license.

You can find the complete codebase, documentation, 
and deployment instructions on our GitHub.

[Show GitHub URL]

We've deployed to Arbitrum, Base, and Optimism Sepolia.
All contract addresses are in our deployments.json file.

Try it yourself—the quick start guide 
will have you running in 5 minutes.

We're excited to bring this to mainnet 
after a security audit and would love your feedback.

Thanks for watching, 
and let's make DeFi more capital efficient together!

[Show contact info: Twitter, Discord, Email]
```

**Visuals**:
- GitHub repository
- README with quick start
- Contract addresses
- Contact information
- "⭐ Star us on GitHub!" call-out

**Tips**:
- Smile and be inviting
- Make it easy for judges to try
- Show enthusiasm
- End on a high note

---

## 🎨 Visual Assets to Prepare

### Slides (Create in Canva/Figma)
1. **Title Slide**: "OmniCredit - Omnichain Lending + Credit Scoring"
2. **Problem Slide**: "3 Critical Issues" with icons
3. **Solution Slide**: "3 Key Innovations" with icons
4. **Architecture Diagram**: Hub-and-spoke visual
5. **Credit Score Formula**: Math broken down visually
6. **LTV Chart**: Bar chart showing 60% → 70% → 80%
7. **Impact Metrics**: $8B, $50M, $200M in big fonts
8. **Tech Stack**: Logos of LayerZero, Pyth, Uniswap, etc.
9. **Thank You Slide**: Links + contact info

### Screen Recordings Needed
- Frontend demo (full flow)
- MetaMask transaction confirmations
- Multi-chain balance updates
- Optional: Code walkthrough
- Optional: LayerZeroScan message tracking

---

## 🎤 Recording Tips

### Before Recording
- [ ] Test audio (no echo, clear voice)
- [ ] Close unnecessary tabs/apps
- [ ] Full screen browser
- [ ] Hide bookmarks bar
- [ ] Set browser zoom to 100%
- [ ] Test wallet transactions (make sure you have gas)
- [ ] Practice script 2-3 times

### During Recording
- [ ] Speak clearly and enthusiastically
- [ ] Smile (it shows in your voice)
- [ ] Pause briefly between sections
- [ ] Don't rush—clarity > speed
- [ ] If you mess up, pause 3 seconds and restart sentence
- [ ] Highlight key points with cursor or annotations

### After Recording
- [ ] Trim dead air at start/end
- [ ] Add title cards between sections
- [ ] Add background music (low volume, non-distracting)
- [ ] Add captions/subtitles (YouTube auto-generate works)
- [ ] Add annotations for key points
- [ ] Export in 1080p

---

## 🎬 Alternative: Shorter 90-Second Version

**For Twitter/Social Media**

### Script (90 seconds):
```
Hi! I'm [Name], creator of OmniCredit—
omnichain lending with credit scoring.

THE PROBLEM:
DeFi has $50B TVL scattered across 100+ chains.
No credit history means everyone needs 150%+ collateral.
That's inefficient.

OUR SOLUTION:
Deposit collateral on any chain, 
borrow on another via LayerZero V2.
Build a 0-1000 credit score by repaying on time.
Better scores unlock 60% → 80% LTV.

LIVE DEMO:
[Show 30-second fast version of deposit → borrow → receive on different chain]

That's depositing on Base, borrowing on Arbitrum, 
receiving on Optimism. No bridging.

Built with LayerZero V2, Pyth Network, Uniswap v4.
9 contracts, 3 testnets, production-ready.

Check it out: [GitHub URL]

Let's make DeFi more capital efficient!
```

---

## 📊 Post-Production Checklist

- [ ] Audio levels balanced
- [ ] No long pauses or dead air
- [ ] Transitions between scenes smooth
- [ ] Text overlays readable
- [ ] Links/QR codes visible
- [ ] Logo/branding consistent
- [ ] Captions enabled
- [ ] Thumbnail created (1280x720)
- [ ] Title SEO-friendly
- [ ] Description includes all links
- [ ] Tags added

---

## 🔗 Video Hosting

**Recommended Platforms**:
1. **YouTube** (unlisted or public)
   - Best for embedding in submissions
   - Auto-captions
   - Analytics
   
2. **Loom** (free for short videos)
   - Easy recording
   - Instant sharing
   - Good for quick demos

3. **Vimeo** (clean, professional)
   - No ads
   - Better compression
   - Professional look

---

## 📝 Video Description Template

```
OmniCredit - The First Omnichain Lending Protocol with Continuous Credit Scoring

🌐 Deposit collateral on any chain, borrow on another, and build an on-chain credit score (0-1000) that unlocks up to 33% more borrowing power.

⭐ Key Features:
• Cross-chain lending via LayerZero V2
• Continuous credit scoring (0-1000)
• Dynamic LTV (60% → 80%)
• Anti-gaming fee-based limits
• Real-time Pyth oracles
• Uniswap v4 liquidations

🔧 Tech Stack:
LayerZero V2, Pyth Network, Uniswap v4, Solidity 0.8.28, Hardhat 3.0, React, TypeScript

🚀 Deployed On:
Arbitrum Sepolia, Base Sepolia, Optimism Sepolia

🔗 Links:
GitHub: [Your URL]
Documentation: [Your URL]
Try it: [Frontend URL]
Contact: [Your Email/Twitter]

Built for [Hackathon Name]

#DeFi #Blockchain #LayerZero #CrossChain #Lending #Web3

Timestamps:
0:00 - Introduction
0:20 - The Problem
0:50 - The Solution
1:30 - Live Demo (Lender)
2:00 - Live Demo (Borrower)
3:00 - Technical Overview
3:30 - Impact & Vision
3:50 - Call to Action
```

---

## 🎯 Success Metrics

Your video is successful if judges can answer:
1. ✅ What problem does OmniCredit solve?
2. ✅ How does cross-chain lending work?
3. ✅ What is the credit scoring system?
4. ✅ Why is this innovative?
5. ✅ How can they try it?

---

**🎬 Ready to record? You got this! 🚀**

*Remember: Authenticity > perfection. Show your passion!*

