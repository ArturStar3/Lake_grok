import React, { useEffect, useRef } from "react";
import { Circle, Polygon, Polyline, useMap } from "react-leaflet";

// Глобальные переменные для анимации
let animationFrameId = null;
let startTime = null;
const animatedZones = new Set();
let mapInstance = null;

function startGlobalAnimation() {
    if (animationFrameId) return;
    
    startTime = performance.now();
    
    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const bounds = mapInstance ? mapInstance.getBounds() : null;
        
        animatedZones.forEach(({ update, center }) => {
            if (bounds && !bounds.contains(center)) return;
            update(elapsed);
        });
        
        animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
}

function stopGlobalAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        startTime = null;
    }
}

// ============================================
// 1. GRADIENT - Градиентная заливка
// ============================================
export function GradientZone({ center, radius, color }) {
    return (
        <>
            {/* Внутренний круг */}
            <Circle
                center={center}
                radius={radius * 0.3}
                pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 0,
                    interactive: false
                }}
            />
            {/* Средний круг */}
            <Circle
                center={center}
                radius={radius * 0.65}
                pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.2,
                    weight: 0,
                    interactive: false
                }}
            />
            {/* Внешний круг */}
            <Circle
                center={center}
                radius={radius}
                pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 1,
                    opacity: 0.3,
                    interactive: false
                }}
            />
        </>
    );
}

// ============================================
// 2. RADAR - Радиальные лучи (вращающиеся)
// ============================================
export function RadarZone({ center, radius, color }) {
    const linesRef = useRef([]);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        // Создаём 8 лучей
        const rayCount = 8;
        const rays = [];
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i * 360) / rayCount;
            rays.push({ angle, element: null });
        }
        
        linesRef.current = rays;
        
        const update = (elapsed) => {
            rays.forEach((ray, index) => {
                // Обновляем через DOM если элемент существует
                if (ray.element?._path) {
                    const opacity = 0.3 + 0.2 * Math.sin((elapsed / 1000 + index) * Math.PI);
                    ray.element._path.setAttribute('stroke-opacity', opacity);
                }
            });
        };
        
        zoneRef.current = { type: 'radar', update, center };
        animatedZones.add(zoneRef.current);
        startGlobalAnimation();
        
        return () => {
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [center, radius, mapRef]);
    
    // Создаём статичные лучи (анимация через DOM)
    const rays = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i * 360) / 8 * (Math.PI / 180);
        const endLat = center[0] + (radius / 111320) * Math.cos(angle);
        const endLng = center[1] + (radius / (111320 * Math.cos(center[0] * Math.PI / 180))) * Math.sin(angle);
        
        rays.push(
            <Polyline
                key={i}
                positions={[center, [endLat, endLng]]}
                ref={(el) => { if (linesRef.current[i]) linesRef.current[i].element = el; }}
                pathOptions={{
                    color: color,
                    weight: 2,
                    opacity: 0.4,
                    interactive: false
                }}
            />
        );
    }
    
    return (
        <>
            <Circle
                center={center}
                radius={radius}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    weight: 1.5,
                    opacity: 0.3,
                    interactive: false
                }}
            />
            {rays}
        </>
    );
}

