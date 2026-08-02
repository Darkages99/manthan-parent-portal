/** Standard term + grade choices for the results console's dropdowns. */
export const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3", "Annual", "Unit Test 1", "Unit Test 2"];

export const GRADE_OPTIONS = ["A+", "A", "B+", "B", "C+", "C", "D", "E", "F"];

/** A fixed option list, plus the current value prepended if it isn't already in it —
 *  so editing older rows never silently drops their existing term/grade/subject. */
export function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}
