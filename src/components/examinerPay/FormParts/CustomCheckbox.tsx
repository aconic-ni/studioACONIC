"use client";
import type React from 'react';
import { cn } from "@/lib/utils";

interface CustomCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelClassName?: string;
  containerClassName?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ label, id, checked, onChange, name, value, disabled, labelClassName, containerClassName, ...props }) => {
  const uniqueId = id || `custom-checkbox-${name}-${value || Math.random().toString(36).substring(7)}`;
  return (
    <label htmlFor={uniqueId} className={cn("custom-checkbox-label", containerClassName)}>
      <input
        type="checkbox"
        id={uniqueId}
        name={name}
        checked={checked}
        onChange={onChange}
        value={value}
        disabled={disabled}
        className="custom-checkbox-input"
        {...props}
      />
      <span className="custom-checkbox-checkmark"></span>
      <span className={cn("text-sm text-foreground ml-2", labelClassName)}>{label}</span>
    </label>
  );
};
