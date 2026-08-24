import * as base64Url from 'https://deno.land/std@0.160.0/encoding/base64url.ts'
import * as base64 from 'https://deno.land/std@0.165.0/encoding/base64.ts'
import { fetchWithRetry } from './http-retry.ts'

export type GoogleAuth = {
  access_token: string
  expires_in: number
  token_type: string
}

type ClaimSetOptions = {
  scope: string[]
  delegationSubject?: string
}

interface ClaimSet {
  iss: string
  scope: string
  aud: string
  sub?: string
  exp: number
  iat: number
}

export { getToken }

async function getToken(keyFile: string, options: ClaimSetOptions) {
  const keys = JSON.parse(keyFile)
  const textEncoder = new TextEncoder()

  const header = base64Url.encode(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )

  const scope = options.scope.join(' ')
  const delegationSubject = options.delegationSubject || false

  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600

  const cs: ClaimSet = {
    iss: keys.client_email,
    scope,
    aud: keys.token_uri,
    exp,
    iat,
  }

  if (delegationSubject) {
    cs.sub = delegationSubject
  }

  const claimSet = base64Url.encode(
    JSON.stringify(cs),
  )

  const pemContents = prepareKey(keys.private_key)
  const binaryDerString = globalThis.atob(pemContents)
  const binaryDer = str2ab(binaryDerString)

  const algorithm = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: {
      name: 'SHA-256',
    },
  }

  // const keyArrBuffer = base64.decode(key)

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    algorithm,
    false,
    ['sign'],
  )

  const inputArrBuffer = textEncoder.encode(`${header}.${claimSet}`)

  const outputArrBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    inputArrBuffer,
  )

  const signature = base64Url.encode(outputArrBuffer)
  const assertion = `${header}.${claimSet}.${signature}`

  return await fetchToken(assertion)
}

async function fetchToken(assertion: string) {
  const grantType = `urn:ietf:params:oauth:grant-type:jwt-bearer`
  const body = `grant_type=${encodeURIComponent(grantType)}&assertion=${assertion}`

  const data = await fetchWithRetry(
    `https://oauth2.googleapis.com/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
    'fetchToken()',
  )

  return {
    access_token: data.responseJson.access_token,
    expires_in: data.responseJson.expires_in,
    token_type: data.responseJson.token_type,
  }
}

function prepareKey(key: string) {
  // Strip certificate header and footer
  const pem = key.replace(/\n/g, '')

  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'

  if (!pem.startsWith(pemHeader) || !pem.endsWith(pemFooter)) {
    throw new Error('Invalid service account private key')
  }

  const pemContents = pem.substring(
    pemHeader.length,
    pem.length - pemFooter.length,
  )
  return pemContents
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}
