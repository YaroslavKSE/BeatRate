import { useRef, useEffect } from 'react';

const AudioVisualizer = () => {
    // Using refs instead of state to avoid unnecessary re-renders
    const barsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Define the number of bars
        const barCount = 4; // Increased from 3 to 4 for a fuller look
        const container = barsRef.current;

        if (!container) return;

        // Create bars
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');

            // Set up base styling
            bar.style.width = '3px';
            bar.style.backgroundColor = '#4F46E5';
            bar.style.borderRadius = '1px';
            bar.style.margin = '0 1px';
            bar.style.transform = 'scaleY(1)';
            bar.style.transformOrigin = 'bottom';
            bar.style.opacity = '0.85';

            // Apply individual animations to each bar
            const duration = 0.6 + (i * 0.1); // 0.6s, 0.7s, 0.8s, 0.9s
            bar.style.animation = `audioVisualizerBar ${duration}s ease-in-out infinite alternate`;
            bar.style.animationDelay = `${i * 0.1}s`;

            container.appendChild(bar);
        }

        // Create the animation keyframes dynamically
        const style = document.createElement('style');
        style.textContent = `
            @keyframes audioVisualizerBar {
                0% {
                    height: 3px;
                    opacity: 0.7;
                }
                50% {
                    opacity: 0.9;
                }
                100% {
                    height: ${12 + Math.floor(Math.random() * 12)}px;
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        // Set up a more frequent update to make the bars appear more dynamic
        const randomizeHeights = () => {
            if (!container) return;

            const bars = container.childNodes;
            bars.forEach((bar) => {
                if (bar instanceof HTMLElement) {
                    // Generate new end heights frequently to make it look more dynamic
                    const keyframes = bar.getAnimations()[0]?.effect as KeyframeEffect;
                    if (keyframes) {
                        const height = 12 + Math.floor(Math.random() * 12);
                        keyframes.setKeyframes([
                            { height: '3px', opacity: 0.7 },
                            { opacity: 0.9, offset: 0.5 },
                            { height: `${height}px`, opacity: 1 }
                        ]);
                    }
                }
            });
        };

        // Update bars heights more frequently for a more dynamic effect
        const interval = setInterval(randomizeHeights, 300);

        return () => {
            clearInterval(interval);
            document.head.removeChild(style);

            // Clean up bars when component unmounts
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        };
    }, []);

    return (
        <div className="flex justify-center items-end h-6 w-full scale-75 sm:scale-100" ref={barsRef}></div>
    );
};

export default AudioVisualizer;