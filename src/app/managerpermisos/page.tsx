"use client";
import React, { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ManageDocumentsForm } from '@/components/executive/ManageDocumentsForm';
import { Loader2 } from 'lucide-react';

function ManagerPermisosPage() {
    return (
        <AppShell>
            <div className="py-2 md:py-5">
                <Suspense fallback={<div className="flex justify-center items-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
                    <ManageDocumentsForm />
                </Suspense>
            </div>
        </AppShell>
    );
}

export default ManagerPermisosPage;
