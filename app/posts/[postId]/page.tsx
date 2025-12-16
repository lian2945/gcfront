'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamic import to prevent SSR issues
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

const API_BASE_KEY = 'gcboard.apiBase';
const SESSION_KEY = 'gcboard.session';

type SessionData = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  nickname?: string;
};

type PostDetail = {
  postId: string;
  title: string;
  content: string;
  authorNickname: string;
  createdAt: string;
  likeCount: number;
  liked?: boolean;
  acceptedCommentId?: string;
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

const defaultApiBase = 'https://dongwook-server.jaehwan.kr';

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSession(JSON.parse(stored));
    }
  }, []);

  const getApiBase = () => {
    return defaultApiBase;
  };

  const loadPost = async () => {
    try {
      const apiBase = getApiBase();
      const headers: HeadersInit = {};
      if (session?.accessToken) {
        headers.Authorization = `${session.tokenType} ${session.accessToken}`;
      }

      const res = await fetch(`${apiBase}/posts/${postId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      }
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/posts/${postId}/comments?count=100`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.content || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  useEffect(() => {
    loadPost();
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, session]);

  const handleLike = async () => {
    if (!session) return;
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/posts/${postId}/likes`, {
        method: 'POST',
        headers: {
          Authorization: `${session.tokenType} ${session.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPost(prev => prev ? { ...prev, liked: data.liked, likeCount: data.likeCount } : null);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleAcceptComment = async (commentId: number | string) => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/posts/${postId}/comments/${commentId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.tokenType} ${session.accessToken}`,
        },
      });

      if (res.ok) {
        await loadPost();
        await loadComments();
        alert('댓글이 채택되었습니다.');
      } else {
        const errorText = await res.text();
        console.error('Accept failed:', res.status, errorText);
        alert(`댓글 채택에 실패했습니다. (${res.status}): ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to accept comment:', error);
      alert('댓글 채택 중 오류가 발생했습니다: ' + error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!commentContent.trim()) {
      alert('댓글 내용을 입력하세요.');
      return;
    }
    try {
      const apiBase = getApiBase();
      const url = replyTo
        ? `${apiBase}/posts/${postId}/comments?parent_comment_id=${replyTo}`
        : `${apiBase}/posts/${postId}/comments`;

      console.log('Submitting comment to:', url);
      console.log('Content:', commentContent);
      console.log('ReplyTo:', replyTo);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${session.tokenType} ${session.accessToken}`,
        },
        body: JSON.stringify({ content: commentContent }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Comment created:', data);
        setCommentContent('');
        setReplyTo(null);
        await loadComments();
        alert('댓글이 작성되었습니다.');
      } else {
        const errorText = await res.text();
        console.error('Comment submit failed:', res.status, errorText);
        alert(`댓글 작성에 실패했습니다. (${res.status}): ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      alert('댓글 작성 중 오류가 발생했습니다: ' + error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!post) {
    return <div className="error">Post not found</div>;
  }

  return (
    <div className="post-detail-page">
      <button onClick={() => router.push('/')} className="back-button">
        ← 목록으로
      </button>

      <div className="post-detail-container">
        <h1 className="detail-title">{post.title}</h1>

        <div className="detail-meta-row">
          <div className="author-info">
            <div className="author-avatar-circle">
              {post.authorNickname.charAt(0).toUpperCase()}
            </div>
            <div className="author-details">
              <span className="author-nickname">{post.authorNickname}</span>
              <span className="post-date">{new Date(post.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <button
            className={`detail-like-button ${post.liked ? 'liked' : ''}`}
            onClick={handleLike}
            disabled={!session}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 21s-7.5-4.2-7.5-9.5S10.2 3 12 5.5C13.8 3 19.5 3.5 19.5 11.5S12 21 12 21z"
                fill={post.liked ? '#ff6b81' : 'none'}
              />
            </svg>
            <span>{post.likeCount}</span>
          </button>
        </div>

        <div className="post-content markdown-body">
          <ReactMarkdown>
            {post.content}
          </ReactMarkdown>
        </div>
      </div>

      <div className="comments-section">
        <h2 className="comments-title">댓글 {comments.length}</h2>

        {session && (
          <div className="comment-form">
            {replyTo && (
              <div className="reply-indicator">
                <span>💬 답글 작성 중</span>
                <button onClick={() => setReplyTo(null)} className="cancel-reply">✕</button>
              </div>
            )}
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder={replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
              className="comment-input"
              rows={3}
            />
            <button onClick={handleCommentSubmit} className="comment-submit">
              {replyTo ? '답글 작성' : '댓글 작성'}
            </button>
          </div>
        )}

        <div className="comments-list">
          {comments.map((comment) => (
            <div
              key={comment.commentId}
              className={`comment-item depth-${comment.depth}`}
              style={{ marginLeft: `${comment.depth * 20}px` }}
            >
              <div className="comment-header">
                <div className="comment-avatar-circle">
                  {comment.isDeleted ? '?' : comment.authorNickname?.charAt(0).toUpperCase()}
                </div>
                <div className="comment-author-info">
                  <span className="comment-author">
                    {comment.isDeleted ? '삭제된 댓글' : comment.authorNickname}
                  </span>
                  <span className="comment-date">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                {comment.commentId === post.acceptedCommentId && (
                  <span className="accepted-badge">✓ 채택됨</span>
                )}
              </div>
              <div className="comment-content">{comment.content}</div>
              <div className="comment-actions">
                {session && post.authorNickname === session.nickname && 
                 !comment.isDeleted && 
                 comment.depth === 0 && 
                 !post.acceptedCommentId && (
                  <button
                    onClick={() => handleAcceptComment(comment.commentId)}
                    className="accept-button"
                  >
                    채택하기
                  </button>
                )}
                {session && !comment.isDeleted && comment.depth === 0 && (
                  <button
                    onClick={() => {
                      const targetId = String(comment.commentId);
                      console.log('Setting replyTo:', targetId);
                      setReplyTo(replyTo === targetId ? null : targetId);
                    }}
                    className="reply-button"
                  >
                    {replyTo === String(comment.commentId) ? '답글 취소' : '답글'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
