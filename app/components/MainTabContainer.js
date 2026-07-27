'use client';

import { useState } from 'react';
import MenuDisplay from './MenuDisplay';

const COFFEE_ORDER_URL = 'https://so.upsolution.co.kr/6828502812/1001';

export default function MainTabContainer() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'coffee'

  return (
    <>
      {/* Tab Navigation */}
      <nav className="tabs">
        <button
          className={`tab-btn ${activeTab === 'menu' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍱 밥플러스 점심메뉴
        </button>
        <button
          className={`tab-btn ${activeTab === 'coffee' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('coffee')}
        >
          ☕ 트립플러스 커피주문
        </button>
      </nav>

      {/* Tab Content 1: 밥플러스 점심메뉴 */}
      {activeTab === 'menu' && (
        <div className="fade-in">
          <MenuDisplay />
        </div>
      )}

      {/* Tab Content 2: 트립플러스 커피주문 */}
      {activeTab === 'coffee' && (
        <div className="fade-in">
          <div className="coffee-container">
            <div className="coffee-header">
              <span className="coffee-title">☕ 트립플러스 커피 주문하기</span>
              <a
                href={COFFEE_ORDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--accent"
              >
                ↗ 새 창에서 열기
              </a>
            </div>
            <div className="coffee-iframe-wrap">
              <iframe
                src={COFFEE_ORDER_URL}
                className="coffee-iframe"
                title="트립플러스 커피 주문"
                allow="geolocation; microphone; camera"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
