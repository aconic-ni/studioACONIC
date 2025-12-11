import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 px-6 border-b bg-card shadow-sm">
      <h1 className="text-xl font-semibold text-foreground font-headline">
        Page Canvas
      </h1>
      <Button>
        <Plus className="w-4 h-4 mr-2" />
        Add Component
      </Button>
    </header>
  );
}
