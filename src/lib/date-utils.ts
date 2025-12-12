
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

  while (daysAdded < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Check if the current day is a working day (Monday to Saturday)
    if (dayOfWeek !== 0) { // 0 is Sunday
      daysAdded++;
    }
  }

  return currentDate;
}
