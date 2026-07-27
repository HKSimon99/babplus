'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MenuCard from './MenuCard';
import StatusBar from './StatusBar';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function MenuDisplay() {
  const [menus, setMenus] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | success | empty | error | fetching
  const [lastChecked, setLastChecked] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const timerRef = useRef(null);

  // -----------------------------------------------------------------------
  // Fetch menus from API
  // -----------------------------------------------------------------------
  const fetchMenus = useCallback(async (force = false) => {
    try {
      if (force) setIsRefreshing(true);

      const url = force ? '/api/menus?force=true' : '/api/menus';
      const res = await fetch(url);
      const data = await res.json();

      setMenus(data.menus || []);
      setLastChecked(data.lastChecked);
      setNextRefresh(data.nextRefresh || null);
      setError(data.error || null);

      if (data.status === 'fetching') {
        setStatus('fetching');
      } else if (data.menus?.length > 0) {
        setStatus('success');
      } else {
        setStatus('empty');
      }
    } catch (err) {
      setError(err.message);
      if (menus.length === 0) {
        setStatus('error');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [menus.length]);

  // -----------------------------------------------------------------------
  // Initial fetch + polling
  // -----------------------------------------------------------------------
  useEffect(() => {
    fetchMenus();

    timerRef.current = setInterval(() => {
      fetchMenus();
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchMenus]);

  // -----------------------------------------------------------------------
  // Manual refresh
  // -----------------------------------------------------------------------
  const handleRefresh = () => {
    if (isRefreshing) return;
    fetchMenus(true);
  };

  // -----------------------------------------------------------------------
  // Download image
  // -----------------------------------------------------------------------
  const handleDownload = async (imageUrl, title) => {
    try {
      const res = await fetch(
        `/api/download?url=${encodeURIComponent(imageUrl)}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'menu'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // -----------------------------------------------------------------------
  // Separate today's menu from past menus
  // -----------------------------------------------------------------------
  const todayMenu = menus.find((m) => m.isToday);
  const pastMenus = menus.filter((m) => !m.isToday);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <>
      <StatusBar
        status={status}
        lastChecked={lastChecked}
        nextRefresh={nextRefresh}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* Today's Menu */}
      <section>
        <p className="section-title">오늘의 메뉴</p>

        {status === 'loading' ? (
          <div className="loading-skeleton" />
        ) : todayMenu ? (
          <div className="hero-card fade-in">
            <div
              className="hero-card__image-wrap"
              onClick={() => setModalImage(todayMenu.imageUrl)}
            >
              <img
                className="hero-card__image"
                src={todayMenu.imageUrl}
                alt={todayMenu.title}
                loading="eager"
              />
              <div className="hero-card__overlay" />
              <span className="hero-card__date-badge">{todayMenu.title}</span>
              <span className="hero-card__today-badge">TODAY</span>
            </div>
            <div className="hero-card__footer">
              <span className="hero-card__title">오늘의 중식메뉴</span>
              <div className="hero-card__actions">
                <button
                  className="btn"
                  onClick={() => setModalImage(todayMenu.imageUrl)}
                  title="크게 보기"
                >
                  🔍 확대
                </button>
                <button
                  className="btn btn--accent"
                  onClick={() =>
                    handleDownload(todayMenu.imageUrl, todayMenu.title)
                  }
                  title="다운로드"
                >
                  ⬇ 저장
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state fade-in">
            <div className="empty-state__icon">🍽️</div>
            <h2 className="empty-state__title">
              {status === 'fetching'
                ? '메뉴 확인 중...'
                : '아직 등록되지 않았습니다'}
            </h2>
            <p className="empty-state__desc">
              {status === 'fetching'
                ? '카카오 채널에서 메뉴를 가져오고 있습니다. 최대 30초 정도 걸릴 수 있습니다.'
                : '오늘의 중식메뉴가 아직 올라오지 않았습니다. 자동으로 확인합니다.'}
            </p>
          </div>
        )}
      </section>

      {/* Past Menus Gallery */}
      {pastMenus.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <p className="section-title">최근 메뉴</p>
          <div className="gallery">
            {pastMenus.map((menu) => (
              <MenuCard
                key={menu.date}
                menu={menu}
                onClick={() => setModalImage(menu.imageUrl)}
                onDownload={() => handleDownload(menu.imageUrl, menu.title)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Image Modal */}
      {modalImage && (
        <div
          className="modal-overlay"
          onClick={() => setModalImage(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={modalImage} alt="메뉴 확대" />
            <button
              className="modal-close"
              onClick={() => setModalImage(null)}
            >
              ✕
            </button>
            <div className="modal-actions">
              <button
                className="btn btn--accent"
                onClick={() => {
                  const menu = menus.find((m) => m.imageUrl === modalImage);
                  handleDownload(modalImage, menu?.title || 'menu');
                }}
              >
                ⬇ 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
