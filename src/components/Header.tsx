interface HeaderProps {
  apiKey: string | null;
}

export function Header({ apiKey }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="header-logo-text">
          Creative Generator <span>Prototype</span>
        </div>
      </div>
      <div className="header-right">
        <div className="header-key-status">
          <span className={`header-key-dot${apiKey ? '' : ' error'}`} />
          {apiKey ? 'API connected' : 'No API key'}
        </div>
      </div>
    </header>
  );
}
