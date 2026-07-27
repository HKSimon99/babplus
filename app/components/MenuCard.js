'use client';

export default function MenuCard({ menu, onClick, onDownload }) {
  // Format date for display: "7/27 (월)"
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00+09:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayOfWeek = days[d.getDay()];
    return `${month}/${day} (${dayOfWeek})`;
  };

  return (
    <div className="gallery-card fade-in" onClick={onClick}>
      <div className="gallery-card__image-wrap">
        <img
          className="gallery-card__image"
          src={menu.imageUrl}
          alt={menu.title}
          loading="lazy"
        />
      </div>
      <div className="gallery-card__info">
        <span className="gallery-card__date">{formatDate(menu.date)}</span>
        <button
          className="btn btn--icon gallery-card__download"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="다운로드"
        >
          ⬇
        </button>
      </div>
    </div>
  );
}
