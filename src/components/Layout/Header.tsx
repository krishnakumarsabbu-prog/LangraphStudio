import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-6 py-4 shadow-card backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-all duration-200 lg:hidden hover:scale-110"
          >
            <Menu size={20} className="text-light-text-secondary dark:text-dark-text-secondary" />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary font-wells">
              Workflow Platform
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Professional workflow management</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
