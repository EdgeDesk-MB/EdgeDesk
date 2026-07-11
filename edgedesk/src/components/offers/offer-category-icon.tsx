"use client";

import { Dices, Tag } from "lucide-react";
import { FootballIcon, SportIcon } from "@/components/sport-icon";
import type { OfferCategoryId } from "@/lib/offers/offer-categories";
import { offerCategoryById } from "@/lib/offers/offer-categories";
import { cn } from "@/lib/utils";

export function OfferCategoryIcon({
  category,
  className,
  size = 14,
}: {
  category: OfferCategoryId | string;
  className?: string;
  size?: number;
}) {
  const def = offerCategoryById(category);
  if (def.id === "general") {
    return <Tag className={cn("shrink-0", className)} style={{ width: size, height: size }} />;
  }
  if (def.id === "casino") {
    return <Dices className={cn("shrink-0", className)} style={{ width: size, height: size }} />;
  }
  if (def.id === "football") {
    return <FootballIcon size={size} className={className} />;
  }
  if (def.sport) {
    return <SportIcon sport={def.sport} size={size} className={className} />;
  }
  return <Tag className={cn("shrink-0", className)} style={{ width: size, height: size }} />;
}
