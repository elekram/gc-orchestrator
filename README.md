# Google Classroom Orchestrator 🚀

Synchronises CSV files generated from our school's timetable using the Google Classroom
API. Google rest APIs are implemented without Google APIs and can be found in
src/google-actions.ts

## Table of Contents

1. [Setup](https://github.com/telekram/gc-orchestrator#setup)
2. [Example Service Account](https://github.com/telekram/gc-orchestrator#example-service-account-json)
3. [Example Config File](https://github.com/telekram/gc-orchestrator#example-config)

## Setup

- Sign into the Google Cloud Platform dashboard and create a new project.
- Create a new 'Service Account' with your project's name.
- Generate keys and download them as option JSON. (see JSON example below)
- Note your OAuth 2 Client ID as you will need it later
- Grant the 'Service Account Token Creator' role to the service account you created.
- Enable Domain-wide Delegation
- Sign into the Google Admin console and go to 'Security > API Control > Domain-wide
  Delegation'
- Using your OAuth 2 Client ID register the Google Classroom scopes you want you service
  accounts to be able to access. They are referenced here:
  https://developers.google.com/classroom/reference/rest/

## Example Service Account JSON

**Example service account JSON file from Google** This file is auto generated and should
match your project details

```json
{
  "type": "service_account",
  "project_id": "YOUR-SERVICE-ACCOUNT NAME",
  "private_key_id": "0374f62a8cf437728ebc53de6265950f58716cdc",
  "private_key": "-----BEGIN PRIVATE KEY-----\YOUR KEY DATA\n-----END PRIVATE KEY-----\n",
  "client_email": "service-acct@your-service-account-name",
  "client_id": "YOUR-CLIENT-ID-NUMBER",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-acct%40your-service-accout-name.iam.gserviceaccount.com"
}
```

## Example Config

**Example config.ts file**

```ts
const academicYearMap = {
  //'01 is for same classcode but different kids'
  '01': '2023',
  '07': '2023',
  '08': '2023',
  '09': '2023',
  '10': '2023',
  '11': '2023',
  '12': '2023',
}

const appSettings = {
  aliasVersion: 'v2',
  academicYearMap: new Map(Object.entries(academicYearMap)),
  verboseWarnings: false,
  serviceAccountCredentials: './config/<your google credentials file>.json',
  scopes: [
    'https://www.googleapis.com/auth/classroom.courses',
    'https://www.googleapis.com/auth/classroom.rosters',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.profile.emails',
    'https://www.googleapis.com/auth/classroom.profile.photos',
  ],
  validateSubjectsAndClasses: boolean,
  runDailyorgTasks: boolean,
  runCourseTasks: boolean,
  runArchiveTasks: boolean,
  runCourseDeletionTasks: boolean,
  runEnrolmentTasks: boolean,
  removeNonTimetabledTeachers: boolean,
  csvFileLocation: './csv/...',
  dailyorgFileLocation: './csv/dailyorg/',
  classNamesCsv: 'Class Names.csv',
  timetableCsv: 'Timetable.csv',
  studentLessonsCsv: 'Student Lessons.csv',
  unscheduledDutiesCsvFileName: 'Unscheduled Duties.csv',
  teacherPeriodReplacementsFileName: 'Teacher Period Replacements.csv',
  domain: '@yourdomain',
  defaultPageSize: 0,
  taskDelay: 150,
  subjectExceptions: [] as string[],
  compositeClassExceptions: [] as string[],
  jwtSubject: 'user@domain',
  classadmin: 'user@domain',
  teacherAides: ['user@domain'],
}
export default appSettings
```
