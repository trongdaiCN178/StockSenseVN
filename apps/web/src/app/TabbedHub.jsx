import { useAuth } from '../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from './navigation.js';

// Settings and Admin are single menu entries with tabs (HTML prototype); each tab keeps its own URL.
export function TabbedHub({ title, description, tabs, pathname }) {
  const { user } = useAuth();
  const available = tabs.filter((tab) => hasCapability(user.role, tab.capability) || tab.capability === null);
  const current = available.find((tab) => pathname === tab.path) ?? available[0];
  if (!current) return null;
  const Page = current.component;
  return <>
    <section className="content hub-head">
      <div className="pagehead"><div><h1>{title}</h1><p>{description}</p></div></div>
      <div className="tabs" role="tablist">{available.map((tab) => <button key={tab.path} type="button" role="tab" aria-selected={tab === current} className={tab === current ? 'on' : ''} onClick={() => navigate(tab.path)}>{tab.label}</button>)}</div>
    </section>
    <div className="embedded"><Page /></div>
  </>;
}
