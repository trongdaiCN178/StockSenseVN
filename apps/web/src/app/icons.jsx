// Icon set from the StockSense VN HTML prototype (24×24 stroke icons).
const PATHS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  chart: <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  pie: <><path d="M12 3v9h9a9 9 0 1 1-9-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".8" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  gauge: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-6" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  pdf: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></>,
  dl: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
};

export function Icon({ name, className = '' }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{PATHS[name]}</svg>;
}

// Disclaimer strip used under forecast-related content (prototype `.disc`).
export function Disclaimer({ children = 'Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.' }) {
  return <div className="disc"><Icon name="info" /><span>{children}</span></div>;
}
