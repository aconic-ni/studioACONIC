"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function Anexo5PrintButton() {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Button type="button" onClick={handlePrint} variant="default">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
    );
}
