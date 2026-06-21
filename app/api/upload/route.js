import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename to prevent directory traversal
    const name = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    // Check extension
    if (!name.endsWith(".m3u") && !name.endsWith(".m3u8")) {
      return new Response(
        JSON.stringify({ error: "Only .m3u and .m3u8 files are allowed" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const publicDir = join(process.cwd(), "public", "playlists");
    // Ensure the folder exists
    await mkdir(publicDir, { recursive: true });

    const filePath = join(publicDir, name);
    await writeFile(filePath, buffer);

    return new Response(
      JSON.stringify({
        success: true,
        name: file.name,
        url: `/playlists/${name}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
