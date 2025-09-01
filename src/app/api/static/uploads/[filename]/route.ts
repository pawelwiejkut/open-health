import { NextRequest } from "next/server";
import fs from "fs/promises";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params

    if (!filename.match(/^[a-zA-Z0-9-_]+\.(pdf|png)$/)) {
        return new Response('Invalid filename', {status: 400})
    }

    const filePath = `./public/uploads/${filename}`
    const file = await fs.readFile(filePath)
    // Convert Node Buffer to a proper ArrayBuffer slice
    const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'
    return new Response(body as ArrayBuffer, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${filename}"`
        }
    })
}
