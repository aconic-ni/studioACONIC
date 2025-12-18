"use client";
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorksheetDetails } from '../executive/WorksheetDetails';
import { Anexo5Details } from '../executive/anexos/Anexo5Details';
import { Anexo7Details } from '../executive/anexos/Anexo7Details';
import type { Worksheet, WorksheetWithCase, AppUser } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface WorksheetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheet: Worksheet | WorksheetWithCase | null;
}

export function WorksheetDetailModal({ isOpen, onClose, worksheet }: WorksheetDetailModalProps) {
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoadingAgents(true);
      const q = query(collection(db, 'users'), where('roleTitle', '==', 'agente aduanero'));
      const querySnapshot = await getDocs(q);
      const fetchedAgents = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setAgents(fetchedAgents);
      setIsLoadingAgents(false);
    };
    fetchAgents();
  }, []);

  if (!isOpen || !worksheet) return null;

  const renderContent = () => {
    if (isLoadingAgents) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    // Determine the actual worksheet object, which might be nested.
    const wsData = 'worksheet' in worksheet && worksheet.worksheet ? worksheet.worksheet : worksheet;
    const aforoAgentName = (wsData as any).aforador;
    const agent = agents.find(a => a.displayName === aforoAgentName) || null;

    switch (wsData.worksheetType) {
      case 'anexo_5':
        return <Anexo5Details worksheet={wsData as Worksheet} agent={agent} onClose={onClose} />;
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
