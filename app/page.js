import MenuDisplay from './components/MenuDisplay';

export default function Home() {
  return (
    <main className="main">
      <header className="header">
        <h1 className="header__title">중식메뉴</h1>
        <p className="header__subtitle">밥플러스 생각공장 당산점</p>
      </header>

      <MenuDisplay />

      <footer className="footer">
        <p>
          메뉴 출처:{' '}
          <a
            href="https://pf.kakao.com/_xmbxnGG/posts"
            target="_blank"
            rel="noopener noreferrer"
          >
            카카오 채널 (밥플러스 11호점)
          </a>
        </p>
        <p>최근 7일간의 중식메뉴가 유지됩니다</p>
      </footer>
    </main>
  );
}
