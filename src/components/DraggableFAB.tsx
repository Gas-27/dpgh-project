'use client';

import { useState, useRef, useEffect, ReactNode } from "react";

interface DraggableFABProps {
  children: ReactNode;
  initialBottom?: number;
  initialRight?: number;
  storageKey?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  href?: string;
}

export const DraggableFAB = ({
  children,
  initialBottom = 24,
  initialRight = 24,
  storageKey,
  onClick,
  className = "",
  title,
  href,
}: DraggableFABProps) => {
  const [position, setPosition] = useState({ bottom: initialBottom, right: initialRight });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ bottom: 0, right: 0 });

  // Load saved position from localStorage
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`fab-position-${storageKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPosition(parsed);
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [storageKey]);

  // Save position to localStorage
  const savePosition = (pos: { bottom: number; right: number }) => {
    if (storageKey) {
      localStorage.setItem(`fab-position-${storageKey}`, JSON.stringify(pos));
    }
  };

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setHasMoved(false);
    startPos.current = { x: clientX, y: clientY };
    startOffset.current = { bottom: position.bottom, right: position.right };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;

    // Only consider it moved if dragged more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }

    // Moving right decreases "right" value, moving down decreases "bottom" value
    const newRight = Math.max(10, Math.min(window.innerWidth - 60, startOffset.current.right - deltaX));
    const newBottom = Math.max(10, Math.min(window.innerHeight - 60, startOffset.current.bottom - deltaY));

    setPosition({ bottom: newBottom, right: newRight });
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleEnd();

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if we didn't drag
    if (!hasMoved && onClick) {
      onClick();
    }
  };

  const content = (
    <div
      ref={dragRef}
      className={`fixed z-50 cursor-grab active:cursor-grabbing touch-none select-none ${className}`}
      style={{
        bottom: `${position.bottom}px`,
        right: `${position.right}px`,
        transition: isDragging ? "none" : "box-shadow 0.2s",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      title={title}
    >
      {children}
    </div>
  );

  if (href && !hasMoved) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="contents"
        onClick={(e) => {
          if (hasMoved) {
            e.preventDefault();
          }
        }}
      >
        {content}
      </a>
    );
  }

  return content;
};

export default DraggableFAB;
