import React, { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import "./MapFullscreenChrome.css";

export function FullscreenControl({ isFullscreen, onToggle, sidebarOpen = false }) {
    return (
        <button
            type="button"
            className={`map__fullscreen-btn${sidebarOpen ? ' map__fullscreen-btn--sidebar-open' : ''}`}
            onClick={onToggle}
            aria-label={isFullscreen ? "Выход из полноэкранного режима" : "Перейти в полноэкранный режим"}
        >
            {isFullscreen ? (
                <svg width="25" height="25">
                    <use href={"/sprite.svg#arrow-in"} />
                </svg>
            ) : (
                <svg width="25" height="25">
                    <use href={"/sprite.svg#arrow-out"} />
                </svg>
            )}
        </button>
    )
}

// Стандартные топографические / военные масштабы для дропдауна выбора и снаппинга.
// Убраны масштабы детальнее 1:10 000 (по требованию пользователя).
const AVAILABLE_DENOMINATORS = [
    25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000,
    5000000, 10000000, 50000000,
];

function metersPerPxAtZoom(lat, zoom) {
    return 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, zoom);
}

// Линейка масштаба (топографический стиль) — двухцветная графическая шкала (только fullscreen).
export function MapScaleBar({ isFullscreen }) {
    const map = useMap();
    const [scale, setScale] = useState(null);
    const scaleTimeoutRef = useRef(null);

    const updateScale = useCallback(() => {
        if (!map || !isFullscreen) {
            setScale(null);
            return;
        }

        const center = map.getCenter();
        const zoom = map.getZoom();
        const metersPerPxRuler = metersPerPxAtZoom(center.lat, zoom);

        const targetPx = 170;
        let groundMeters = targetPx * metersPerPxRuler;

        const exp = Math.floor(Math.log10(Math.max(groundMeters, 1)));
        const base = Math.pow(10, exp);
        const coeff = groundMeters / base;

        let niceCoeff;
        if (coeff < 1.4) niceCoeff = 1;
        else if (coeff < 2.8) niceCoeff = 2;
        else if (coeff < 7) niceCoeff = 5;
        else niceCoeff = 10;

        let niceMeters = niceCoeff * base;
        let barWidth = Math.round(niceMeters / metersPerPxRuler);
        barWidth = Math.max(80, Math.min(260, barWidth));

        let distLabel;
        let unit;
        if (niceMeters >= 1000) {
            distLabel = niceMeters >= 10000 ? Math.round(niceMeters / 1000) : (niceMeters / 1000).toFixed(1);
            unit = "км";
        } else {
            distLabel = Math.round(niceMeters);
            unit = "м";
        }

        const numSegments = 4;
        const segmentWidth = Math.floor(barWidth / numSegments);

        setScale({
            barWidth,
            distLabel,
            unit,
            numSegments,
            segmentWidth
        });
    }, [map, isFullscreen]);

    useEffect(() => {
        if (!map) return undefined;

        const scheduleUpdate = () => {
            if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
            scaleTimeoutRef.current = setTimeout(updateScale, 60);
        };

        map.on("zoomend", scheduleUpdate);
        map.on("moveend", scheduleUpdate);
        map.on("resize", scheduleUpdate);
        updateScale();

        return () => {
            map.off("zoomend", scheduleUpdate);
            map.off("moveend", scheduleUpdate);
            map.off("resize", scheduleUpdate);
            if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
        };
    }, [map, updateScale]);

    if (!isFullscreen || !scale) {
        return null;
    }

    const segments = [];
    for (let i = 0; i < scale.numSegments; i += 1) {
        const isDark = i % 2 === 0;
        segments.push(
            <div
                key={i}
                style={{
                    width: `${scale.segmentWidth}px`,
                    height: "7px",
                    backgroundColor: isDark ? "#1f2a38" : "#f4f6f7",
                    // Рамка только на контейнере .map-scale-ruler; здесь только разделительные линии
                    borderRight: i < scale.numSegments - 1 ? "1px solid #3a4654" : "none",
                    boxSizing: "border-box"
                }}
            />
        );
    }

    return (
        <div className="map-scale-bar map-scale-bar--ruler-only">
            <div
                className="map-scale-ruler"
                style={{ width: `${scale.barWidth}px` }}
            >
                {segments}
            </div>
            <div className="map-scale-labels">
                <span>0</span>
                <span>{scale.distLabel}&nbsp;{scale.unit}</span>
            </div>
        </div>
    );
}
