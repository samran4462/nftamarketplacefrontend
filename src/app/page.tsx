"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther, formatEther } from "viem";
import { ethers } from "ethers";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MarketplaceABI from "@/constants/NFTMarketplace.json";
import { fetchNFTMetadata } from "@/lib/ipfs";
import { TiltCard } from "@/components/ui/tilt-card";
import HeroBackground from "@/components/canvas/HeroBackground";

// Minimal ERC721 ABI to check approval and get token URI
const erc721ABI = [
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setApprovalForAll",
    inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  }
];

const TypewriterText = ({ text, className, delayOffset = 0, as: tag = "div" }: { text: string, className?: string, delayOffset?: number, as?: any }) => {
  const lines = text.split("\n");
  const [replayKey, setReplayKey] = useState(0);

  // Dynamically resolve motion tag
  const MotionTag = (motion as any)[tag] || motion.div;

  return (
    <MotionTag
      key={replayKey}
      onMouseEnter={() => setReplayKey((k: number) => k + 1)}
      initial="hidden"
      animate="visible"
      className={className}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: delayOffset } }
      }}
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex}>
          {line.split(" ").map((word, i) => (
            <span key={`${lineIndex}-${i}`}>
              <motion.span
                variants={{
                  hidden: { opacity: 0, filter: "blur(8px)" },
                  visible: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.4 } }
                }}
              >
                {word}
              </motion.span>
              {i < line.split(" ").length - 1 && " "}
            </span>
          ))}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      ))}
    </MotionTag>
  );
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [listNftAddress, setListNftAddress] = useState("");
  const [listTokenId, setListTokenId] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);

  const getMarketplaceAddress = (): `0x${string}` => {
    const bsc = process.env.NEXT_PUBLIC_MARKETPLACE_BSC;
    const sepolia = process.env.NEXT_PUBLIC_MARKETPLACE_SEPOLIA;
    const fallback = "0x0000000000000000000000000000000000000000";
    
    if (chainId === 97) {
      return (bsc && bsc.length === 42 && bsc.startsWith("0x")) ? (bsc as `0x${string}`) : fallback;
    }
    return (sepolia && sepolia.length === 42 && sepolia.startsWith("0x")) ? (sepolia as `0x${string}`) : fallback;
  };

  const marketplaceAddress = getMarketplaceAddress();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const networkString = chainId === 97 ? "bscTestnet" : "sepolia";

  // Fetch Listings from backend
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/nfts/active?network=${networkString}`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          // Enrich listings with metadata
          const enriched = await Promise.all(data.map(async (item: any) => {
            try {
              const rpcUrl = networkString === "bscTestnet" ? "https://data-seed-prebsc-1-s1.binance.org:8545" : "https://ethereum-sepolia-rpc.publicnode.com";
              const provider = new ethers.JsonRpcProvider(rpcUrl);
              const contract = new ethers.Contract(item.nftAddress, erc721ABI, provider);
              const tokenURI = await contract.tokenURI(item.tokenId);
              const metadata = await fetchNFTMetadata(tokenURI);
              return { ...item, metadata };
            } catch (err) {
              console.error(`Error fetching metadata for ${item.nftAddress} #${item.tokenId}:`, err);
              return { ...item, metadata: { name: `Token #${item.tokenId}`, image: "https://placehold.co/400x400/1a1a1a/FFF?text=NFT" } };
            }
          }));
          setActiveListings(enriched);
        } else {
          setActiveListings([]); // Safely default to empty array without logging
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchListings();
  }, [chainId, backendUrl, networkString]);

  // Safely check if listNftAddress is a valid address
  const isValidNftAddress = listNftAddress && listNftAddress.length === 42 && listNftAddress.startsWith("0x");

  // Hook for approval check
  const { data: isApproved } = useReadContract({
    address: isValidNftAddress ? (listNftAddress as `0x${string}`) : undefined,
    abi: erc721ABI,
    functionName: "isApprovedForAll",
    args: [address as `0x${string}`, marketplaceAddress],
    query: { enabled: !!isValidNftAddress && !!address && !!marketplaceAddress && marketplaceAddress !== "0x0000000000000000000000000000000000000000" }
  });

  const { writeContractAsync: approve, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: listToken, isPending: isListing } = useWriteContract();
  const { writeContractAsync: buyToken, isPending: isBuying } = useWriteContract();

  const handleList = async () => {
    try {
      if (!isApproved) {
        await approve({
          address: listNftAddress as `0x${string}`,
          abi: erc721ABI,
          functionName: "setApprovalForAll",
          args: [marketplaceAddress, true]
        });
      }
      
      await listToken({
        address: marketplaceAddress,
        abi: MarketplaceABI.abi,
        functionName: "listToken",
        args: [listNftAddress, listTokenId, parseEther(listPrice)]
      });
      setIsListingModalOpen(false);
      alert("NFT Listed Successfully!");
    } catch (e) {
      console.error(e);
      alert("Error listing NFT");
    }
  };

  const handleBuy = async (nftAddress: string, tokenId: string, price: string) => {
    try {
      await buyToken({
        address: marketplaceAddress,
        abi: MarketplaceABI.abi,
        functionName: "buyToken",
        args: [nftAddress, tokenId],
        value: BigInt(price)
      });
      alert("NFT Bought Successfully!");
    } catch (e) {
      console.error(e);
      alert("Error buying NFT");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white overflow-hidden selection:bg-indigo-500/30 relative">
      <HeroBackground />
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <nav className="border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/40 overflow-hidden transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="font-extrabold text-white tracking-widest text-sm z-10">IRU</span>
            </div>
            <div className="hidden sm:flex flex-col justify-center">
              <span className="font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 leading-none">
                Marketplace
              </span>
              <span className="text-[10px] font-bold tracking-[0.3em] text-indigo-400 uppercase mt-0.5">
                Premium NFT
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center py-20"
        >
          <TypewriterText 
            as="h1"
            text={"Discover & Trade\nExtraordinary NFTs"} 
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 cursor-default"
          />
          <TypewriterText 
            as="p"
            text="The premium multi-chain marketplace for digital assets. Seamlessly connect your wallet and start trading on Sepolia or BSC Testnet." 
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 cursor-default"
            delayOffset={0.6}
          />
          
          {isConnected && (
            <Dialog open={isListingModalOpen} onOpenChange={setIsListingModalOpen}>
              <DialogTrigger className="bg-white text-black hover:bg-gray-200 rounded-full font-semibold px-8 h-14 inline-flex items-center justify-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                List Your NFT
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-[#1a1b23] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">List NFT for Sale</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Contract Address</label>
                    <Input 
                      placeholder="0x..." 
                      className="bg-black/50 border-white/10 focus-visible:ring-indigo-500"
                      value={listNftAddress}
                      onChange={(e) => setListNftAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Token ID</label>
                    <Input 
                      placeholder="e.g. 1" 
                      className="bg-black/50 border-white/10 focus-visible:ring-indigo-500"
                      value={listTokenId}
                      onChange={(e) => setListTokenId(e.target.value)}
                    />
                  </div>
                  
                  {/* NFT Preview */}
                  {listNftAddress && listTokenId && (
                     <div className="p-3 bg-black/40 rounded-lg border border-white/5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded bg-indigo-500/20 flex items-center justify-center text-2xl">
                          🖼️
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Ready to list Token #{listTokenId}</p>
                          <p className="text-xs text-gray-400">Please set your price below.</p>
                        </div>
                     </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Price (ETH/BNB)</label>
                    <Input 
                      placeholder="0.05" 
                      className="bg-black/50 border-white/10 focus-visible:ring-indigo-500"
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleList} 
                  disabled={isApproving || isListing}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 font-semibold"
                >
                  {isApproving ? "Approving..." : isListing ? "Listing..." : !isApproved ? "Approve & List" : "List NFT"}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Marketplace Explorer */}
        <div className="mt-10">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
            Active Listings
          </h2>
          
          {activeListings.length === 0 ? (
            <div className="text-center py-20 border border-white/5 rounded-2xl bg-white/[0.02]">
              <p className="text-gray-400">No active listings found on this network.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {activeListings.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <TiltCard>
                  <Card className="bg-[#15161d] border-white/5 overflow-hidden group shadow-2xl">
                    <div className="aspect-square relative overflow-hidden bg-black/50">
                      <img 
                        src={item.metadata.image} 
                        alt={item.metadata.name}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <CardHeader className="p-4 pb-2">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>{item.nftAddress.slice(0,6)}...{item.nftAddress.slice(-4)}</span>
                        <span>#{item.tokenId}</span>
                      </div>
                      <CardTitle className="text-lg font-bold text-white">{item.metadata.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="font-semibold text-indigo-400">
                        {formatEther(BigInt(item.price))} {chainId === 97 ? 'BNB' : 'ETH'}
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0">
                      <Button 
                        onClick={() => handleBuy(item.nftAddress, item.tokenId, item.price)}
                        disabled={isBuying}
                        className="w-full bg-white/10 hover:bg-white text-white hover:text-black transition-colors"
                      >
                        Buy Now
                      </Button>
                    </CardFooter>
                  </Card>
                  </TiltCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
