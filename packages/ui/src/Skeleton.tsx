import type { CSSProperties, HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const merged: CSSProperties = {
    width,
    height,
    borderRadius: radius,
    ...style,
  };

  return <div className={['ap-skeleton', className].filter(Boolean).join(' ')} style={merged} {...props} />;
}
