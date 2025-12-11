"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "../ui/input"

interface DateTimePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    date: Date | undefined | null;
    onDateChange: (date: Date | undefined | null) => void;
    disabled?: boolean;
}

export function DatePickerWithTime({
  className,
  date,
  onDateChange,
  disabled = false,
}: DateTimePickerProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState(date);
  
  React.useEffect(() => {
    setTempDate(date);
  }, [date]);
  
  const tempTime = tempDate ? format(tempDate, "HH:mm") : "00:00";

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setTempDate(null);
      return;
    }
    const [hours, minutes] = tempTime.split(':').map(Number);
    const newDate = new Date(selectedDate);
    if (!isNaN(hours) && !isNaN(minutes)) {
        newDate.setHours(hours, minutes);
    }
    setTempDate(newDate);
    // Keep popover open to adjust time if needed, or close it.
    // For better UX, let's close it on date selection, user can reopen if time adjustment is needed.
    // setPopoverOpen(false); // If we close here, time can't be adjusted in the same flow.
    // Let's keep it open and rely on "Apply"
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const newDate = tempDate ? new Date(tempDate) : new Date();
    const [hours, minutes] = newTime.split(':').map(Number);
    if(!isNaN(hours) && !isNaN(minutes)) {
        newDate.setHours(hours, minutes);
        setTempDate(newDate);
    }
  }

  const handleApply = () => {
    onDateChange(tempDate);
    setPopoverOpen(false);
  }

  const handleSetNow = () => {
    const now = new Date();
    setTempDate(now);
  }

  return (
    <div className={cn("grid gap-2", className)}>
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-[180px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yy HH:mm", { locale: es }) : <span>Seleccione fecha y hora</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={tempDate ?? undefined}
          onSelect={handleDateSelect}
          initialFocus
          locale={es}
          disabled={disabled}
        />
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground"/>
            <Input 
                type="time"
                value={tempTime}
                onChange={handleTimeChange}
                className="w-full"
                disabled={disabled}
            />
          </div>
          <div className="flex justify-between mt-3">
              <Button variant="ghost" size="sm" onClick={handleSetNow} disabled={disabled}>Ahora</Button>
              <Button size="sm" onClick={handleApply} disabled={disabled}>Aplicar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    </div>
  )
}
