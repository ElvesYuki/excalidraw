import { useEffect, useRef, useState } from "react";

import { useAuth } from "./AuthGate";

import "./AuthGate.scss";

export const AuthUserMenu = () => {
  const auth = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!auth || auth.authState.status !== "authenticated") {
    return null;
  }

  const { user } = auth.authState;
  const displayName = user.displayName || user.username || "当前用户";
  const badgeLabel = displayName.trim().charAt(0).toUpperCase() || "U";
  const normalizedRole = user.role ? user.role.toUpperCase() : "MEMBER";

  return (
    <div className="backend-auth-userpanel" ref={menuRef}>
      <button
        className="backend-auth-userpanel__trigger backend-auth-userpanel__trigger--toolbar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`当前用户：${displayName}`}
        title={displayName}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="backend-auth-userpanel__trigger-badge">{badgeLabel}</span>
      </button>
      {isOpen && (
        <div className="backend-auth-userpanel__menu" role="menu">
          <div className="backend-auth-userpanel__menu-header">
            <div className="backend-auth-userpanel__menu-name">{displayName}</div>
            <div className="backend-auth-userpanel__menu-meta">{normalizedRole}</div>
          </div>
          <div className="backend-auth-userpanel__actions">
            <button
              className="backend-auth-userpanel__logout"
              type="button"
              onClick={auth.logout}
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
