'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type UserProfile = {
  nickname: string;
  profile?: string;
  description?: string;
};

type SessionData = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  nickname?: string;
};

const defaultApiBase = 'http://localhost:8080';
const SESSION_KEY = 'gcboard.session';
const API_BASE_KEY = 'gcboard.apiBase';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const nickname = params?.nickname as string | undefined;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ profile: '', description: '' });

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSession(JSON.parse(stored));
    }
  }, []);

  const getApiBase = () => {
    return localStorage.getItem(API_BASE_KEY) || defaultApiBase;
  };

  useEffect(() => {
    if (!nickname) return;
    loadProfile();
  }, [nickname]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = getApiBase();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (session?.accessToken) {
        const prefix = (session.tokenType || 'Bearer').trim();
        headers.Authorization = `${prefix} ${session.accessToken}`;
      }
      const res = await fetch(`${base.replace(/\/+$/, '')}/user/profile/${encodeURIComponent(nickname!)}`, {
        headers,
      });
      if (!res.ok) throw new Error(await res.text() || res.statusText);
      const data = await res.json();
      setProfile(data);
      setEditData({ profile: data.profile || '', description: data.description || '' });
    } catch (err: any) {
      setError(err?.message || '프로필을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session || !profile) return;
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.tokenType} ${session.accessToken}`,
        },
        body: JSON.stringify({
          nickname: profile.nickname,
          profile: editData.profile || null,
          description: editData.description || null,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || '프로필 업데이트 실패');
      }
      await loadProfile();
      setIsEditing(false);
      alert('프로필이 업데이트되었습니다.');
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다.');
    }
  };

  const isOwnProfile = session?.nickname === nickname;

  return (
    <div className="page profile-page">
      <header className="topbar">
        <button className="pill ghost" type="button" onClick={() => router.back()}>
          ← 뒤로
        </button>
        <h1 style={{ marginLeft: 12 }}>프로필</h1>
      </header>
      <main>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 12px' }}>
          {loading && <p className="muted">불러오는 중...</p>}
          {error && <p className="muted">{error}</p>}
          {!loading && !error && profile && (
            <div
              style={{
                background: '#ffffff',
                width: 'min(720px, 96%)',
                borderRadius: 12,
                boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                padding: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ flex: '0 0 auto' }}>
                  {profile.profile ? (
                    <img
                      src={profile.profile}
                      alt={`${profile.nickname} 프로필`}
                      style={{ width: 120, height: 120, borderRadius: 60, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 48,
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      {profile.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 24 }}>{profile.nickname}</h2>
                  <p style={{ marginTop: 8, color: '#6b7280' }}>
                    {profile.description || '자기소개가 없습니다.'}
                  </p>
                </div>
              </div>

              {isOwnProfile && (
                <div>
                  <button 
                    className="btn primary" 
                    onClick={() => setIsEditing(!isEditing)}
                    style={{ marginBottom: 16 }}
                  >
                    {isEditing ? '편집 취소' : '프로필 변경'}
                  </button>

                  {isEditing && (
                    <div style={{ 
                      background: '#f9fafb', 
                      padding: 20, 
                      borderRadius: 8,
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: 16 }}>프로필 편집</h3>
                      
                      <label style={{ display: 'block', marginBottom: 16 }}>
                        <span style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                          프로필 이미지 URL
                        </span>
                        <input
                          type="text"
                          value={editData.profile}
                          onChange={(e) => setEditData({ ...editData, profile: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            borderRadius: 6, 
                            border: '1px solid #d1d5db',
                            fontSize: 14
                          }}
                        />
                      </label>

                      <label style={{ display: 'block', marginBottom: 20 }}>
                        <span style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                          자기소개
                        </span>
                        <textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          rows={4}
                          placeholder="자기소개를 입력하세요..."
                          style={{ 
                            width: '100%', 
                            padding: '10px 12px', 
                            borderRadius: 6, 
                            border: '1px solid #d1d5db',
                            fontSize: 14,
                            fontFamily: 'inherit',
                            resize: 'vertical'
                          }}
                        />
                      </label>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn primary" onClick={handleSave}>
                          저장
                        </button>
                        <button className="pill ghost" onClick={() => {
                          setIsEditing(false);
                          setEditData({ profile: profile.profile || '', description: profile.description || '' });
                        }}>
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
