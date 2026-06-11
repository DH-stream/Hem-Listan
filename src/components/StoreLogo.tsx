import React, { useState } from "react";
import type { GroceryChainId } from "../lib/pricing/types";

interface StoreLogoProps {
  chainId: GroceryChainId;
  className?: string;
}

const logoPaths: Partial<Record<GroceryChainId, string>> = {
  city_gross: "/store-logos/citygross.svg",
  ica: "/store-logos/ica.svg",
  coop: "/store-logos/coop.svg",
};

export default function StoreLogo({ chainId, className = "" }: StoreLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = logoPaths[chainId];
  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
