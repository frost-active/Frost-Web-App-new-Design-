import type { User } from 'firebase/auth';

export type DashboardPage = 'configure' | 'stats' | 'device';

type Props = { page: DashboardPage; connected: boolean; grid: boolean; h24: boolean; user?: Pick<User, 'displayName' | 'email'> | null; onPageChange: (page: DashboardPage) => void; onGridChange: () => void; onFormatChange: () => void; onSignOut: () => void };

export default function Header({ page, connected, grid, h24, user, onPageChange, onGridChange, onFormatChange, onSignOut }: Props) {
  const name = user?.displayName || user?.email?.split('@')[0] || 'Signed in';
  return <header><div className="logo">FROST<span>·</span></div><nav className="tabs" id="tabs">{(['configure', 'stats', 'device'] as const).map((item) => <button key={item} type="button" data-p={item} aria-current={page === item} onClick={() => onPageChange(item)}>{item === 'configure' ? 'Configure' : item === 'stats' ? 'Statistics' : 'Device'}</button>)}</nav><div className="hspace" /><button className="gridtog" id="fmttog" type="button" aria-pressed={h24} onClick={onFormatChange}>{h24 ? '24-hour' : '12-hour'}<span className="sw" /></button><button className={`gridtog${grid ? ' on' : ''}`} id="gridtog" type="button" aria-pressed={grid} onClick={onGridChange}>Grid<span className="sw" /></button><div className={`chip${connected ? ' live' : ''}`} id="chip"><span className="dot" /><span id="chipTxt">{connected ? 'Connected · 82%' : 'Not connected'}</span></div><div className="user" id="user"><span className="uav">{name[0]?.toUpperCase() || 'U'}</span><span className="uinfo"><span className="uname">{name}</span><span className="uemail">{user?.email || ''}</span></span><button className="uout" id="signout" type="button" onClick={onSignOut}>Sign out</button></div></header>;
}
