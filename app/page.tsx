'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import JSONBigInt from 'json-bigint';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const API_BASE_KEY = 'gcboard.apiBase';
const SESSION_KEY = 'gcboard.session';
const JSON_BIGINT = JSONBigInt({ storeAsString: true });

type SessionData = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  nickname?: string;
};

type PostSummary = {
  postId: string;
  title: string;
  authorNickname: string;
  createdAt: string;
  likeCount: number;
  liked?: boolean;
};

type PostDetail = PostSummary & {
  content: string;
  acceptedCommentId?: string;
  liked?: boolean;
};

type CommentItem = {
  commentId: string;
  depth: number;
  content: string;
  authorNickname?: string;
  isDeleted: boolean;
  path: string;
  createdAt: string;
};

type CursorState = {
  lastReadAt?: string;
  count: number;
  hasMore: boolean;
};

type CommentCursor = {
  cursorPath: string;
  count: number;
  hasMore: boolean;
};

type SearchCursor = {
  lastReadAt?: string;
  count: number;
  hasMore: boolean;
};

type SearchState = {
  keyword: string;
  cursor: SearchCursor;
};

type UserProfile = {
  nickname: string;
  profile?: string;
  description?: string;
};

type SearchLoadOptions = {
  keyword: string;
  reset?: boolean;
};

type ToastItem = {
  id: number;
  message: string;
  variant: 'success' | 'error';
};

const defaultApiBase = 'http://localhost:8080';

const createInitialCursor = (): CursorState => ({
  count: 10,
  hasMore: true,
});

const createInitialCommentCursor = (): CommentCursor => ({
  cursorPath: '',
  count: 15,
  hasMore: true,
});

const createInitialSearchCursor = (): SearchCursor => ({
  count: 10,
  hasMore: true,
});

const loadStoredSession = (): SessionData | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

async function request(
  path: string,
  session: SessionData | null,
  base: string,
  options: any = {},
) {
  const url = new URL(path, base);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const activeSession = session ?? loadStoredSession();
  if (activeSession?.accessToken) {
    const prefix = (activeSession.tokenType || 'Bearer').trim();
    headers.Authorization = `${prefix} ${activeSession.accessToken}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  const data = text ? JSON_BIGINT.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(message ?? '알 수 없는 오류');
  }
  return data;
}

// apiFetch: request와 동일한 동작을 하지만 options의 body에 대해 any를 허용하여
// TS 컴파일 오류를 피합니다. 기존 request는 그대로 유지됩니다.
async function apiFetch(path: string, session: SessionData | null, base: string, options: any = {}) {
  const url = new URL(path, base);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const activeSession = session ?? loadStoredSession();
  if (activeSession?.accessToken) {
    const prefix = (activeSession.tokenType || 'Bearer').trim();
    headers.Authorization = `${prefix} ${activeSession.accessToken}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  const data = text ? JSON_BIGINT.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText;
    throw new Error(message ?? '알 수 없는 오류');
  }
  return data;
}

