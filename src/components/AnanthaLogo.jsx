import React from 'react';
import ananthaLogo from '../assets/anantha-stores-logo.png';

/**
 * Single Source of Truth for the official Anantha Stores logo asset URL.
 * Automatically resolves correctly in Vite dev mode, Vite production build,
 * and Electron local file:// protocols.
 */
export const ANANTHA_LOGO_SRC = ananthaLogo || './anantha-stores-logo.png';

/**
 * Reusable Official Anantha Stores Logo Component
 * 
 * Variants:
 *  - 'header'   : Compact for top application navigation bar (Cashier, Admin, Manager, Login)
 *  - 'login'    : Prominent branding for Login Card above "Sign In to Terminal"
 *  - 'receipt'  : Cleanly proportioned for 85mm thermal billing receipt header
 *  - 'watermark': Scaled for centered receipt watermark background
 *  - 'default'  : Unstyled / custom class passed via className
 */
export default function AnanthaLogo({
  variant = 'default',
  className = '',
  style = {},
  alt = 'ANANTHA STORES Logo',
  ...props
}) {
  let variantClasses = 'object-contain';

  switch (variant) {
    case 'header':
      variantClasses = 'w-7 h-7 sm:w-8 sm:h-8 object-contain';
      break;
    case 'login':
      variantClasses = 'w-16 h-16 sm:w-20 sm:h-20 object-contain';
      break;
    case 'receipt':
      variantClasses = 'h-8 sm:h-9 w-auto max-w-[130px] object-contain mx-auto';
      break;
    case 'watermark':
      variantClasses = 'w-full h-auto object-contain';
      break;
    default:
      variantClasses = 'object-contain';
      break;
  }

  const combinedClasses = `${variantClasses} ${className}`.trim();

  return (
    <img
      src={ANANTHA_LOGO_SRC}
      alt={alt}
      className={combinedClasses}
      style={style}
      loading="eager"
      decoding="async"
      onError={(e) => {
        // Fallback to relative public asset if path resolution ever fails
        const currentSrc = e.currentTarget.src;
        if (!currentSrc.endsWith('/anantha-stores-logo.png') && !currentSrc.endsWith('anantha-stores-logo.png')) {
          e.currentTarget.src = './anantha-stores-logo.png';
        }
      }}
      {...props}
    />
  );
}