// ============================================
// 3. WAVE - Волновой эффект (текущая реализация)
// ============================================
export function WaveZone({ center, radius, color }) {
    const pulse1Ref = useRef(null);
    const pulse2Ref = useRef(null);
    const circleDataRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const findCircles = () => {
            if (pulse1Ref.current && pulse2Ref.current) {
                const update = (elapsed) => {
                    const progress1 = (elapsed % 3000) / 3000;
                    const progress2 = ((elapsed + 1500) % 3000) / 3000;
                    
                    const scale1 = progress1;
                    const scale2 = progress2;
                    const opacity1 = Math.max(0, 0.3 * (1 - progress1));
                    const opacity2 = Math.max(0, 0.3 * (1 - progress2));
                    
                    if (pulse1Ref.current) {
                        pulse1Ref.current.setRadius(radius * scale1);
                        const path1 = pulse1Ref.current._path;
                        if (path1) {
                            path1.setAttribute('stroke-opacity', opacity1);
                            path1.setAttribute('stroke-width', 1.5);
                        }
                    }
                    if (pulse2Ref.current) {
                        pulse2Ref.current.setRadius(radius * scale2);
                        const path2 = pulse2Ref.current._path;
                        if (path2) {
                            path2.setAttribute('stroke-opacity', opacity2);
                            path2.setAttribute('stroke-width', 1.5);
                        }
                    }
                };
                
                circleDataRef.current = { type: 'wave', update, center };
                animatedZones.add(circleDataRef.current);
                startGlobalAnimation();
                return true;
            }
            return false;
        };
        
        const timeoutId = setTimeout(() => {
            if (!findCircles()) {
                setTimeout(findCircles, 100);
            }
        }, 50);
        
        return () => {
            clearTimeout(timeoutId);
            if (circleDataRef.current) {
                animatedZones.delete(circleDataRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <>
            <Circle
                center={center}
                radius={radius}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 1.5,
                    opacity: 0.4,
                    interactive: false
                }}
            />
            <Circle
                center={center}
                radius={radius}
                ref={pulse1Ref}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 2,
                    interactive: false
                }}
            />
            <Circle
                center={center}
                radius={radius}
                ref={pulse2Ref}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 2,
                    interactive: false
                }}
            />
        </>
    );
}

// ============================================
// 4. PULSE - Пульсирующая заливка
// ============================================
export function PulseZone({ center, radius, color }) {
    const circleRef = useRef(null);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const findCircle = () => {
            if (circleRef.current) {
                const update = (elapsed) => {
                    const cycle = (elapsed % 4000) / 4000;
                    const scale = 1 + 0.1 * Math.sin(cycle * Math.PI * 2);
                    const opacity = 0.15 + 0.15 * Math.sin(cycle * Math.PI * 2);
                    
                    circleRef.current.setRadius(radius * scale);
                    const path = circleRef.current._path;
                    if (path) {
                        path.setAttribute('fill-opacity', opacity);
                        path.setAttribute('stroke-opacity', 0.4 + 0.2 * Math.sin(cycle * Math.PI * 2));
                    }
                };
                
                zoneRef.current = { type: 'pulse', update, center };
                animatedZones.add(zoneRef.current);
                startGlobalAnimation();
                return true;
            }
            return false;
        };
        
        const timeoutId = setTimeout(() => {
            if (!findCircle()) {
                setTimeout(findCircle, 100);
            }
        }, 50);
        
        return () => {
            clearTimeout(timeoutId);
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <Circle
            center={center}
            radius={radius}
            ref={circleRef}
            pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2,
                opacity: 0.5,
                interactive: false
            }}
        />
    );
}

// ============================================
// 5. RINGS - Концентрические кольца с вращением
// ============================================
export function RingsZone({ center, radius, color }) {
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);
    const ring3Ref = useRef(null);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const update = (elapsed) => {
            const offset = (elapsed / 100) % 30; // Движение пунктира
            
            [ring1Ref, ring2Ref, ring3Ref].forEach((ref) => {
                if (ref.current?._path) {
                    ref.current._path.setAttribute('stroke-dashoffset', -offset);
                }
            });
        };
        
        zoneRef.current = { type: 'rings', update, center };
        animatedZones.add(zoneRef.current);
        startGlobalAnimation();
        
        return () => {
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <>
            <Circle
                center={center}
                radius={radius * 0.4}
                ref={ring1Ref}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '15, 15',
                    interactive: false
                }}
            />
            <Circle
                center={center}
                radius={radius * 0.7}
                ref={ring2Ref}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    weight: 2,
                    opacity: 0.5,
                    dashArray: '15, 15',
                    interactive: false
                }}
            />
            <Circle
                center={center}
                radius={radius}
                ref={ring3Ref}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    weight: 2,
                    opacity: 0.4,
                    dashArray: '15, 15',
                    interactive: false
                }}
            />
        </>
    );
}

