import { useState, useEffect } from 'react';
import { Search, ShieldCheck, User, Users, UserPlus, Terminal, ArrowLeft } from 'lucide-react';
import './index.css';

interface UserData {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
}

interface UserStats {
  followers: number;
  followings: number;
  friends: number;
}

interface Collectible {
  assetId: number;
  name: string;
  recentAveragePrice: number | null;
  imageUrl?: string;
}

function App() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [collectibles, setCollectibles] = useState<Collectible[] | null>(null);
  const [equipped, setEquipped] = useState<Collectible[] | null>(null);
  const [inventory, setInventory] = useState<Collectible[] | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'avatar' | 'inventory' | 'limiteds'>('about');
  const [view, setView] = useState<'search' | 'docs'>('search');

  // Simple client-side routing
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === '/docs' || path === '/api' || path === '/api-docs') {
        setView('docs');
      } else {
        setView('search');
      }
    };

    handleLocationChange(); // Check initial route
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (newView: 'search' | 'docs') => {
    setView(newView);
    window.history.pushState({}, '', newView === 'docs' ? '/docs' : '/');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      setError('⚠️ โปรดระบุชื่อผู้เล่น หรือ รหัส User ID ก่อนทำการค้นหาครับ');
      return;
    }

    setLoading(true);
    setError(null);
    setUserData(null);
    setUserStats(null);
    setAvatarUrl(null);
    setCollectibles(null);
    setEquipped(null);
    setInventory(null);
    setActiveTab('about');

    try {
      let userId: number | null = null;
      const input = search.trim();

      // If the input is purely numbers, it could be a User ID
      if (/^\d+$/.test(input)) {
        try {
          const testIdRes = await fetch(`/proxy/users/v1/users/${input}`);
          if (testIdRes.ok) {
            userId = parseInt(input, 10);
          }
        } catch (e) {
          // Ignore and fallback to username
        }
      }

      // Fallback to username search if not found as ID
      if (!userId) {
        const searchRes = await fetch('/proxy/users/v1/usernames/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [input], excludeBannedUsers: false })
        });
        
        if (!searchRes.ok) throw new Error('Failed to fetch user');
        const searchData = await searchRes.json();
        
        if (!searchData.data || searchData.data.length === 0) {
          throw new Error('User not found. Please check the spelling or User ID.');
        }

        userId = searchData.data[0].id;
      }

      const [userRes, avatarRes, followersRes, followingsRes, friendsRes] = await Promise.all([
        fetch(`/proxy/users/v1/users/${userId}`),
        fetch(`/proxy/thumbnails/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
        fetch(`/proxy/friends/v1/users/${userId}/followers/count`),
        fetch(`/proxy/friends/v1/users/${userId}/followings/count`),
        fetch(`/proxy/friends/v1/users/${userId}/friends/count`)
      ]);

      if (!userRes.ok) throw new Error('Failed to fetch user details');
      
      const userData = await userRes.json();
      const avatarData = await avatarRes.json();
      const followersData = await followersRes.json();
      const followingsData = await followingsRes.json();
      const friendsData = await friendsRes.json();

      setUserData(userData);
      setUserStats({
        followers: followersData.count || 0,
        followings: followingsData.count || 0,
        friends: friendsData.count || 0
      });
      
      if (avatarData.data && avatarData.data.length > 0) {
        setAvatarUrl(avatarData.data[0].imageUrl);
      }

      // Fetch Collectibles (Limiteds)
      const invRes = await fetch(`/proxy/inventory/v1/users/${userId}/assets/collectibles?limit=10`);
      let colData: Collectible[] = [];
      if (invRes.ok) {
        const invJson = await invRes.json();
        if (invJson.data && invJson.data.length > 0) {
          colData = invJson.data.slice(0, 8); // Display top 8
          const assetIds = colData.map(c => c.assetId).join(',');
          
          const thumbRes = await fetch(`/proxy/thumbnails/v1/assets?assetIds=${assetIds}&size=150x150&format=Png&isCircular=false`);
          if (thumbRes.ok) {
            const thumbJson = await thumbRes.json();
            colData = colData.map(c => {
              const thumb = thumbJson.data?.find((t: any) => t.targetId === c.assetId);
              return { ...c, imageUrl: thumb?.imageUrl };
            });
          }
        }
      }
      setCollectibles(colData.length > 0 ? colData : null);

      // Fetch Equipped Items
      const wearRes = await fetch(`/proxy/avatar/v1/users/${userId}/currently-wearing`);
      if (wearRes.ok) {
        const wearJson = await wearRes.json();
        if (wearJson.assetIds && wearJson.assetIds.length > 0) {
          const topAssets = wearJson.assetIds.slice(0, 8); // Display up to 8
          const assetIdsString = topAssets.join(',');
          
          // Get Thumbnails
          const eqThumbRes = await fetch(`/proxy/thumbnails/v1/assets?assetIds=${assetIdsString}&size=150x150&format=Png&isCircular=false`);
          let thumbMap: Record<number, string> = {};
          if (eqThumbRes.ok) {
            const eqThumbJson = await eqThumbRes.json();
            eqThumbJson.data?.forEach((t: any) => {
              thumbMap[t.targetId] = t.imageUrl;
            });
          }

          // Get Names
          const eqData: Collectible[] = await Promise.all(topAssets.map(async (id: number) => {
            let name = "Unknown Item";
            try {
              const detRes = await fetch(`/proxy/economy/v2/assets/${id}/details`);
              if (detRes.ok) {
                const detJson = await detRes.json();
                name = detJson.Name || name;
              }
            } catch (e) {
              // ignore error for individual item
            }
            return {
              assetId: id,
              name: name,
              recentAveragePrice: null,
              imageUrl: thumbMap[id]
            };
          }));

          setEquipped(eqData.length > 0 ? eqData : null);
        }
      }

      // Fetch Full Inventory (Accessories)
      const fullInvRes = await fetch(`/proxy/inventory/v2/users/${userId}/inventory?assetTypes=Hat,HairAccessory,FaceAccessory,NeckAccessory,ShoulderAccessory,FrontAccessory,BackAccessory,WaistAccessory&limit=100&sortOrder=Desc`);
      if (fullInvRes.ok) {
        const fullInvJson = await fullInvRes.json();
        if (fullInvJson.data && fullInvJson.data.length > 0) {
          const invAssets = fullInvJson.data;
          const assetIdsString = invAssets.map((i: any) => i.assetId).join(',');
          
          // Get Thumbnails
          const invThumbRes = await fetch(`/proxy/thumbnails/v1/assets?assetIds=${assetIdsString}&size=150x150&format=Png&isCircular=false`);
          let thumbMap: Record<number, string> = {};
          if (invThumbRes.ok) {
            const invThumbJson = await invThumbRes.json();
            invThumbJson.data?.forEach((t: any) => {
              thumbMap[t.targetId] = t.imageUrl;
            });
          }

          const invData: Collectible[] = invAssets.map((item: any) => ({
            assetId: item.assetId,
            name: item.name,
            recentAveragePrice: null,
            imageUrl: thumbMap[item.assetId]
          }));

          setInventory(invData.length > 0 ? invData : null);
        }
      }

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <button 
        onClick={() => navigateTo(view === 'docs' ? 'search' : 'docs')} 
        className="api-docs-toggle"
      >
        {view === 'docs' ? (
          <><ArrowLeft size={16} className="lucide-arrow-left" /> กลับสู่หน้าค้นหา</>
        ) : (
          <><Terminal size={16} className="lucide-terminal" /> Developer API</>
        )}
      </button>

      <header>
        <h1>Roblox Info</h1>
        <p>Player statistics and profile intelligence</p>
      </header>

      {view === 'docs' ? (
        <div className="profile-card docs-card">
          <h2>คู่มือการใช้งาน API (สำหรับนักพัฒนา)</h2>
          <p>API นี้ช่วยให้นักพัฒนาสามารถดึงข้อมูลโปรไฟล์ สถิติ และรายละเอียดผู้เล่นใน Roblox ได้ครบจบใน Request เดียว โดยไม่ต้องยุ่งยากไปดึงจากหลายๆ แหล่งของระบบ Roblox ครับ</p>
          
          <h3>1. การยืนยันตัวตน (Authentication)</h3>
          <p>เนื่องจากระบบนี้เป็นแบบ No DB คุณต้องแนบ <strong>API Key</strong> ไปกับ Header ของทุกคำขอเพื่อยืนยันตัวตนเสมอครับ</p>
          <pre><code>x-api-key: developer_key_123</code></pre>
          
          <h3>2. เส้นทาง API (Endpoints & ตัวอย่างการเรียก)</h3>
          <p>ระบบของเรามีเส้น API ให้เลือกใช้งานทั้งหมด 4 เส้นทาง พร้อมตัวอย่างคำสั่ง cURL ดังนี้:</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            
            {/* Endpoint 1: User */}
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderLeft: '4px solid #3b82f6', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ background: '#3b82f6', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>GET</span>
                <code style={{ fontSize: '1.05rem', background: 'transparent', padding: 0, color: '#e2e8f0', fontWeight: '600' }}>/api/user/:id_or_username</code>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>
                ดึงข้อมูลโปรไฟล์หลัก (ชื่อ, Avatar, วันสมัคร, สถิติผู้ติดตาม/เพื่อน) — <em>รองรับทั้ง Username และ User ID</em>
              </p>
              <pre style={{ margin: 0, background: '#090d16' }}><code>curl -H "x-api-key: developer_key_123" https://roblox-information.vercel.app/api/user/DTO2654</code></pre>
            </div>

            {/* Endpoint 2: Inventory */}
            <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', borderLeft: '4px solid #a855f7', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ background: '#a855f7', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>GET</span>
                <code style={{ fontSize: '1.05rem', background: 'transparent', padding: 0, color: '#e2e8f0', fontWeight: '600' }}>/api/inventory/:id</code>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>
                ดึงข้อมูลไอเทมในคลังเก็บของ 100 ชิ้นล่าสุด (ใช้ User ID)
              </p>
              <pre style={{ margin: 0, background: '#090d16' }}><code>curl -H "x-api-key: developer_key_123" https://roblox-information.vercel.app/api/inventory/4217570031</code></pre>
            </div>

            {/* Endpoint 3: Equipped */}
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderLeft: '4px solid #10b981', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ background: '#10b981', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>GET</span>
                <code style={{ fontSize: '1.05rem', background: 'transparent', padding: 0, color: '#e2e8f0', fontWeight: '600' }}>/api/equipped/:id</code>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>
                ดึงข้อมูลไอเทมและอุปกรณ์ที่ตัวละครกำลังสวมใส่อยู่ปัจจุบัน (ใช้ User ID)
              </p>
              <pre style={{ margin: 0, background: '#090d16' }}><code>curl -H "x-api-key: developer_key_123" https://roblox-information.vercel.app/api/equipped/4217570031</code></pre>
            </div>

            {/* Endpoint 4: Limiteds */}
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderLeft: '4px solid #f59e0b', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{ background: '#f59e0b', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>GET</span>
                <code style={{ fontSize: '1.05rem', background: 'transparent', padding: 0, color: '#e2e8f0', fontWeight: '600' }}>/api/limiteds/:id</code>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>
                ดึงข้อมูลไอเทมของสะสมหายาก (Limited Collectibles) ที่ผู้เล่นครอบครอง (ใช้ User ID)
              </p>
              <pre style={{ margin: 0, background: '#090d16' }}><code>curl -H "x-api-key: developer_key_123" https://roblox-information.vercel.app/api/limiteds/4217570031</code></pre>
            </div>

          </div>

          <h3>3. ตัวอย่างผลลัพธ์ที่ได้รับ (Response Examples)</h3>
          
          {/* Response Example 1: User */}
          <p><strong>3.1 ข้อมูลผู้เล่น (User Profile Response)</strong></p>
          <div className="code-window">
            <div className="code-header">
              <div className="mac-dot red"></div>
              <div className="mac-dot yellow"></div>
              <div className="mac-dot green"></div>
              <span className="code-title">GET /api/user/DTO2654</span>
            </div>
            <pre><code>
              {`{\n  `}
              <span className="json-key">"success"</span>{`: `}<span className="json-boolean">true</span>{`,\n  `}
              <span className="json-key">"data"</span>{`: {\n    `}
              <span className="json-key">"userId"</span>{`: `}<span className="json-number">4217570031</span>{`,\n    `}
              <span className="json-key">"username"</span>{`: `}<span className="json-string">"DTO2654"</span>{`,\n    `}
              <span className="json-key">"displayName"</span>{`: `}<span className="json-string">"ArthurWinterfell"</span>{`,\n    `}
              <span className="json-key">"description"</span>{`: `}<span className="json-string">""</span>{`,\n    `}
              <span className="json-key">"isBanned"</span>{`: `}<span className="json-boolean">false</span>{`,\n    `}
              <span className="json-key">"created"</span>{`: `}<span className="json-string">"2023-01-07T13:19:14.423Z"</span>{`,\n    `}
              <span className="json-key">"avatarUrl"</span>{`: `}<span className="json-string">"https://tr.rbxcdn.com/30DAY-AvatarHeadshot-...-Png/150/150/AvatarHeadshot/Png/noFilter"</span>{`,\n    `}
              <span className="json-key">"stats"</span>{`: {\n      `}
              <span className="json-key">"followers"</span>{`: `}<span className="json-number">0</span>{`,\n      `}
              <span className="json-key">"following"</span>{`: `}<span className="json-number">4</span>{`,\n      `}
              <span className="json-key">"friends"</span>{`: `}<span className="json-number">165</span>{`\n    }\n  }\n}`}
            </code></pre>
          </div>

          {/* Response Example 2: Inventory */}
          <p><strong>3.2 คลังเก็บของ (Inventory Response)</strong></p>
          <div className="code-window">
            <div className="code-header">
              <div className="mac-dot red"></div>
              <div className="mac-dot yellow"></div>
              <div className="mac-dot green"></div>
              <span className="code-title">GET /api/inventory/4217570031</span>
            </div>
            <pre><code>
              {`{\n  `}
              <span className="json-key">"success"</span>{`: `}<span className="json-boolean">true</span>{`,\n  `}
              <span className="json-key">"data"</span>{`: [\n    {\n      `}
              <span className="json-key">"assetId"</span>{`: `}<span className="json-number">119934643965525</span>{`,\n      `}
              <span className="json-key">"name"</span>{`: `}<span className="json-string">"Starwisp"</span>{`,\n      `}
              <span className="json-key">"assetType"</span>{`: `}<span className="json-string">"ShoulderAccessory"</span>{`,\n      `}
              <span className="json-key">"created"</span>{`: `}<span className="json-string">"2026-06-13T03:53:37.114Z"</span>{`\n    },\n    {\n      `}
              <span className="json-key">"assetId"</span>{`: `}<span className="json-number">607702162</span>{`,\n      `}
              <span className="json-key">"name"</span>{`: `}<span className="json-string">"Roblox Baseball Cap"</span>{`,\n      `}
              <span className="json-key">"assetType"</span>{`: `}<span className="json-string">"Hat"</span>{`,\n      `}
              <span className="json-key">"created"</span>{`: `}<span className="json-string">"2024-08-09T11:53:53.143Z"</span>{`\n    }\n  ]\n}`}
            </code></pre>
          </div>

          {/* Response Example 3: Equipped */}
          <p><strong>3.3 ไอเทมที่สวมใส่อยู่ (Equipped Items Response)</strong></p>
          <div className="code-window">
            <div className="code-header">
              <div className="mac-dot red"></div>
              <div className="mac-dot yellow"></div>
              <div className="mac-dot green"></div>
              <span className="code-title">GET /api/equipped/4217570031</span>
            </div>
            <pre><code>
              {`{\n  `}
              <span className="json-key">"success"</span>{`: `}<span className="json-boolean">true</span>{`,\n  `}
              <span className="json-key">"data"</span>{`: [\n    {\n      `}
              <span className="json-key">"id"</span>{`: `}<span className="json-number">63690008</span>{`,\n      `}
              <span className="json-key">"name"</span>{`: `}<span className="json-string">"Pal Hair"</span>{`,\n      `}
              <span className="json-key">"assetType"</span>{`: { `}<span className="json-key">"id"</span>{`: `}<span className="json-number">41</span>{`, `}<span className="json-key">"name"</span>{`: `}<span className="json-string">"HairAccessory"</span>{` }\n    },\n    {\n      `}
              <span className="json-key">"id"</span>{`: `}<span className="json-number">607702162</span>{`,\n      `}
              <span className="json-key">"name"</span>{`: `}<span className="json-string">"Roblox Baseball Cap"</span>{`,\n      `}
              <span className="json-key">"assetType"</span>{`: { `}<span className="json-key">"id"</span>{`: `}<span className="json-number">8</span>{`, `}<span className="json-key">"name"</span>{`: `}<span className="json-string">"Hat"</span>{` }\n    }\n  ]\n}`}
            </code></pre>
          </div>

          {/* Response Example 4: Limiteds */}
          <p><strong>3.4 ของสะสม Limited (Limiteds Collectibles Response)</strong></p>
          <div className="code-window">
            <div className="code-header">
              <div className="mac-dot red"></div>
              <div className="mac-dot yellow"></div>
              <div className="mac-dot green"></div>
              <span className="code-title">GET /api/limiteds/4217570031</span>
            </div>
            <pre><code>
              {`{\n  `}
              <span className="json-key">"success"</span>{`: `}<span className="json-boolean">true</span>{`,\n  `}
              <span className="json-key">"data"</span>{`: [\n    {\n      `}
              <span className="json-key">"userAssetId"</span>{`: `}<span className="json-number">123456789</span>{`,\n      `}
              <span className="json-key">"assetId"</span>{`: `}<span className="json-number">240928503</span>{`,\n      `}
              <span className="json-key">"name"</span>{`: `}<span className="json-string">"Valkyrie Helm"</span>{`,\n      `}
              <span className="json-key">"recentAveragePrice"</span>{`: `}<span className="json-number">250000</span>{`,\n      `}
              <span className="json-key">"originalPrice"</span>{`: `}<span className="json-number">50000</span>{`\n    }\n  ]\n}`}
            </code></pre>
          </div>
        </div>
      ) : (
        <>
          <form className="search-section" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className={`search-input ${error ? 'input-error' : ''}`}
            placeholder="Enter username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (error) setError(null); // Clear error on typing
            }}
            autoFocus
          />
          <Search size={20} className="search-icon-absolute" />
        </div>
        <button type="submit" className="search-button" disabled={loading}>
          {loading ? <span className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}} /> : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loader-text">Retrieving player data...</p>
        </div>
      )}

      {!loading && !userData && !error && (
        <div className="empty-state">
          <h3>No profile selected</h3>
          <p>Enter a exact Roblox username in the search bar above to view their details.</p>
        </div>
      )}

      {!loading && userData && userStats && (
        <div className="profile-card">
          <div className="profile-header">
            <div className="avatar-container">
              <img 
                src={avatarUrl || 'https://tr.rbxcdn.com/38c6edcb50633730ff4cf39ac8859840/420/420/AvatarHeadshot/Png'} 
                alt={`${userData.displayName} avatar`} 
                className="avatar" 
              />
              {userData.hasVerifiedBadge && (
                <div className="verified-badge" title="Verified Badge">
                  <ShieldCheck size={14} />
                </div>
              )}
            </div>
            
            <div className="profile-info">
              <h2>
                {userData.displayName}
              </h2>
              <p className="username">@{userData.name}</p>
              
              <div className={`status-badge ${userData.isBanned ? 'banned' : ''}`}>
                {userData.isBanned ? 'Banned' : 'Active'}
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-block">
              <div className="stat-label"><Users size={14} /> Followers</div>
              <div className="stat-value">{formatNumber(userStats.followers)}</div>
            </div>
            <div className="stat-block">
              <div className="stat-label"><UserPlus size={14} /> Following</div>
              <div className="stat-value">{formatNumber(userStats.followings)}</div>
            </div>
            <div className="stat-block">
              <div className="stat-label"><User size={14} /> Friends</div>
              <div className="stat-value">{formatNumber(userStats.friends)}</div>
            </div>
          </div>

          <div className="tabs-container">
            <button className={`tab-button ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About</button>
            {equipped && <button className={`tab-button ${activeTab === 'avatar' ? 'active' : ''}`} onClick={() => setActiveTab('avatar')}>Avatar</button>}
            {inventory && <button className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Inventory</button>}
            {collectibles && <button className={`tab-button ${activeTab === 'limiteds' ? 'active' : ''}`} onClick={() => setActiveTab('limiteds')}>Limiteds</button>}
          </div>

          <div className="tab-content">
            {activeTab === 'about' && (
              <>
                <div className="detail-section">
                  <h3>About</h3>
                  <p className="description-text">
                    {userData.description || 'No description provided.'}
                  </p>
                </div>

                <div className="detail-section">
                  <h3>Join Date</h3>
                  <p className="join-date">
                    {formatDate(userData.created)}
                  </p>
                </div>
              </>
            )}

            {activeTab === 'limiteds' && collectibles && (
              <div className="detail-section">
                <h3>Owned Limiteds ({collectibles.length})</h3>
                <div className="collectibles-grid">
                  {collectibles.map((item) => (
                    <a 
                      href={`https://www.roblox.com/catalog/${item.assetId}/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      key={item.assetId} 
                      className="collectible-card"
                    >
                      <div className="collectible-image-wrapper">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="collectible-image" />
                        ) : (
                          <div className="collectible-placeholder">No Image</div>
                        )}
                      </div>
                      <div className="collectible-info">
                        <p className="collectible-name" title={item.name}>{item.name}</p>
                        <p className="collectible-price">
                          {item.recentAveragePrice ? `R$ ${formatNumber(item.recentAveragePrice)}` : 'N/A'}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'avatar' && equipped && (
              <div className="detail-section">
                <h3>Currently Equipped ({equipped.length})</h3>
                <div className="collectibles-grid">
                  {equipped.map((item) => (
                    <a 
                      href={`https://www.roblox.com/catalog/${item.assetId}/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      key={item.assetId} 
                      className="collectible-card"
                    >
                      <div className="collectible-image-wrapper">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="collectible-image" />
                        ) : (
                          <div className="collectible-placeholder">No Image</div>
                        )}
                      </div>
                      <div className="collectible-info">
                        <p className="collectible-name" title={item.name}>{item.name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'inventory' && inventory && (
              <div className="detail-section">
                <h3>Recent Inventory Items ({inventory.length}+)</h3>
                <div className="collectibles-grid">
                  {inventory.map((item) => (
                    <a 
                      href={`https://www.roblox.com/catalog/${item.assetId}/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      key={`inv-${item.assetId}`} 
                      className="collectible-card"
                    >
                      <div className="collectible-image-wrapper">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="collectible-image" />
                        ) : (
                          <div className="collectible-placeholder">No Image</div>
                        )}
                      </div>
                      <div className="collectible-info">
                        <p className="collectible-name" title={item.name}>{item.name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default App;
