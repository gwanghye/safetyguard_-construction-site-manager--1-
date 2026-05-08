import React, { useState } from 'react';

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    containerClassName?: string;
}

const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({ containerClassName = '', className = '', src, alt, ...props }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className={`relative overflow-hidden bg-slate-200 ${containerClassName}`}>
            {!isLoaded && (
                <div className="absolute inset-0 animate-pulse bg-slate-300" />
            )}
            <img
                src={src}
                alt={alt}
                className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
                onLoad={() => setIsLoaded(true)}
                {...props}
            />
        </div>
    );
};

export default ImageWithSkeleton;
