import { diffArrays } from './diff-arrays.ts'

export function processArgs(rawArgs: string[]) {
  const args = rawArgs.map(arguement => {
    return arguement.trim().toLowerCase()
  })

  const acceptedFlags = [
    '--run-tasks',
    '--show-tasks',
    '--show-aliases'
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
    const exception = 'Error: Multiple flags set'
    displayHelp(exception)
    Deno.exit(1)
  }

  return new Set(args)

  function displayHelp(exceptionMsg: string) {
    console.log('\n%cNAME', 'color:yellow')
    console.log('  Google Classroom Sync\n')
    console.log('%cDESCRIPTION', 'color:yellow')
    console.log('  Generate and sync subjects and classes using exported CSV files from Timetabler to courses on Google Classroom.\n')
    console.log('%cFLAG EXAMPLES', 'color:yellow')
    console.log('  --Run-Tasks        : Looks up timetable CSV files and creates new Google courses if they don\'t already exist.\n')
    console.log('  --Show-Tasks       : Displays the generated task objects on screen instead of executing them.\n')
    console.log('  --Show-Aliases     : Display course ID to alias map.\n')
    console.log('\n%c' + exceptionMsg + '\n', 'color:red')
  }
}