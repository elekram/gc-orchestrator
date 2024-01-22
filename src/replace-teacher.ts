import { Store } from './store.ts'
import { getAcademicYearForClasscode, TimetabledCourse } from './tasks.ts'

export function replaceTeacher(
  store: Store,
  teacher: string,
  replacementTeacher: string,
) {
  if (teacher.toLowerCase() === replacementTeacher.toLowerCase()) {
    console.log(
      '\n%cTeacher and Replacement Teacher are the same. Exiting.\n',
      'color:red',
    )
    Deno.exit()
  }

  if (!store.remote.activeUsers.has(teacher.toLowerCase())) {
    console.log(`\n%cTeacher not foundor active: ${teacher}\n`, 'color:red')
    Deno.exit()
  }

  if (!store.remote.activeUsers.has(replacementTeacher.toLowerCase())) {
    console.log(
      `\n%cReplacement teacher not found or not active: ${replacementTeacher}\n`,
      'color:red',
    )
    Deno.exit()
  }

  const replacementClasses = getReplacementClassesForTeacher(store, teacher)
  if (replacementClasses.size) {
    console.log(
      `%cFound ${replacementClasses.size} replacement classes for ${teacher.toLocaleLowerCase()}\n`,
      'color:green',
    )
  }
  const replacementCourses: TimetabledCourse[] = []
  for (const courseCode of replacementClasses) {
    replacementCourses.push({
      courseCode,
      teachers: [replacementTeacher],
    })
  }

  store.replacements.individualReplacements.push(...replacementCourses)
}

function getReplacementClassesForTeacher(store: Store, teacher: string) {
  const replacementClasses = new Set<string>()

  for (const [code, cls] of store.timetable.classes) {
    if (cls.subjectTeachers.has(teacher)) {
      const academicYearPrefix = getAcademicYearForClasscode(
        cls.classCodeWithSemeterPrefix,
      )
      const courseAlias = `${academicYearPrefix}-${code}`
      replacementClasses.add(courseAlias)
    }
  }
  return replacementClasses
}
