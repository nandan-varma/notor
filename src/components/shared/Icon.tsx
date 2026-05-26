import type { LucideIcon, LucideProps } from "lucide-react";
import { memo } from "react";

interface IconProps extends LucideProps {
  icon: LucideIcon;
}

/**
 * Tiny wrapper around lucide-react icons. Defaults the stroke to 1.75 for
 * a slightly lighter look that pairs better with the small UI font.
 */
function IconImpl({ icon: Component, strokeWidth = 1.75, size = 14, ...rest }: IconProps) {
  return <Component strokeWidth={strokeWidth} size={size} {...rest} />;
}

export const Icon = memo(IconImpl);
