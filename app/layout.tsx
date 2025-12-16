import './globals.css';

export const metadata = {
  title: 'GC Board',
  description: 'Next 기반 GC 게시판 클라이언트',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
