"use client";

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorksheetDetails } from '../executive/WorksheetDetails';
import { Anexo5Details } from '../executive/anexos/Anexo5Details';
import { Anexo7Details } from '../executive/anexos/Anexo7Details';
import type { Worksheet, WorksheetWithCase } from '@/types';

interface WorksheetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheet: Worksheet | WorksheetWithCase | null;
}

export function WorksheetDetailModal({ isOpen, onClose, worksheet }: WorksheetDetailModalProps) {
  if (!isOpen || !worksheet) return null;

  const renderContent = () => {
    // Determine the actual worksheet object, which might be nested.
    const wsData = 'worksheet' in worksheet && worksheet.worksheet ? worksheet.worksheet : worksheet;

    switch (wsData.worksheetType) {
      case 'anexo_5':
        return <Anexo5Details worksheet={wsData as Worksheet} onClose={onClose} />;
      case 'anexo_7':
        return <Anexo7Details worksheet={wsData as Worksheet} onClose={onClose} />;
      case 'hoja_de_trabajo':
      default:
        // Pass the full case data to WorksheetDetails if it's available, otherwise just the worksheet part.
        return <WorksheetDetails worksheet={worksheet as WorksheetWithCase} onClose={onClose} />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 h-[90vh] flex flex-col">
        <ScrollArea className="flex-grow">
          <div className="p-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
