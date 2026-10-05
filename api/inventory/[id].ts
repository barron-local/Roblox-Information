export const config = {
  runtime: 'edge',
};

const API_KEY = "developer_key_123";

const fetchRoblox = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return null;
    throw new Error(`Roblox API Error: ${res.status}`);
  }
  return res.json();
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.headers.get("x-api-key") !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const pathParts = url.pathname.split('/');
  const userIdStr = pathParts[pathParts.length - 1];

  if (!userIdStr || userIdStr === 'inventory' || !/^\d+$/.test(userIdStr)) {
    return new Response(JSON.stringify({ error: "Valid User ID required for inventory" }), { status: 400, headers: corsHeaders });
  }

  try {
    const data = await fetchRoblox(`https://inventory.roblox.com/v2/users/${userIdStr}/inventory?assetTypes=Hat,HairAccessory,FaceAccessory,NeckAccessory,ShoulderAccessory,FrontAccessory,BackAccessory,WaistAccessory&limit=100&sortOrder=Desc`);
    
    if (!data || !data.data) {
      return new Response(JSON.stringify({ success: true, data: [] }), { headers: corsHeaders });
    }

    // Format like the frontend
    const items = data.data.map((item: any) => ({
      assetId: item.assetId,
      name: item.name,
      imageUrl: `https://tr.rbxcdn.com/` // We don't fetch full thumbnails here to save time, or we can?
    }));

    return new Response(JSON.stringify({ success: true, data: data.data }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: corsHeaders });
  }
}
