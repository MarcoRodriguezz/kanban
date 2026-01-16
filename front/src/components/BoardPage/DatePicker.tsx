import React, { useState } from 'react';

type DatePickerProps = {
  value: string; // ISO date string (YYYY-MM-DD)
  onChange: (date: string) => void;
  className?: string;
};

// Helper to parse ISO date string (YYYY-MM-DD) to local Date
const parseISODate = (isoString: string): Date => {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper to format Date to ISO string (YYYY-MM-DD) in local timezone
const formatToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const date = parseISODate(value);
      return new Date(date.getFullYear(), date.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const selectedDate = value ? parseISODate(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const weekDays = ['l', 'm', 'x', 'j', 'v', 's', 'd'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Add days from next month to complete the grid (6 rows = 42 cells)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(new Date(year, month + 1, day));
    }

    return days;
  };

  const handleDateClick = (date: Date | null, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!date) return;
    const isoDate = formatToISO(date);
    onChange(isoDate);
    setIsOpen(false);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatDisplayValue = () => {
    if (!value) return 'Selecciona una fecha';
    if (selectedDate) {
      const day = selectedDate.getDate();
      const month = months[selectedDate.getMonth()].substring(0, 3);
      return `${day} ${month}`;
    }
    return 'Selecciona una fecha';
  };

  const days = getDaysInMonth(currentMonth);
  const currentMonthIndex = currentMonth.getMonth();
  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return date.getMonth() === currentMonthIndex;
  };

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === today.toDateString();
  };

  const handleToggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.right + window.scrollX + 8,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleOpen}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
      >
        {formatDisplayValue()}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="fixed z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10"
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => handlePrevMonth(e)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Mes anterior"
              >
                <span className="text-sm font-semibold">‹</span>
              </button>
              <h3 className="text-sm font-semibold text-slate-900">
                {months[currentMonthIndex]}, {currentMonth.getFullYear()}
              </h3>
              <button
                type="button"
                onClick={(e) => handleNextMonth(e)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Mes siguiente"
              >
                <span className="text-sm font-semibold">›</span>
              </button>
            </div>

            {/* Week days */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="flex items-center justify-center py-2 text-xs font-medium text-slate-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                const isInCurrentMonth = isCurrentMonth(date);
                const isDateSelected = isSelected(date);
                const isDateToday = isToday(date);

                if (!date) {
                  return <div key={`empty-${index}`} className="h-9" />;
                }

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={(e) => handleDateClick(date, e)}
                    disabled={!isInCurrentMonth}
                    className={`
                      h-9 rounded-lg text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200
                      ${!isInCurrentMonth
                        ? 'cursor-default text-slate-300'
                        : isDateSelected
                        ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                        : isDateToday
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : 'text-slate-700 hover:bg-slate-100'
                      }
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DatePicker;

