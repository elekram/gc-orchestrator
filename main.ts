import GoogleAuth from './src/google-auth.ts';
import getDataSet from './src/get-dataset.ts';
import testSubjects from './src/test-dataset.ts'

const dataset = getDataSet();
console.log(dataset.subjects)
// testSubjects(dataset.subjects)



