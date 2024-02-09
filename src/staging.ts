import { Store } from './store.ts'
import * as googleClassroom from './google-actions.ts'

export async function staging(store: Store) {
  console.log('\n%c[ CODE STAGING AREA ]\n', 'color:magenta')
  /*
  TEACHER_COURSE
  SUBJECT_COURSE
  CLASS_COURSE
  */

  const newCourseAliasMap: {
    id: string
    alias: string
  }[] = []

  // for (const [id, alias] of store.remote.courseIds) {
  //   const aliasParts = alias.split('.')

  //   // console.log(id, alias)

  //   const teacherCourse = 'TEACHER_COURSE'
  //   const classCourse = 'CLASS_COURSE'
  //   let newAlias = ''

  //   if (aliasParts[1] === 'STANDARD_CLASS') {
  //     newAlias = `v3.${classCourse}.${aliasParts[2]}.${aliasParts[3]}`

  //     newCourseAliasMap.push({
  //       id,
  //       alias: newAlias,
  //     })
  //   }

  //   if (aliasParts[1] === 'SUBJECT_TEACHERS') {
  //     newAlias = `v3.${teacherCourse}.${aliasParts[2]}`

  //     newCourseAliasMap.push({
  //       id,
  //       alias: newAlias,
  //     })
  //   }

  //   if (!newAlias) {
  //     throw `error with ${alias}`
  //   }
  // }
  // console.log(newCourseAliasMap)
  // for (const [k, v] of store.remote.v2courseIds) {
  //   console.log(`${k}  ---> ${v}`)
  // }

  // for (const x of newCourseAliasMap) {
  //   console.log(x)
  // }

  // console.log(newCourseAliasMap.length)

  // await Promise.all(
  //   newCourseAliasMap.map(async (item, index) => {
  //     await googleClassroom.deleteCourseAlias(
  //       store.auth,
  //       item.id,
  //       item.alias,
  //       index,
  //       newCourseAliasMap.length,
  //     )
  //   }),
  // )

  // await Promise.all(
  //   newCourseAliasMap.map(async (item, index) => {
  //     await googleClassroom.createCourseAlias(
  //       store.auth,
  //       item.id,
  //       item.alias,
  //       index,
  //       newCourseAliasMap.length,
  //     )
  //   }),
  // )
}
