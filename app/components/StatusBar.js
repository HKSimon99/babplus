'use client';

import { useState, useEffect } from 'react';

export default function StatusBar({
  status,
  lastChecked,
  isRefreshing,
  onRefresh,
}) {
  // Format last checked time
  const formatTime = (isoStr) => {
    if (!isoStr) return '확인 전';
    const d = new Date(isoStr);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${month}/${date} ${hours}:${mins}`;
  };

  // Status dot color
  const dotClass =
    status === 'success' || status === 'cached'
      ? 'header__badge-dot'
      : status === 'error'
        ? 'header__badge-dot header__badge-dot--error'
        : 'header__badge-dot header__badge-dot--warning';

  // Status message
  const statusMsg = () => {
    if (isRefreshing) return '새로고침 중...';
    if (status === 'fetching') return '메뉴 확인 중...';
    if (status === 'loading') return '로딩 중...';
    if (status === 'error') return '오류 발생';

    const timeStr = formatTime(lastChecked);
    return `마지막 확인: ${timeStr}`;
  };

  return (
    <div className="status-bar">
      <div className="status-bar__info">
        <span className={dotClass} />
        <span className="status-bar__text">{statusMsg()}</span>
      </div>
      <div className="status-bar__actions">
        <button
          className="btn"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="수동 새로고침"
        >
          {isRefreshing ? (
            <span className="btn__spinner" />
          ) : (
            '↻ 새로고침'
          )}
        </button>
      </div>
    </div>
  );
}
