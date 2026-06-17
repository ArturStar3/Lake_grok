import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import { TILE_RASTER_URL } from "../../config/tiles";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import LabelGeneration from "./MapUtils";
import "./MapComponent.css"

// delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
});

function FullscreenControl({isFullscreen, onToggle}) {
    return (
        <button
            className="map__fullscreen-btn"
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

export default function MapComponent({ objects, selectedObj, mapRef, isFullscreen, setIsFullscreen }) {
    // const [isFullscreen, setIsFullscreen] = useState(false);
    const [geoData, setGeoData] = useState(null);
    const center = [51.1833, 71.4167];
    const mapInstance = useRef(null);
    const containerRef = useRef(null);

    const displayedObjects = objects.filter(obj => selectedObj.includes(obj.id));

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current = mapInstance.current;
        }
    }, [mapRef]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc)
    }, [isFullscreen]);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (mapRef.current) {
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.invalidateSize();
                        }
                    }, 0)
                }
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current)
        }
        return () => {
            observer.disconnect();
        }
    }, []);

    useEffect(() => {
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 0);
        }
    }, [isFullscreen]);

    useEffect(() => {
        fetch("/geo/custom.geo.json")
            .then(res => res.json())
            .then(setGeoData)
    }, []);

    const onEachCountry = (feature, layer) => {
        const featureId = feature.id || feature.prperties?.id;

        layer.on({
            click: () => {
                console.log(feature); 
            }
        })
        layer.on({
            mouseover: (e) => e.target.setStyle({fillOpacity: 0.1, color: "#85d5f5"}),
            mouseout: (e) => e.target.setStyle({fillOpacity: 0, color: "#FFFFFF"})  
        });
        layer.featureId = featureId;
    };
    
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    }

    const getMarkerKey = (o, i) => o.id ?? `${o.lat}-${o.lng}-${i}`

    const iconsById = LabelGeneration(objects);

    return (
        <div className={`map ${isFullscreen ? "map--fullscreen": ""}`}>
            <MapContainer
                ref={mapRef}
                center={center}
                zoom={4}
                style={{height: "100%", width: "100%"}}
                className={isFullscreen ? "map--fullscreen" : ""}
            >
                <TileLayer
                    url={TILE_RASTER_URL}
                    minZoom={5}
                    maxZoom={14}
                    attribution='&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
                />
                {geoData && (
                        <GeoJSON
                            data={geoData}
                            onEachFeature={onEachCountry}
                            style={{color: "#FFFFFF", weight: 0, fillOpacity: 0}}
                        />
                )}
                {displayedObjects.map((obj, idx) => (
                    <Marker
                        key={getMarkerKey(obj, idx)}
                        position={[obj.lat, obj.lng]}
                        icon={iconsById[obj.id]}
                        draggable={false}
                    />
                ))}
            </MapContainer>
            <FullscreenControl isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
        </div>
    );
}