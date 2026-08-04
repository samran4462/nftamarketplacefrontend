export const resolveIPFS = (url: string) => {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
};

export const fetchNFTMetadata = async (tokenURI: string) => {
  try {
    const response = await fetch(resolveIPFS(tokenURI));
    const data = await response.json();
    return {
      name: data.name || "Unknown NFT",
      description: data.description || "",
      image: resolveIPFS(data.image || ""),
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return {
      name: "Unknown NFT",
      description: "",
      image: "",
    };
  }
};
