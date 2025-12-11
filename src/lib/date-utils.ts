
/**
 * Calculates the due date by adding a specified number of working days to a start date.
 * Working days are considered Monday to Saturday.
 * @param startDate The date to start counting from.
 * @param daysToAdd The number of working days to add.
 * @returns The calculated due date.
 */
export function calculateDueDate(startDate: Date, daysToAdd: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  // Start counting from the day AFTER the start date
  currentDate.setDate(currentDate.getDate() + 1);

  while (daysAdded < daysToAdd) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Check if the current day is a working day (Monday to Saturday)
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      daysAdded++;
    }
    
    // If we haven't reached the target number of days, move to the next day
    if (daysAdded < daysToAdd) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return currentDate;
}
