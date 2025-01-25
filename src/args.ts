import { diffArrays } from './diff-arrays.ts'

export function processArgs(rawArgs: string[]) {
  const args = rawArgs.map((arguement) => {
    return arguement.trim().toLowerCase()
  })

  const acceptedFlags = [
    '--run-tasks',
    '--log-course-tasks',
    '--log-enrolment-tasks',
    '--view-course-aliases',
    '--view-subject',
    '--view-composites',
    '--replace-teacher',
    '--delete-course',
    '--transfer-course-ownership',
    '--list-courses',
    '--staging',
    '--scratch',
  ]

  if (!args.length) {
    const exception = 'Error: No flag(s) specified.'
    displayHelp(exception)
    Deno.exit(1)
  }

  const invalidFlagCheck = diffArrays(args, acceptedFlags)
  if (invalidFlagCheck.arr1Diff.length > 0) {
    const exception = 'Error: Invalid flag or no flag specified.'
    displayHelp(exception)
    Deno.exit(1)
  }

  if (args.length > 1) {
    const exception = 'Error: Multiple flags set.'
    displayHelp(exception)
    Deno.exit(1)
  }

  return new Set(args)

  function displayHelp(exceptionMsg: string) {
    console.log('\n%cNAME', 'color:yellow')
    console.log('  Google Classroom Sync\n')
    console.log('%cDESCRIPTION', 'color:yellow')
    console.log(
      '  Synchronise Google Classrom courses and course members to school Timetabler CSV files.\n',
    )
    console.log('%cFLAG EXAMPLES', 'color:yellow')

    for (const flag of acceptedFlags) {
      console.log(`\n  ${flag.toUpperCase()}`)
    }
  }
}
