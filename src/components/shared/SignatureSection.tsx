"use client";
import { cn } from "@/lib/utils";
import React from 'react';

export const SignatureSection: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  showSignatureLine?: boolean;
}> = ({ title, subtitle, className, children, align = 'left', showSignatureLine = true }) => {
  const textAlignClass = `text-${align}`;
  return (
    <div className={cn("flex flex-col", className)}>
      {showSignatureLine && <div className="flex-grow border-b-2 border-black print:h-6 mb-1 h-[50px]"></div>}
      <div className={cn("text-xs print:text-[8pt]", textAlignClass)}>
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-gray-600 print:text-[7pt]">{subtitle}</p>}
          <div className="min-h-[30px] print:min-h-[20px] text-black font-semibold">
           {children}
          </div>
      </div>
    </div>
  );
};
