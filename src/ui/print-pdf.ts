// Direct printing of the built PDF. Story 9-3 ships this stub; story 9-4 implements it per platform.

export type PrintOutcome = 'printed' | 'unavailable' | 'failed'

/**
 * Prints `file`. Call it inside the click, with no await before it, so the user gesture survives.
 * For now it always answers 'unavailable' and never rejects.
 */
export function printPdf(file: File): Promise<PrintOutcome> {
  void file
  return Promise.resolve('unavailable')
}