// ============================================
// 6. SECTOR - Секторное покрытие (радар)
// ============================================
export function SectorZone({ center, radius, color }) {
    const [sectorPath, setSectorPath] = React.useState([]);
    const pathRef = useRef(null);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const update = (elapsed) => {
            const rotation = (elapsed / 4000) * 360; // 4 секунды на оборот
            const sectorAngle = 90; // Угол сектора
            
            // Создаём сектор
            const points = [center];
            const startAngle = rotation * (Math.PI / 180);
            const endAngle = (rotation + sectorAngle) * (Math.PI / 180);
            
            for (let angle = startAngle; angle <= endAngle; angle += 0.1) {
                const lat = center[0] + (radius / 111320) * Math.cos(angle);
                const lng = center[1] + (radius / (111320 * Math.cos(center[0] * Math.PI / 180))) * Math.sin(angle);
                points.push([lat, lng]);
            }
            points.push(center);
            
            setSectorPath(points);
        };
        
        zoneRef.current = { type: 'sector', update, center };
        animatedZones.add(zoneRef.current);
        startGlobalAnimation();
        
        return () => {
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <>
            <Circle
                center={center}
                radius={radius}
                pathOptions={{
                    color: color,
                    fillColor: 'transparent',
                    weight: 1,
                    opacity: 0.3,
                    interactive: false
                }}
            />
            {sectorPath.length > 0 && (
                <Polygon
                    positions={sectorPath}
                    ref={pathRef}
                    pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: 0.2,
                        weight: 2,
                        opacity: 0.5,
                        interactive: false
                    }}
                />
            )}
        </>
    );
}

// ============================================
// 7. ALERT - Мерцающий контур
// ============================================
export function AlertZone({ center, radius, color }) {
    const circleRef = useRef(null);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const findCircle = () => {
            if (circleRef.current) {
                const update = (elapsed) => {
                    const cycle = (elapsed % 1000) / 1000;
                    const opacity = 0.2 + 0.6 * Math.abs(Math.sin(cycle * Math.PI));
                    
                    const path = circleRef.current._path;
                    if (path) {
                        path.setAttribute('stroke-opacity', opacity);
                    }
                };
                
                zoneRef.current = { type: 'alert', update, center };
                animatedZones.add(zoneRef.current);
                startGlobalAnimation();
                return true;
            }
            return false;
        };
        
        const timeoutId = setTimeout(() => {
            if (!findCircle()) {
                setTimeout(findCircle, 100);
            }
        }, 50);
        
        return () => {
            clearTimeout(timeoutId);
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <Circle
            center={center}
            radius={radius}
            ref={circleRef}
            pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.1,
                weight: 3,
                opacity: 0.8,
                interactive: false
            }}
        />
    );
}

// ============================================
// 8. DASHED_ROTATE - Вращающийся пунктир
// ============================================
export function DashedRotateZone({ center, radius, color }) {
    const circleRef = useRef(null);
    const zoneRef = useRef(null);
    const mapRef = useMap();
    
    useEffect(() => {
        if (!mapInstance) mapInstance = mapRef;
        
        const findCircle = () => {
            if (circleRef.current) {
                const update = (elapsed) => {
                    const offset = (elapsed / 50) % 35;
                    
                    const path = circleRef.current._path;
                    if (path) {
                        path.setAttribute('stroke-dashoffset', -offset);
                    }
                };
                
                zoneRef.current = { type: 'dashed_rotate', update, center };
                animatedZones.add(zoneRef.current);
                startGlobalAnimation();
                return true;
            }
            return false;
        };
        
        const timeoutId = setTimeout(() => {
            if (!findCircle()) {
                setTimeout(findCircle, 100);
            }
        }, 50);
        
        return () => {
            clearTimeout(timeoutId);
            if (zoneRef.current) {
                animatedZones.delete(zoneRef.current);
            }
            if (animatedZones.size === 0) {
                stopGlobalAnimation();
            }
        };
    }, [radius, center, mapRef]);
    
    return (
        <Circle
            center={center}
            radius={radius}
            ref={circleRef}
            pathOptions={{
                color: color,
                fillColor: 'transparent',
                weight: 2,
                opacity: 0.6,
                dashArray: '20, 15',
                interactive: false
            }}
        />
    );
}

// ============================================
// Компонент-диспетчер для выбора типа анимации
// ============================================
export function ActionRadiusAnimation({ center, radius, color, animationType = 'wave' }) {
    const animations = {
        gradient: GradientZone,
        radar: RadarZone,
        wave: WaveZone,
        pulse: PulseZone,
        rings: RingsZone,
        sector: SectorZone,
        alert: AlertZone,
        dashed_rotate: DashedRotateZone,
    };
    
    const AnimationComponent = animations[animationType] || WaveZone;
    
    return <AnimationComponent center={center} radius={radius} color={color} />;
}