export default function Page() {
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [session, setSession] = useState<SessionData | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postCursor, setPostCursor] = useState<CursorState>(createInitialCursor);
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentCursor, setCommentCursor] = useState<CommentCursor>(createInitialCommentCursor);
  const [commentParentId, setCommentParentId] = useState('');
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<PostSummary[]>([]);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const searchRef = useRef<SearchState | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signupData, setSignupData] = useState({
    mail: '',
    nickname: '',
    password: '',
    profile: '',
    description: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isLikeBusy, setIsLikeBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', content: '' });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [viewingProfileNickname, setViewingProfileNickname] = useState<string | null>(null);
  const [viewingProfileData, setViewingProfileData] = useState<UserProfile | null>(null);
  const [isProfileViewerLoading, setIsProfileViewerLoading] = useState(false);
  const postCursorRef = useRef<CursorState>(postCursor);
  const commentCursorRef = useRef<CommentCursor>(commentCursor);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? Number(BigInt('0x' + crypto.randomUUID().replace(/-/g, '')))
        : Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const syncPostCursor = (next: CursorState) => {
    postCursorRef.current = next;
    setPostCursor(next);
  };

  const syncCommentCursor = (next: CommentCursor) => {
    commentCursorRef.current = next;
    setCommentCursor(next);
  };

  const loadPosts = useCallback(
    async (reset = false) => {
      const cursor = reset ? createInitialCursor() : postCursorRef.current;
      try {
        const query: Record<string, string | number> = { count: cursor.count };
        if (cursor.lastReadAt) {
          query.lastReadAt = cursor.lastReadAt;
        }
        const data = await apiFetch('/posts', session, apiBase, { query });
        const loaded: PostSummary[] = data.content;
        setPosts((prev) => (reset ? loaded : [...prev, ...loaded]));
        const newLast = loaded.length ? loaded[loaded.length - 1].createdAt : cursor.lastReadAt;
        const nextCursor = {
          count: cursor.count,
          lastReadAt: newLast,
          hasMore: !data.last,
        };
        syncPostCursor(nextCursor);
      } catch (error) {
        addToast(error instanceof Error ? error.message : '피드 불러오기 실패', 'error');
      }
    },
    [apiBase, session, addToast],
  );

  const loadComments = useCallback(
    async (reset = false, parentFilter?: string) => {
      if (!session || !selectedPost) return;
      const cursor = reset ? createInitialCommentCursor() : commentCursorRef.current;
      try {
        const query: Record<string, string | number | undefined> = {
          count: cursor.count,
          cursorPath: cursor.cursorPath || undefined,
          parent_comment_id: parentFilter,
        };
        const data = await apiFetch(`/posts/${selectedPost.postId}/comments`, session, apiBase, { query });
        setComments((prev) => (reset ? data.content : [...prev, ...data.content]));
        const nextCursor = {
          count: cursor.count,
          cursorPath: data.content.length ? data.content[data.content.length - 1].path : cursor.cursorPath,
          hasMore: !data.last,
        };
        syncCommentCursor(nextCursor);
      } catch (error) {
        addToast(error instanceof Error ? error.message : '댓글 불러오기 실패', 'error');
      }
    },
    [apiBase, session, selectedPost, addToast],
  );

  const loadProfile = useCallback(async () => {
    if (!session) {
      return;
    }
    setProfileLoading(true);
    try {
      const data = await apiFetch('/user/profile', session, apiBase);
      setProfileData(data);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.', 'error');
    } finally {
      setProfileLoading(false);
    }
  }, [apiBase, session, addToast]);

  const openUserProfile = useCallback(
    async (nickname?: string | null) => {
      if (!nickname) return;
      if (!session) {
        addToast('로그인이 필요한 기능입니다.', 'error');
        return;
      }
      setViewingProfileNickname(nickname);
      setViewingProfileData(null);
      setIsProfileViewerLoading(true);
      try {
        const data = await apiFetch(`/user/profile/${nickname}`, session, apiBase);
        setViewingProfileData(data);
      } catch (error) {
        setViewingProfileData(null);
        setViewingProfileNickname(null);
        addToast(error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.', 'error');
      } finally {
        setIsProfileViewerLoading(false);
      }
    },
    [apiBase, session, addToast],
  );

  const closeProfileViewer = () => {
    setViewingProfileNickname(null);
    setViewingProfileData(null);
    setIsProfileViewerLoading(false);
  };

  const sendVerificationEmail = async () => {
    if (!signupData.mail || !signupData.nickname) {
      addToast('이메일과 닉네임을 입력해 주세요.', 'error');
      return;
    }
    try {
      await apiFetch('/auth/email/send', null, apiBase, ({ method: 'POST', body: { mail: signupData.mail, nickname: signupData.nickname } } as any));
      setCodeSent(true);
      setVerified(false);
      addToast('인증 코드가 발송되었습니다.');
    } catch (error) {
      addToast(error instanceof Error ? error.message : '인증 코드 발송 실패', 'error');
    }
  };

  const verifyEmail = async () => {
    if (!verificationCode) {
      addToast('인증 코드를 입력해주세요.', 'error');
      return;
    }
    try {
      await apiFetch('/auth/email/verify', null, apiBase, ({ method: 'POST', body: { code: verificationCode } } as any));
      setVerified(true);
      addToast('이메일 인증이 완료되었습니다.');
    } catch (error) {
      addToast(error instanceof Error ? error.message : '인증 실패', 'error');
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signupData.mail || !signupData.nickname || !signupData.password || !verificationCode) {
      addToast('필수 정보를 모두 입력해 주세요.', 'error');
      return;
    }
    try {
      await apiFetch('/auth/signup', null, apiBase, {
        method: 'POST',
        body: {
          mailVerificationCode: verificationCode,
          password: signupData.password,
          nickname: signupData.nickname,
          profile: signupData.profile || null,
          description: signupData.description || null,
        },
      });
      addToast('회원가입이 완료되었습니다.');
      setSignupData({ mail: '', nickname: '', password: '', profile: '', description: '' });
      setVerificationCode('');
      setCodeSent(false);
      closeSignupModal();
    } catch (error) {
      addToast(error instanceof Error ? error.message : '회원가입 실패', 'error');
    }
  };

  const loadSearchResults = useCallback(
    async ({ keyword, reset = false }: SearchLoadOptions) => {
      if (!session) {
        addToast('로그인이 필요합니다.', 'error');
        return;
      }
      const cleanKeyword = keyword.trim();
      if (!cleanKeyword) {
        addToast('검색어를 입력하세요.', 'error');
        return;
      }

      setSearchLoading(true);
      try {
        const previous = searchRef.current;
        const shouldReset = reset || !previous || previous.keyword !== cleanKeyword;
        const cursor = shouldReset ? createInitialSearchCursor() : previous.cursor;
        const query: Record<string, string | number | undefined> = {
          keyword: cleanKeyword,
          count: cursor.count,
        };
        if (cursor.lastReadAt) {
          query.lastReadAt = cursor.lastReadAt;
        }
        const data = await apiFetch('/posts/search', session, apiBase, { query });
        const loaded: PostSummary[] = data.content;
        const nextCursor = {
          count: cursor.count,
          lastReadAt: loaded.length ? loaded[loaded.length - 1].createdAt : cursor.lastReadAt,
          hasMore: !data.last,
        };
        const nextState = { keyword: cleanKeyword, cursor: nextCursor };
        searchRef.current = nextState;
        setSearchState(nextState);
        setSearchResults((prev) => (shouldReset ? loaded : [...prev, ...loaded]));
      } catch (error) {
        addToast(error instanceof Error ? error.message : '검색에 실패했습니다.', 'error');
      } finally {
        setSearchLoading(false);
      }
    },
    [apiBase, session, addToast],
  );

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadSearchResults({ keyword: searchInput, reset: true });
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearchResults([]);
    setSearchState(null);
    searchRef.current = null;
  };

  const handleSearchMore = () => {
    if (!searchRef.current?.cursor.hasMore) return;
    loadSearchResults({ keyword: searchRef.current.keyword });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedBase = localStorage.getItem(API_BASE_KEY);
    if (storedBase) {
      setApiBase(storedBase);
    }
    const storedSession = loadStoredSession();
    if (storedSession) {
      setSession(storedSession);
    }
  }, []);

  useEffect(() => {
    loadPosts(true);
  }, [loadPosts]);

  useEffect(() => {
    if (selectedPost && session) {
      loadComments(true);
    } else {
      setComments([]);
    }
  }, [selectedPost, session, loadComments]);

  useEffect(() => {
    if (session) {
      loadProfile();
    } else {
      setProfileData(null);
    }
  }, [session, loadProfile]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isProfileMenuOpen) return;
      const targetNode = event.target as Node;
      if (
        profileMenuRef.current?.contains(targetNode) ||
        profileButtonRef.current?.contains(targetNode)
      ) {
        return;
      }
      setIsProfileMenuOpen(false);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [isProfileMenuOpen]);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const openCreatePost = () => {
    if (!session) {
      addToast('로그인이 필요한 기능입니다.', 'error');
      openLoginModal();
      return;
    }
    setIsCreatePostOpen(true);
  };

  const closeCreatePost = () => {
    setIsCreatePostOpen(false);
    setNewPost({ title: '', content: '' });
  };

  const submitCreatePost = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    if (!session) {
      addToast('로그인이 필요한 기능입니다.', 'error');
      return;
    }
    const title = newPost.title.trim();
    const content = newPost.content.trim();
    if (!title || !content) {
      addToast('제목과 본문을 모두 입력해 주세요.', 'error');
      return;
    }
    try {
      const base = (apiBase || defaultApiBase).replace(/\/+$/, '');
      const url = new URL('/posts', base).toString();
      const activeSession = session ?? loadStoredSession();
      const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      if (activeSession?.accessToken) {
        const prefix = (activeSession.tokenType || 'Bearer').trim();
        headers.Authorization = `${prefix} ${activeSession.accessToken}`;
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ title, content }) });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      addToast('게시글이 등록되었습니다.');
      closeCreatePost();
      window.location.reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : '게시글 등록 실패', 'error');
    }
  };

  const persistSession = (next: SessionData | null) => {
    setSession(next);
    if (typeof window === 'undefined') return;
    if (next) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nickname = formData.get('nickname') as string;
    const password = formData.get('password') as string;
    try {
      const data = await apiFetch('/auth/login', session, apiBase, ({ method: 'POST', body: { nickname, password } } as any));
      persistSession({ ...data, nickname });
      addToast('로그인 성공');
      closeLoginModal();
    } catch (error) {
      addToast(error instanceof Error ? error.message : '로그인 실패', 'error');
    }
  };

  const handleLogout = () => {
    persistSession(null);
    addToast('로그아웃 됨');
  };

  const openSignupModal = () => {
    setIsSignupModalOpen(true);
    setCodeSent(false);
    setVerificationCode('');
  };

  const closeSignupModal = () => {
    setIsSignupModalOpen(false);
  };

  const handleSignupInput =
    (field: keyof typeof signupData) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setSignupData((prev) => ({ ...prev, [field]: value }));
    };

  const loadPostDetail = async (postId: string) => {
    try {
      const data = await apiFetch(`/posts/${postId}`, session, apiBase);
      setSelectedPost(data);
      setIsEditing(false);
      syncCommentCursor(createInitialCommentCursor());
      setCommentParentId('');
      setPostForm({ title: data.title, content: data.content });
    } catch (error) {
      addToast(error instanceof Error ? error.message : '게시글 상세 실패', 'error');
    }
  };

  const toggleLike = async () => {
    if (!session) {
      addToast('로그인이 필요한 기능입니다.', 'error');
      return;
    }
    if (!selectedPost) return;
    if (isLikeBusy) return;
    setIsLikeBusy(true);
    try {
      const data = await apiFetch(`/posts/${selectedPost.postId}/likes`, session, apiBase, ({ method: 'POST' } as any));
      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              likeCount: data.likeCount,
              liked: data.liked,
            }
          : prev,
      );
      setPosts((prev) =>
        prev.map((post) =>
          post.postId === selectedPost.postId ? { ...post, likeCount: data.likeCount, liked: data.liked } : post,
        ),
      );
      addToast(data.liked ? '좋아요 했어요' : '좋아요를 취소했어요');
    } catch (error) {
      addToast(error instanceof Error ? error.message : '좋아요 처리 실패', 'error');
    } finally {
      setIsLikeBusy(false);
    }
  };

  const startEditPost = () => {
    if (!selectedPost) return;
    setPostForm({ title: selectedPost.title, content: selectedPost.content });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (selectedPost) {
      setPostForm({ title: selectedPost.title, content: selectedPost.content });
    }
  };

  const submitEditPost = async () => {
    if (!selectedPost || !session) return;
    const trimmedTitle = postForm.title.trim();
    const trimmedContent = postForm.content.trim();
    if (!trimmedTitle || !trimmedContent) {
      addToast('제목과 본문을 모두 채워주세요.', 'error');
      return;
    }
    try {
      await apiFetch(`/posts/${selectedPost.postId}`, session, apiBase, ({ method: 'PATCH', body: { title: trimmedTitle, content: trimmedContent } } as any));
      addToast('게시글이 수정되었습니다.');
      setIsEditing(false);
      loadPostDetail(selectedPost.postId);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '수정 실패', 'error');
    }
  };

  const deletePost = async () => {
    if (!selectedPost || !session) return;
    if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
    try {
      await apiFetch(`/posts/${selectedPost.postId}`, session, apiBase, ({ method: 'DELETE' } as any));
      addToast('게시글이 삭제되었습니다.');
      setSelectedPost(null);
      loadPosts(true);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '삭제 실패', 'error');
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !selectedPost) return;
    const formData = new FormData(event.currentTarget);
    const content = (formData.get('content') as string) ?? '';
    if (!content.trim()) {
      addToast('댓글을 입력하세요', 'error');
      return;
    }
    try {
      const parentQuery = commentParentId ? `?parent_comment_id=${encodeURIComponent(commentParentId)}` : '';
      await apiFetch(`/posts/${selectedPost.postId}/comments${parentQuery}`, session, apiBase, ({ method: 'POST', body: { content } } as any));
      addToast('댓글 등록됨');
      setCommentParentId('');
      loadComments(true);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '댓글 등록 실패', 'error');
    }
  };

  const acceptComment = async (commentId: string) => {
    if (!session || !selectedPost) return;
    try {
      await apiFetch(`/posts/${selectedPost.postId}/comments/${commentId}/accept`, session, apiBase, ({ method: 'POST' } as any));
      setSelectedPost((prev) => (prev ? { ...prev, acceptedCommentId: commentId } : prev));
      addToast('댓글 채택 완료');
      loadComments(true);
    } catch (error) {
      addToast(error instanceof Error ? error.message : '채택 실패', 'error');
    }
  };

  const isOwner = useMemo(() => {
    return session?.nickname && selectedPost?.authorNickname === session.nickname;
  }, [session, selectedPost]);

  const searchHasMore = searchState?.cursor.hasMore ?? false;

  const orderedComments = useMemo(() => {
    const acceptedId = selectedPost?.acceptedCommentId;
    if (!acceptedId) return comments;

    const accepted = comments.find((item) => item.commentId === acceptedId);
    if (!accepted) return comments;

    const prefix = `${accepted.path}/`;
    const acceptedGroup: CommentItem[] = [];
    const others: CommentItem[] = [];

    comments.forEach((item) => {
      if (item.commentId === accepted.commentId || item.path.startsWith(prefix)) {
        acceptedGroup.push(item);
      } else {
        others.push(item);
      }
    });

    return acceptedGroup.length ? [...acceptedGroup, ...others] : comments;
  }, [comments, selectedPost?.acceptedCommentId]);

  const renderPostCard = (post: PostSummary, variant?: 'search') => {
    const isActive = selectedPost?.postId === post.postId;
    const cardClass = clsx('post-card', variant === 'search' && 'search-card', isActive && 'active');
    return (
      <article key={`${variant ?? 'feed'}-${post.postId}`} className={cardClass} onClick={() => router.push(`/posts/${post.postId}`)}>
        <div className="post-card-head">
          <div className="post-card-title-row">
            <h3>{post.title}</h3>
            <div className={clsx('post-like-badge', { active: post.liked })}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M12 21s-7.5-4.2-7.5-9.5S10.2 3 12 5.5C13.8 3 19.5 3.5 19.5 11.5S12 21 12 21z"
                  fill={post.liked ? '#ff6b81' : 'none'}
                />
              </svg>
              <span>{post.likeCount}</span>
            </div>
          </div>
          <div className="post-card-meta">
            <div className="author-badge">
              <span className="author-avatar">{post.authorNickname.charAt(0).toUpperCase()}</span>
              <button
                type="button"
                className="link-button post-author-link"
                onClick={(event) => {
                  event.stopPropagation();
                  openUserProfile(post.authorNickname);
                }}
              >
                {post.authorNickname}
              </button>
            </div>
            <span className="divider">·</span>
            <time className="post-time">{new Date(post.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="page">
      <header className="topbar">
          <div>
            <p className="eyebrow">GC Board</p>
            <h1>GC-BOARD-REFACTORING</h1>
            <p className="lede">
              근찬쌤의 게시물을 보다 멋지게 빠르게,
            </p>
            <p className="lede">
              GC-BOARD-REFACTORING 입니다.
            </p>
          </div>
      <div className="top-actions">
        {!session && (
          <button className="pill primary" type="button" onClick={openLoginModal}>
            로그인
          </button>
        )}
        {session && (
          <>
            <button className="pill primary" type="button" onClick={openCreatePost}>
              글쓰기
            </button>
            <div className="profile-pill">
            <button
              type="button"
              ref={profileButtonRef}
              className="profile-avatar-pill"
              onClick={() => {
                setIsProfileMenuOpen((prev) => {
                  const next = !prev;
                  if (!next) {
                    setShowProfileCard(false);
                  }
                  return next;
                });
              }}
            >
              {profileData?.profile ? (
                <Image
                  src={profileData.profile}
                  alt={`${session.nickname} 프로필`}
                  width={36}
                  height={36}
                  className="profile-avatar-img"
                />
              ) : (
                <span>{session.nickname?.charAt(0).toUpperCase()}</span>
              )}
            </button>
            {isProfileMenuOpen && (
              <div className="profile-menu" ref={profileMenuRef}>
                {showProfileCard && (
                  <div className="profile-card-mini">
                    {profileLoading ? (
                      <p className="muted">불러오는 중...</p>
                    ) : profileData ? (
                      <>
                        <p className="profile-nickname">{profileData.nickname}</p>
                        <p className="profile-description">{profileData.description || '자기소개가 없습니다.'}</p>
                      </>
                    ) : (
                      <p className="muted">프로필 정보 없음</p>
                    )}
                  </div>
                )}
                <button
                  className="pill ghost"
                  type="button"
                  onClick={() => {
                    // 메뉴 닫고 프로필 페이지로 이동
                    setIsProfileMenuOpen(false);
                    setShowProfileCard(false);
                    if (session?.nickname) {
                      router.push(`/profile/${encodeURIComponent(session.nickname)}`);
                    }
                  }}
                >
                  내 프로필
                </button>
                <button
                  className="pill ghost"
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setIsProfileMenuOpen(false);
                    setShowProfileCard(false);
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </div>
      </header>

      <section className="content-area">
        <div className="feed-panel panel">
          <div className="search-row">
            <form onSubmit={handleSearchSubmit} className="search-form">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="게시물을 키워드로 검색해보세요."
              />
              <div className="search-actions">
                <button className="btn primary" type="submit" disabled={searchLoading}>
                  {searchLoading ? '검색 중...' : '검색'}
                </button>
                {searchState && (
                  <button className="pill ghost" type="button" onClick={handleSearchClear}>
                    검색 종료
                  </button>
                )}
              </div>
            </form>
          </div>
          {searchState && (
            <div className="search-results">
              <div className="search-results-head">
                <p className="eyebrow">&ldquo;{searchState.keyword}&rdquo; 검색 결과</p>
                <span className="muted">{searchResults.length ? `${searchResults.length}건` : '결과 없음'}</span>
              </div>
              {searchResults.length ? (
                <div className="search-grid">
                  {searchResults.map((post) => renderPostCard(post, 'search'))}
                </div>
              ) : (
                <p className="muted">검색 결과가 없습니다.</p>
              )}
              {searchHasMore && (
                <div className="actions search-actions">
                  <button className="btn ghost" type="button" onClick={handleSearchMore} disabled={searchLoading}>
                    더 보기
                  </button>
                </div>
              )}
            </div>
          )}
          {!searchState && (
            <div className="post-grid-wrapper">
              <div className="post-grid">
                {posts.map((post) => renderPostCard(post))}
              </div>
              <div className="load-more-row">
                <button className="btn ghost" type="button" onClick={() => loadPosts(false)} disabled={!postCursor.hasMore}>
                  더 보기
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {isLoginModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeLoginModal}>
          <div className="signup-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>로그인</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={closeLoginModal}
                aria-label="로그인 창 닫기"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLogin} className="signup-form">
              <label>
                닉네임
                <input name="nickname" placeholder="닉네임" required />
              </label>
              <label>
                비밀번호
                <input name="password" type="password" placeholder="비밀번호" required />
              </label>
              <div className="auth-modal-actions">
                <button className="btn primary" type="submit">
                  로그인
                </button>
              </div>
              <p className="login-hint">
                회원이 아니신가요?
                <button className="link-button" type="button" onClick={() => { closeLoginModal(); openSignupModal(); }}>
                  회원가입
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
      {isSignupModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeSignupModal}>
          <div className="signup-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>회원가입</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={closeSignupModal}
                aria-label="회원가입 창 닫기"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSignup} className="signup-form">
              <label>
                이메일
                <input
                  type="email"
                  value={signupData.mail}
                  onChange={handleSignupInput('mail')}
                  placeholder="example@domain.com"
                  required
                />
              </label>
              <label>
                닉네임
                <input
                  value={signupData.nickname}
                  onChange={handleSignupInput('nickname')}
                  placeholder="사용할 닉네임"
                  required
                />
              </label>
              <div className="verification-row">
                <button
                  type="button"
                  className="pill ghost"
                  onClick={sendVerificationEmail}
                  disabled={!signupData.mail || !signupData.nickname}
                >
                  인증 코드 받기
                </button>
                {codeSent && <span className="verification-status">코드가 이메일로 전송되었습니다.</span>}
              </div>
              <label>
                인증 코드
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="이메일로 받은 6자리 코드"
                  required
                />
              </label>
              <label>
                비밀번호
                <input
                  type="password"
                  value={signupData.password}
                  onChange={handleSignupInput('password')}
                  placeholder="8자 이상"
                  required
                />
              </label>
              <label>
                프로필 이미지 URL (선택)
                <input
                  value={signupData.profile}
                  onChange={handleSignupInput('profile')}
                  placeholder="https://"
                />
              </label>
              <label>
                자기소개 (선택)
                <textarea
                  rows={3}
                  value={signupData.description}
                  onChange={handleSignupInput('description')}
                  placeholder="간단한 소개를 적어주세요."
                />
              </label>
              <div className="modal-actions">
                <button className="btn primary" type="submit">
                  가입하기
                </button>
                <button className="pill ghost" type="button" onClick={closeSignupModal}>
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {viewingProfileNickname && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeProfileViewer}>
          <div className="profile-viewer-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>{viewingProfileNickname}님의 프로필</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={closeProfileViewer}
                aria-label="프로필 창 닫기"
              >
                ✕
              </button>
            </div>
            <div className="profile-viewer-body">
              {isProfileViewerLoading && <p className="muted">불러오는 중...</p>}
              {!isProfileViewerLoading && viewingProfileData && (
                <div className="profile-viewer-content">
                  {viewingProfileData.profile ? (
                    <Image
                      src={viewingProfileData.profile}
                      alt={`${viewingProfileData.nickname} 프로필`}
                      width={60}
                      height={60}
                      className="profile-viewer-avatar"
                    />
                  ) : (
                    <div className="profile-viewer-avatar fallback-avatar">
                      {viewingProfileData.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="profile-viewer-meta">
                    <p className="profile-viewer-nickname">{viewingProfileData.nickname}</p>
                    <p className="profile-viewer-description">
                      {viewingProfileData.description || '자기소개가 등록되지 않았습니다.'}
                    </p>
                  </div>
                </div>
              )}
              {!isProfileViewerLoading && !viewingProfileData && (
                <p className="muted">프로필을 불러오지 못했습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {isCreatePostOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeCreatePost}>
          <div className="signup-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>새 게시글 작성</h3>
              <button type="button" className="icon-btn" onClick={closeCreatePost} aria-label="작성 창 닫기">✕</button>
            </div>
            <form onSubmit={submitCreatePost} className="signup-form">
              <label>
                제목
                <input value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: (e.target as HTMLInputElement).value }))} placeholder="제목을 입력하세요" required />
              </label>
              <label>
                본문
                <textarea rows={6} value={newPost.content} onChange={(e) => setNewPost((p) => ({ ...p, content: (e.target as HTMLTextAreaElement).value }))} placeholder="본문을 입력하세요" required />
              </label>
              <div className="auth-modal-actions">
                <button className="btn primary" type="submit">등록</button>
                <button className="pill ghost" type="button" onClick={closeCreatePost}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="toast-wrapper">
        {toasts.map((toast) => (
          <div key={toast.id} className={clsx('toast', toast.variant)}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
