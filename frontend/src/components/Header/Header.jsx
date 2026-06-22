import { useEffect, useId, useRef, useState } from "react";
import userIcon from "../../assets/images/no_user.png";
import logo from "../../assets/images/logo.png";
import "./Header.css";

export default function Header() {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);

    useEffect(() => {
        document.body.classList.toggle("app-menu-open", open);
        return () => document.body.classList.remove("app-menu-open");
    }, [open]);

    const closeMenu = () => setOpen(false);

    return (
        <div className={`app-menu${open ? " app-menu--open" : ""}`} ref={rootRef}>
            <button
                type="button"
                className="app-menu__trigger"
                aria-label={open ? "Закрыть меню" : "Открыть меню"}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span className="app-menu__burger" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </span>
            </button>

            <button
                type="button"
                className="app-menu__backdrop"
                aria-label="Закрыть меню"
                onClick={closeMenu}
                tabIndex={open ? 0 : -1}
            />

            <aside id={panelId} className="app-menu__panel" aria-label="Главное меню">
                <div className="app-menu__brand">
                    <img className="app-menu__logo" src={logo} alt="InfoLake" width="40" height="40" />
                    <div className="app-menu__brand-text">
                        <p className="app-menu__brand-title">InfoLake</p>
                        <p className="app-menu__brand-subtitle">ГИС-система</p>
                    </div>
                </div>

                <nav className="app-menu__nav" aria-label="Навигация">
                    <button type="button" className="app-menu__nav-item app-menu__nav-item--active" onClick={closeMenu}>
                        Оперативная обстановка
                    </button>
                </nav>

                <div className="app-menu__footer">
                    <img className="app-menu__user" src={userIcon} alt="Пользователь" width="36" height="36" />
                    <span className="app-menu__user-label">Пользователь</span>
                </div>
            </aside>
        </div>
    );
}
