import React, { useMemo } from 'react';
import { encodeCode128B } from '../utils/code128.js';

export { encodeCode128B };

export default function Barcode128({ 
  value, 
  width = 160, 
  height = 50, 
  showText = true, 
  className = '',
  barColor = '#000000',
  textColor = '#1e293b'
}) {
  const pattern = useMemo(() => encodeCode128B(value), [value]);

  if (!pattern || !value) {
    return <div className="text-xs text-red-500">Invalid barcode</div>;
  }

  // Calculate total modules
  let totalModules = 0;
  for (let i = 0; i < pattern.length; i++) {
    totalModules += parseInt(pattern[i], 10);
  }

  // Generate SVG rects for black bars (even indexes are bars, odd are spaces)
  const rects = [];
  let currentX = 0;
  for (let i = 0; i < pattern.length; i++) {
    const moduleWidth = parseInt(pattern[i], 10);
    const isBar = i % 2 === 0;
    if (isBar) {
      rects.push(
        <rect
          key={i}
          x={currentX}
          y={0}
          width={moduleWidth}
          height={height}
          fill={barColor}
        />
      );
    }
    currentX += moduleWidth;
  }

  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalModules} ${typeof height === 'number' ? height : 50}`}
        style={{ width: widthStyle, height: heightStyle, display: 'block' }}
        preserveAspectRatio="none"
      >
        {rects}
      </svg>
      {showText && (
        <span 
          className="font-mono text-[11px] font-bold tracking-widest mt-1"
          style={{ color: textColor }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
