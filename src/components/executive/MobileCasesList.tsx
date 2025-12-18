
"use client";
import React from 'react';
import type { no existe, WorksheetWithCase } from '@/types';
import { MobileCaseCard } from '@/components/executive/MobileCaseCard';

interface MobileCasesListProps {
  cases: WorksheetWithCase[];
  savingState: { [key: string]: boolean };
  onAutoSave: (caseId: string, field: keyof no existe, value: any) => void;
  approvePreliquidation: (caseId: string) => void;
  caseActions: any;
}

export function MobileCasesList({
  cases,
  savingState,
  onAutoSave,
  approvePreliquidation,
  caseActions
}: MobileCasesListProps) {
  return (
    <div className="space-y-4">
      {cases.map(c => (
        <MobileCaseCard
          key={c.id}
          caseData={c}
          savingState={savingState}
          caseActions={caseActions}
          onAutoSave={onAutoSave}
          approvePreliquidation={approvePreliquidation}
        />
      ))}
    </div>
  );
}
