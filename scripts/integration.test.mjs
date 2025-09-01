/* Integration smoke tests for core functionality.
   Run: node scripts/integration.test.mjs
*/

import assert from 'node:assert'
import {setTimeout as delay} from 'node:timers/promises'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

// Minimal cookie jar
class CookieJar {
  constructor() { this.cookies = [] }
  addFrom(setCookieHeaders) {
    if (!setCookieHeaders) return
    const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
    for (const c of arr) {
      const [kv] = c.split(';')
      if (!kv) continue
      const [k, v] = kv.split('=')
      // replace if exists
      const idx = this.cookies.findIndex(x => x.startsWith(k + '='))
      if (idx >= 0) this.cookies[idx] = `${k}=${v}`
      else this.cookies.push(`${k}=${v}`)
    }
  }
  header() { return this.cookies.join('; ') }
}

async function http(method, path, {headers = {}, body, jar} = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(jar ? {Cookie: jar.header()} : {}),
      ...headers,
    },
    body
  })
  if (jar) jar.addFrom(res.headers.getSetCookie?.() || res.headers.get('set-cookie'))
  return res
}

async function json(res) {
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { throw new Error('Invalid JSON: ' + txt.slice(0, 200)) }
}

async function main() {
  const jar = new CookieJar()

  // 1) CSRF + register + login
  const csrfRes = await http('GET', '/api/auth/csrf', {jar})
  assert.strictEqual(csrfRes.status, 200)
  const csrf = (await json(csrfRes)).csrfToken
  assert.ok(csrf)

  const uname = `itest_${Date.now()}`
  const regRes = await http('POST', '/api/auth/register', {
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({username: uname, password: 'test1234'})
  })
  assert.strictEqual(regRes.status, 201)

  const loginRes = await http('POST', `/api/auth/callback/credentials?json=true`, {
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: `csrfToken=${encodeURIComponent(csrf)}&username=${encodeURIComponent(uname)}&password=test1234&redirect=false&callbackUrl=${encodeURIComponent(BASE)}`,
    jar
  })
  assert.ok([200, 302].includes(loginRes.status), 'Login should return 200 JSON or 302 redirect')

  // 2) GET assistant modes and llm providers
  const amRes = await http('GET', '/api/assistant-modes', {jar})
  assert.strictEqual(amRes.status, 200)
  const am = await json(amRes)
  assert.ok(Array.isArray(am.assistantModes))

  const llmRes = await http('GET', '/api/llm-providers', {jar})
  assert.strictEqual(llmRes.status, 200)
  const llm = await json(llmRes)
  assert.ok(Array.isArray(llm.llmProviders))

  // 3) Upload a PDF
  const pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  const pdfBuf = Buffer.from(await (await fetch(pdfUrl)).arrayBuffer())
  const fd = new FormData()
  const id = `it-${Date.now()}`
  fd.set('id', id)
  fd.set('file', new Blob([pdfBuf], {type: 'application/pdf'}), 'dummy.pdf')

  const upRes = await http('POST', '/api/health-data', {jar, body: fd})
  assert.strictEqual(upRes.status, 200)
  const up = await upRes.json()
  assert.strictEqual(up.id, id)
  assert.strictEqual(up.fileType, 'application/pdf')

  // 4) Poll until COMPLETED
  for (let i = 0; i < 30; i++) {
    const sres = await http('GET', `/api/health-data/${id}`, {jar})
    assert.strictEqual(sres.status, 200)
    const sd = await sres.json()
    if (sd.healthData.status === 'COMPLETED') break
    await delay(500)
    if (i === 29) throw new Error('Parsing did not complete in time')
  }

  // 5) List health data
  const listRes = await http('GET', '/api/health-data', {jar})
  assert.strictEqual(listRes.status, 200)
  const list = await json(listRes)
  assert.ok(Array.isArray(list.healthDataList))
  assert.ok(list.healthDataList.some(h => h.id === id))

  // 6) Docling health
  const dres = await http('GET', '/api/health/docling', {jar})
  assert.strictEqual(dres.status, 200)
  const dh = await json(dres)
  assert.ok(typeof dh.ok === 'boolean')

  console.log('Integration tests: OK')
}

main().catch((err) => {
  console.error('Integration tests failed:', err)
  process.exit(1)
})
