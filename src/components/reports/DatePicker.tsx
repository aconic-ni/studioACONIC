"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    date: Date | undefined | null;
    onDateChange: (date: Date | undefined) => void;
    disabled?: boolean;
}

export function DatePicker({
  className,
  date,
  onDateChange,
  disabled = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [displayDate, setDisplayDate] = React.useState(date);

  React.useEffect(() => {
    setDisplayDate(date);
  }, [date]);
  
  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDisplayDate(selectedDate);
    onDateChange(selectedDate);
    setIsOpen(false); 
  }

  return (
    <div className={cn("grid gap-2", className)}>
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-[180px] justify-start text-left font-normal",
            !displayDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayDate ? format(displayDate, "dd/MM/yy", { locale: es }) : <span>Seleccione fecha</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={displayDate ?? undefined}
          onSelect={handleDateSelect}
          initialFocus
          locale={es}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
    </div>
  )
}
