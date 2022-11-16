import { googleapis } from './deps.ts'
import appSettings from '../config/config.ts'

const keyFile = await Deno.readTextFile(appSettings.keyFile)
const keys = JSON.parse(keyFile)

const scopes = appSettings.scopes

export default function googleAuth(): googleapis.Common.JWT {

  const auth = new googleapis.Auth.JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes,
    subject: 'superadmin@cheltsec.vic.edu.au'
  })

  return auth
}
