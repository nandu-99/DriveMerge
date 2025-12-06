import React, { ReactElement, ReactNode, useEffect, useMemo, useState } from "react";

export interface AnimatedListProps {
    className?: string;
    children: React.ReactNode;
    delay?: number;
}

export const AnimatedList = ({ className, children, delay = 1000 }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = React.Children.toArray(children);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
        }, delay);

        return () => clearInterval(interval);
    }, [childrenArray.length, delay]);

    const itemsToShow = useMemo(
        () => childrenArray.slice(0, index + 1).reverse(),
        [index, childrenArray],
    );

    return (
        <div className={`flex flex-col items-center gap-4 ${className}`}>
            {itemsToShow.map((item) => (
                <AnimatedListItem key={(item as ReactElement).key}>
                    {item}
                </AnimatedListItem>
            ))}
        </div>
    );
};

export function AnimatedListItem({ children }: { children: ReactNode }) {
    const animations = {
        initial: { scale: 0, opacity: 0 },
        animate: { scale: 1, opacity: 1, originY: 0 },
        exit: { scale: 0, opacity: 0 },
        transition: { type: "spring", stiffness: 350, damping: 40 },
    };

    return (
        <div
            className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{
                animation: "fadeIn 0.5s ease-out",
            }}
        >
            {children}
        </div>
    );
}
