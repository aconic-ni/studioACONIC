
"use client";

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorksheetDetails } from '../executive/WorksheetDetails';
import type { Worksheet, WorksheetWithCase } from '@/types';

interface WorksheetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheet: Worksheet | WorksheetWithCase | null;
}

export function WorksheetDetailModal({ isOpen, onClose, worksheet }: WorksheetDetailModalProps) {
  if (!isOpen || !worksheet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 h-[90vh] flex flex-col">
        <ScrollArea className="flex-grow">
          <div className="p-6">
            <WorksheetDetails 
              worksheet={worksheet as Worksheet} 
              aforoCase={'aforo' in worksheet ? (worksheet as any).aforo : null}
              onClose={onClose} 
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
