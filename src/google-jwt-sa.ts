import * as base64Url from 'https://deno.land/std@0.160.0/encoding/base64url.ts'
import * as base64 from 'https://deno.land/std@0.165.0/encoding/base64.ts'

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
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
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
    iat
  }

  if (delegationSubject) {
    cs.sub = delegationSubject
  }

  const claimSet = base64Url.encode(
    JSON.stringify(cs)
  )

  const key = prepareKey(keys.private_key)

  const algorithm = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: {
      name: 'SHA-256',
    }
  }

  const keyArrBuffer = base64.decode(key)

  const privateKey = await crypto.subtle.importKey(
    'pkcs8', keyArrBuffer, algorithm, false, ['sign']
  )

  const inputArrBuffer = textEncoder.encode(`${header}.${claimSet}`)

  const outputArrBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    inputArrBuffer
  )

  const signature = base64Url.encode(outputArrBuffer)
  const assertion = `${header}.${claimSet}.${signature}`

  return await fetchToken(assertion)
}


async function fetchToken(assertion: string) {
  const grantType = `urn:ietf:params:oauth:grant-type:jwt-bearer`
  const body = `grant_type=${encodeURIComponent(grantType)}&assertion=${assertion}`

  const response = await fetch(
    `https://oauth2.googleapis.com/token`,
    {
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  )

  if (response && !response.ok) {
    const error = {
      status: response.status,
      statusText: response.statusText,
      type: 'Google JWT',
      message: await response.json()
    }
    throw error
  }

  const jsonData = await response.json();

  return {
    access_token: jsonData.access_token,
    expires_in: jsonData.expires_in,
    token_type: jsonData.token_type
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

  const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length)
  return pemContents
}
