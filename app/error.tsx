'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>문제가 발생했습니다</h2>
      <p style={{ color: '#6b7280', margin: '16px 0' }}>{error.message}</p>
      <button
        onClick={reset}
        style={{
          padding: '8px 18px',
          borderRadius: '999px',
          border: '1px solid rgba(0,0,0,0.1)',
          background: '#22b8cf',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: '600',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
