import './globals.css';

export const metadata = {
  title: '밥플러스 중식메뉴 | 생각공장 당산점',
  description:
    '밥플러스 생각공장 당산(11호점)의 오늘의 중식메뉴를 실시간으로 확인하세요.',
  openGraph: {
    title: '밥플러스 중식메뉴',
    description: '생각공장 당산점 오늘의 중식메뉴를 실시간으로 확인',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bg-gradient" />
        {children}
      </body>
    </html>
  );
}
