export const config = {
  runtime: 'edge',
};

const API_KEY = "developer_key_123"; // No DB, static key

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// Helper to fetch data
const fetchRoblox = async (url: string) => {
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return null;
    throw new Error(`Roblox API Error: ${res.status}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`Invalid JSON from ${url}:`, text.slice(0, 100));
    return null;
  }
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("x-api-key");
  if (authHeader !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized. Invalid or missing x-api-key header." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  // Extract dynamic ID from path (e.g. /api/user/DTO2654)
  const pathParts = url.pathname.split('/');
  const searchParam = pathParts[pathParts.length - 1];

  if (!searchParam || searchParam === 'user') {
    return new Response(JSON.stringify({ error: "Missing username or ID" }), { status: 400, headers: corsHeaders });
  }

  try {
    let userId: number | null = null;
    let isId = /^\d+$/.test(searchParam);

    if (isId) {
      const testRes = await fetch(`https://users.roblox.com/v1/users/${searchParam}`, { headers: DEFAULT_HEADERS });
      if (testRes.ok) userId = parseInt(searchParam, 10);
    }

    if (!userId) {
      const searchRes = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...DEFAULT_HEADERS },
        body: JSON.stringify({ usernames: [searchParam], excludeBannedUsers: false })
      });
      
      const searchTxt = await searchRes.text();
      let searchData: any = null;
      try {
        searchData = JSON.parse(searchTxt);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Roblox API returned HTML/blocked", raw: searchTxt.slice(0, 200) }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      if (!searchData.data || searchData.data.length === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
      }
      userId = searchData.data[0].id;
    }

    // Fetch parallel data
    const [user, avatar, followers, followings, friends] = await Promise.all([
      fetchRoblox(`https://users.roblox.com/v1/users/${userId}`),
      fetchRoblox(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
      fetchRoblox(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetchRoblox(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      fetchRoblox(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    ]);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unable to retrieve user details from Roblox" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const profileData = {
      userId,
      username: user.name,
      displayName: user.displayName,
      description: user.description,
      isBanned: user.isBanned,
      created: user.created,
      avatarUrl: avatar?.data?.[0]?.imageUrl || null,
      stats: {
        followers: followers?.count || 0,
        following: followings?.count || 0,
        friends: friends?.count || 0
      }
    };

    return new Response(JSON.stringify({ success: true, data: profileData }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
