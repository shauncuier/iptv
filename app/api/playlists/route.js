import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";

export async function GET(request) {
  try {
    const publicDir = join(process.cwd(), "public", "playlists");
    
    let files = [];
    try {
      files = await readdir(publicDir);
    } catch {
      // If folder doesn't exist yet, return empty list
      return new Response(JSON.stringify({ playlists: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const playlists = [];
    for (const name of files) {
      if (name.endsWith(".m3u") || name.endsWith(".m3u8")) {
        const stats = await stat(join(publicDir, name));
        playlists.push({
          name,
          url: `/playlists/${name}`,
          size: stats.size,
          mtime: stats.mtime,
        });
      }
    }

    // Sort by modified time (newest first)
    playlists.sort((a, b) => b.mtime - a.mtime);

    return new Response(JSON.stringify({ playlists }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return new Response(JSON.stringify({ error: "Missing file name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitize filename to prevent directory traversal
    const safeName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    const filePath = join(process.cwd(), "public", "playlists", safeName);
    await unlink(filePath);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
