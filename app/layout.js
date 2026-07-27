import './globals.css';

export const metadata = {
  title: 'GME 점심코스',
  description: '밥플러스 점심메뉴 확인 & 트립플러스 커피주문 서비스',
  openGraph: {
    title: 'GME 점심코스',
    description: '밥플러스 점심메뉴 확인 & 트립플러스 커피주문 서비스',
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
