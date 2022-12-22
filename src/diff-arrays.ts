export function diffArrays(arr1: string[], arr2: string[]) {
  const arr1Diff = arr1.filter(item => !arr2.includes(item))
  const arr2Diff = arr2.filter(item => !arr1.includes(item))

  return {
    arr1Diff,
    arr2Diff
  }
}