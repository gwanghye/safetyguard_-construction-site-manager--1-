import React from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void> | void;
    children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
    return (
        <div className="h-full overflow-y-auto no-scrollbar relative">
            {children}
        </div>
    );
};

export default PullToRefresh;
