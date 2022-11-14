import GoogleAuth from './src/google-auth.ts';
import getDataSet from './src/get-data-set.ts';
import testSubjects from './src/test-subjects.ts'

const dataSet = getDataSet();
testSubjects(dataSet.subjects)


