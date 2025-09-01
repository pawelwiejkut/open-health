import {fromBuffer as pdf2picFromBuffer} from 'pdf2pic'

async function main() {
  const url = process.argv[2] || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  console.log('Downloading PDF:', url)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download PDF: ${res.status} ${res.statusText}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  const pdf2pic = pdf2picFromBuffer(buffer)
  const outputs = await pdf2pic.bulk(-1, {responseType: 'base64'})
  const images = outputs.filter(o => o.base64).map(o => o.base64)
  console.log('Converted pages:', images.length)
  if (images[0]) console.log('First image base64 prefix:', images[0].slice(0, 80))
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})

