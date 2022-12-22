import { diffArrays } from './diff-arrays.ts'

export function processArgs(rawArgs: string[]) {
  const args = rawArgs.map(arguement => {
    return arguement.trim().toLowerCase()
  })

  const acceptedFlags = [
    '--add-courses',
    '--update-courses',
    '--add-teachers',
    '--remove-teachers',
    '--add-students',
    '--remove-students',
    '--archive-courses',
    '--run-tasks',
    '--log-tasks',
    '--sync-calendars',
    '--custom-task',
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

  if (args.length === 1 && args.includes('--show-tasks')) {
    const exception = 'Error: --Show-Tasks cannot be used in isolation'
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
    console.log('  --Add-Courses      : Looks up timetable CSV files and creates new Google courses if they don\'t already exist.\n')
    console.log('  --Update-Courses   : Looks up timetable CSV files and updates course attributes (makes course state \'active\' if timetabled).\n')
    console.log('  --Add-Teachers     : Looks up timetable CSV files and adds teachers to exisitng Google Classroom courses.\n')
    console.log('  --Remove-Teachers  : Looks up timetable CSV files and removes teachers from exisiting Google Classroom courses who are not in timetable.\n')
    console.log('  --Add-Students     : Looks up timetable CSV files and and adds students to exisitng Google Classroom courses.\n')
    console.log('  --Remove-Students  : Looks up timetable CSV files and removes students from exisiting Google Classroom courses who are not in timetable.\n')
    console.log('  --Archive-Courses  : Archives class (not subject) courses that are not found in the timetable CSV files.\n')
    console.log('  --All-Tasks        : Runs add courses, update courses, add teachers (does not remove teacher), add students and archive tasks. Can not be used with --Show-Tasks\n')
    console.log('  --Show-Tasks       : Displays the generated task objects on screen instead of executing them.\n')
    console.log('  --Show-Aliases     : Display course ID to alias map.\n')
    console.log('\n%c' + exceptionMsg + '\n', 'color:red')
  }
}