import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useDropdownWithSearch } from "../../hooks/useDropdownWithSearch";
import MarkdownEditor from "../common/MarkdownEditor/MarkdownEditor";
import PolygonCoordinateEditor from "../common/PolygonCoordinateEditor/PolygonCoordinateEditor";
import { drawPointsToEditable, editablePointsKey, drawPointsKey, parseLatLngPoints } from "../../utils/polygonDrawUtils";
import "./AddEventModal.css";

import { API_URL as API_ROOT } from '../../config/api';

const EVENT_COLORS = [
	"#2f80ed",
	"#27ae60",
	"#f2994a",
	"#eb5757",
	"#9b51e0",
	"#00bcd4",
	"#f2c94c",
	"#6b7280",
	"#1abc9c",
	"#e67e22",
	"#e84393",
	"#2d3436",
	"#fd79a8",
	"#00cec9"
];

export default function AddEventModal({
	isOpen,
	onClose,
	drawMode,
	drawPoints,
	onDrawPointsChange,
	onSave,
	initialEvent = null,
}) {
	const [formData, setFormData] = useState({
		title: "",
		dateStart: "",
		dateEnd: "",
		timeStart: "",
		timeEnd: "",
		object: "",
		eventType: "",
		country: "",
		marker: "",
		info: "",
		color: "#2f80ed"
	});
	const [geoForm, setGeoForm] = useState({
		mode: null,
		points: [],
		centerLat: "",
		centerLng: "",
		radiusMeters: ""
	});
	const [countries, setCountries] = useState([]);
	const [markers, setMarkers] = useState([]);
	const [eventTypes, setEventTypes] = useState([]);
	const [markerSvgs, setMarkerSvgs] = useState(new Map());
	const [polygonEditable, setPolygonEditable] = useState([]);
	const skipPolygonSyncRef = useRef(false);

	useEffect(() => {
		if (!isOpen) return;

		const baseForm = {
			title: "",
			dateStart: "",
			dateEnd: "",
			timeStart: "",
			timeEnd: "",
			object: "",
			eventType: "",
			country: "",
			marker: "",
			info: "",
			color: "#2f80ed"
		};

		if (initialEvent) {
			setFormData({
				...baseForm,
				title: initialEvent.title || "",
				dateStart: initialEvent.date_start || "",
				dateEnd: initialEvent.date_end || "",
				timeStart: initialEvent.time_start || "",
				timeEnd: initialEvent.time_end || "",
				object: initialEvent.object_name || "",
				eventType: initialEvent.event_type?.id || "",
				country: initialEvent.country?.id || "",
				marker: initialEvent.marker?.id || "",
				info: initialEvent.description || "",
				color: initialEvent.color || "#2f80ed"
			});
		} else {
			setFormData(baseForm);
		}

		const loadDictionaries = async () => {
			try {
				const [countriesRes, markersRes, eventTypesRes] = await Promise.all([
					axios.get(`${API_ROOT}/api/v1/countries/`),
					axios.get(`${API_ROOT}/api/v1/event-markers/`),
					axios.get(`${API_ROOT}/api/v1/event-types/`)
				]);
				setCountries(countriesRes.data || []);
				setMarkers(markersRes.data || []);
				setEventTypes(eventTypesRes.data || []);

				markersRes.data?.forEach(async (marker) => {
					if (marker.path) {
						try {
							const res = await axios.get(marker.path, { responseType: "text" });
							setMarkerSvgs((prev) => new Map(prev).set(marker.id, res.data));
						} catch (err) {
							console.warn("Не удалось загрузить SVG маркера:", marker.path, err);
						}
					}
				});
			} catch (err) {
				console.error("Ошибка загрузки справочников:", err);
			}
		};

		loadDictionaries();
	}, [isOpen, initialEvent]);

	const countryDropdown = useDropdownWithSearch(countries, (id) => {
		setFormData((prev) => ({ ...prev, country: id }));
	});

	const markerDropdown = useDropdownWithSearch(markers, (id) => {
		setFormData((prev) => ({ ...prev, marker: id }));
	});

	const selectedCountry = useMemo(
		() => countries.find((c) => c.id === Number(formData.country)),
		[countries, formData.country]
	);

	const selectedMarker = useMemo(
		() => markers.find((m) => m.id === Number(formData.marker)),
		[markers, formData.marker]
	);

	const selectedEventType = useMemo(
		() => eventTypes.find((t) => t.id === Number(formData.eventType)),
		[eventTypes, formData.eventType]
	);

	const geometrySummary = () => {
		if (!drawMode) return "Форма не выбрана";
		if (drawMode === "point") return `Точка (${drawPoints.length})`;
		if (drawMode === "circle") return `Окружность (${drawPoints.length})`;
		if (drawMode === "rectangle") return `Территория (${drawPoints.length})`;
		if (drawMode === "polygon") return `Произвольная форма (${drawPoints.length})`;
		return "Форма";
	};

	const formatCoord = (value) => {
		if (value === null || value === undefined) return "";
		return Number(value).toFixed(6);
	};

	const toRadians = (deg) => (deg * Math.PI) / 180;
	const calcDistanceMeters = (from, to) => {
		const R = 6371e3;
		const phi1 = toRadians(from.lat);
		const phi2 = toRadians(to.lat);
		const deltaPhi = toRadians(to.lat - from.lat);
		const deltaLambda = toRadians(to.lng - from.lng);

		const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	};

	useEffect(() => {
		if (!isOpen) return;
		if (!drawMode) {
			setGeoForm({ mode: null, points: [], centerLat: "", centerLng: "", radiusMeters: "" });
			return;
		}
		if (drawMode === "point" && drawPoints[0]) {
			setGeoForm({
				mode: drawMode,
				points: [{ lat: formatCoord(drawPoints[0].lat), lng: formatCoord(drawPoints[0].lng) }],
				centerLat: "",
				centerLng: "",
				radiusMeters: ""
			});
			return;
		}
		if (drawMode === "circle" && drawPoints.length >= 2) {
			const radiusMeters = Math.round(calcDistanceMeters(drawPoints[0], drawPoints[1]));
			setGeoForm({
				mode: drawMode,
				points: [],
				centerLat: formatCoord(drawPoints[0].lat),
				centerLng: formatCoord(drawPoints[0].lng),
				radiusMeters: String(radiusMeters)
			});
			return;
		}
		if ((drawMode === "rectangle") && drawPoints.length > 0) {
			setGeoForm({
				mode: drawMode,
				points: drawPoints.map((point) => ({
					lat: formatCoord(point.lat),
					lng: formatCoord(point.lng)
				})),
				centerLat: "",
				centerLng: "",
				radiusMeters: ""
			});
		}
	}, [isOpen, drawMode, drawPoints]);

	const drawPointsKeyValue = drawPointsKey(drawPoints);

	useEffect(() => {
		if (!isOpen || drawMode !== "polygon") {
			setPolygonEditable((prev) => (prev.length === 0 ? prev : []));
			return;
		}
		if (skipPolygonSyncRef.current) {
			skipPolygonSyncRef.current = false;
			return;
		}
		const next = drawPointsToEditable(drawPoints);
		const nextKey = editablePointsKey(next);
		setPolygonEditable((prev) => (
			editablePointsKey(prev) === nextKey ? prev : next
		));
	}, [isOpen, drawMode, drawPointsKeyValue, drawPoints]);

	const handlePolygonEditableChange = (editable) => {
		setPolygonEditable(editable);
		if (!onDrawPointsChange) return;
		skipPolygonSyncRef.current = true;
		onDrawPointsChange(parseLatLngPoints(editable) || []);
	};

	const handleGeoPointChange = (index, field, value) => {
		setGeoForm((prev) => {
			const nextPoints = [...prev.points];
			nextPoints[index] = { ...nextPoints[index], [field]: value };
			return { ...prev, points: nextPoints };
		});
	};

	const renderGeoInputs = () => {
		if (!drawMode) return null;
		if (drawMode === "point" && geoForm.points[0]) {
			return (
				<div className="event-modal__geo-details event-modal__geo-edit">
					<div className="event-modal__geo-title">Геопозиция</div>
					<div className="event-modal__geo-grid">
						<div className="event-modal__field">
							<label className="event-modal__label">Широта</label>
							<input
								type="number"
								step="0.000001"
								value={geoForm.points[0].lat}
								onChange={(e) => handleGeoPointChange(0, "lat", e.target.value)}
								className="event-modal__input"
							/>
						</div>
						<div className="event-modal__field">
							<label className="event-modal__label">Долгота</label>
							<input
								type="number"
								step="0.000001"
								value={geoForm.points[0].lng}
								onChange={(e) => handleGeoPointChange(0, "lng", e.target.value)}
								className="event-modal__input"
							/>
						</div>
					</div>
				</div>
			);
		}
		if (drawMode === "circle") {
			return (
				<div className="event-modal__geo-details event-modal__geo-edit">
					<div className="event-modal__geo-title">Геопозиция</div>
					<div className="event-modal__geo-grid">
						<div className="event-modal__field">
							<label className="event-modal__label">Центр (lat)</label>
							<input
								type="number"
								step="0.000001"
								value={geoForm.centerLat}
								onChange={(e) => setGeoForm((prev) => ({ ...prev, centerLat: e.target.value }))}
								className="event-modal__input"
							/>
						</div>
						<div className="event-modal__field">
							<label className="event-modal__label">Центр (lng)</label>
							<input
								type="number"
								step="0.000001"
								value={geoForm.centerLng}
								onChange={(e) => setGeoForm((prev) => ({ ...prev, centerLng: e.target.value }))}
								className="event-modal__input"
							/>
						</div>
						<div className="event-modal__field event-modal__field--full">
							<label className="event-modal__label">Радиус (м)</label>
							<input
								type="number"
								step="1"
								value={geoForm.radiusMeters}
								onChange={(e) => setGeoForm((prev) => ({ ...prev, radiusMeters: e.target.value }))}
								className="event-modal__input"
							/>
						</div>
					</div>
				</div>
			);
		}
		if (drawMode === "rectangle" && geoForm.points.length > 0) {
			return (
				<div className="event-modal__geo-details event-modal__geo-edit">
					<div className="event-modal__geo-title">Геопозиция</div>
					<div className="event-modal__geo-points">
						{geoForm.points.map((point, index) => (
							<div key={`geo-${index}`} className="event-modal__geo-point">
								<span className="event-modal__geo-point-label">Точка {index + 1}</span>
								<div className="event-modal__geo-point-inputs">
									<input
										type="number"
										step="0.000001"
										value={point.lat}
										onChange={(e) => handleGeoPointChange(index, "lat", e.target.value)}
										className="event-modal__input"
										placeholder="lat"
									/>
									<input
										type="number"
										step="0.000001"
										value={point.lng}
										onChange={(e) => handleGeoPointChange(index, "lng", e.target.value)}
										className="event-modal__input"
										placeholder="lng"
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			);
		}
		if (drawMode === "polygon") {
			return (
				<div className="event-modal__geo-details event-modal__geo-edit">
					<PolygonCoordinateEditor
						points={polygonEditable.length > 0 ? polygonEditable : drawPointsToEditable(drawPoints)}
						onChange={handlePolygonEditableChange}
						hint="Можно редактировать контур вручную или на карте"
					/>
				</div>
			);
		}
		return null;
	};

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		let geometryPoints = drawPoints;
		if (drawMode === "point" && geoForm.points[0]) {
			const lat = Number(geoForm.points[0].lat);
			const lng = Number(geoForm.points[0].lng);
			if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
				geometryPoints = [{ lat, lng }];
			}
		}
		if (drawMode === "circle") {
			const centerLat = Number(geoForm.centerLat);
			const centerLng = Number(geoForm.centerLng);
			const radiusMeters = Number(geoForm.radiusMeters);
			if (!Number.isNaN(centerLat) && !Number.isNaN(centerLng) && !Number.isNaN(radiusMeters)) {
				const deltaLat = radiusMeters / 111139;
				geometryPoints = [
					{ lat: centerLat, lng: centerLng },
					{ lat: centerLat + deltaLat, lng: centerLng }
				];
			}
		}
		if (drawMode === "rectangle" && geoForm.points.length > 0) {
			const parsedPoints = geoForm.points
				.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
				.filter((point) => !Number.isNaN(point.lat) && !Number.isNaN(point.lng));
			if (parsedPoints.length > 0) {
				geometryPoints = parsedPoints;
			}
		}
		if (drawMode === "polygon") {
			const parsedPoints = parseLatLngPoints(drawPoints, { minCount: 3 });
			if (parsedPoints) {
				geometryPoints = parsedPoints;
			}
		}
		if (onSave) {
			onSave({
				id: initialEvent?.id,
				...formData,
				country: selectedCountry || null,
				marker: selectedMarker || null,
				eventType: selectedEventType || null,
				geometry: { drawMode, drawPoints: geometryPoints }
			});
		}
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className={`event-modal__overlay${initialEvent ? " event-modal__overlay--floating" : ""}`}>
			<div className="event-modal">
				<div className="event-modal__header">
					<h2 className="event-modal__title">
						{initialEvent ? "Редактирование события" : "Регистрация события"}
					</h2>
					<button className="event-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
				</div>
				<div className="event-modal__body">
					<div className="event-modal__summary">
						Выбранная форма: <strong>{geometrySummary()}</strong>
					</div>

					<form className="event-modal__form" onSubmit={handleSubmit}>
						<div className="event-modal__grid">
							<div className="event-modal__field event-modal__field--full">
								<label className="event-modal__label">Название события</label>
								<input
									name="title"
									type="text"
									value={formData.title}
									onChange={handleChange}
									className="event-modal__input"
									placeholder="Введите название"
								/>
							</div>

							<div className="event-modal__field">
								<label className="event-modal__label">Дата начала</label>
								<input
									name="dateStart"
									type="date"
									value={formData.dateStart}
									onChange={handleChange}
									className="event-modal__input"
								/>
							</div>
							<div className="event-modal__field">
								<label className="event-modal__label">Дата завершения</label>
								<input
									name="dateEnd"
									type="date"
									value={formData.dateEnd}
									onChange={handleChange}
									className="event-modal__input"
								/>
							</div>
							<div className="event-modal__field">
								<label className="event-modal__label">Время начала</label>
								<input
									name="timeStart"
									type="time"
									value={formData.timeStart}
									onChange={handleChange}
									className="event-modal__input"
								/>
							</div>
							<div className="event-modal__field">
								<label className="event-modal__label">Время завершения</label>
								<input
									name="timeEnd"
									type="time"
									value={formData.timeEnd}
									onChange={handleChange}
									className="event-modal__input"
								/>
							</div>

							<div className="event-modal__field event-modal__field--full">
								<label className="event-modal__label">Объект</label>
								<input
									name="object"
									type="text"
									value={formData.object}
									onChange={handleChange}
									className="event-modal__input"
									placeholder="Описание объекта"
								/>
							</div>

							<div className="event-modal__field">
								<label className="event-modal__label">Цвет события</label>
								<div className="event-modal__color-row">
									<input
										type="color"
										name="color"
										value={formData.color}
										onChange={handleChange}
										className="event-modal__color-input"
									/>
									<div className="event-modal__color-palette">
										{EVENT_COLORS.map((color) => (
											<button
												key={color}
												type="button"
												className={`event-modal__color-swatch${formData.color === color ? " event-modal__color-swatch--active" : ""}`}
												style={{ backgroundColor: color }}
												onClick={() => setFormData((prev) => ({ ...prev, color }))}
												aria-label={`Выбрать цвет ${color}`}
											/>
										))}
									</div>
								</div>
							</div>

							<div className="event-modal__field">
								<label className="event-modal__label">Тип события</label>
								<select
									name="eventType"
									value={formData.eventType}
									onChange={handleChange}
									className="event-modal__input"
								>
									<option value="">Выберите тип</option>
									{eventTypes.map((type) => (
										<option key={type.id} value={type.id}>
											{type.title}
										</option>
									))}
								</select>
							</div>

							<div className="event-modal__field">
								<label className="event-modal__label">Страна</label>
								<div className="event-modal__dropdown" ref={countryDropdown.dropdownRef}>
									<button
										type="button"
										className="event-modal__dropdown-trigger"
										onClick={countryDropdown.handleToggle}
									>
										<span>{selectedCountry?.title || "Выберите страну"}</span>
										<span className={`event-modal__dropdown-arrow${countryDropdown.isOpen ? " event-modal__dropdown-arrow--open" : ""}`}>▼</span>
									</button>
									{countryDropdown.isOpen && (
										<div className="event-modal__dropdown-menu">
											<div className="event-modal__search-wrapper">
												<input
													ref={countryDropdown.searchInputRef}
													type="text"
													value={countryDropdown.search}
													onChange={(e) => countryDropdown.setSearch(e.target.value)}
													className="event-modal__search-input"
													placeholder="Поиск..."
												/>
											</div>
											<div className="event-modal__dropdown-list">
												{countryDropdown.filtered.length === 0 && (
													<div className="event-modal__no-results">Ничего не найдено</div>
												)}
												{countryDropdown.filtered.map((country) => (
													<button
														key={country.id}
														type="button"
														className={`event-modal__dropdown-option ${formData.country === country.id ? "event-modal__dropdown-option--selected" : ""}`}
														onClick={() => countryDropdown.handleSelect(country.id)}
													>
														{country.title}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							</div>

							<div className="event-modal__field">
								<label className="event-modal__label">Маркер события</label>
								<div className="event-modal__dropdown" ref={markerDropdown.dropdownRef}>
									<button
										type="button"
										className="event-modal__dropdown-trigger"
										onClick={markerDropdown.handleToggle}
									>
										<span className="event-modal__marker-selected">
											<span className="event-modal__marker-icon">
												{selectedMarker && markerSvgs.get(selectedMarker.id) && (
													<span
														dangerouslySetInnerHTML={{ __html: markerSvgs.get(selectedMarker.id) }}
													/>
												)}
											</span>
											<span>{selectedMarker?.title || "Выберите маркер"}</span>
										</span>
										<span className={`event-modal__dropdown-arrow${markerDropdown.isOpen ? " event-modal__dropdown-arrow--open" : ""}`}>▼</span>
									</button>
									{markerDropdown.isOpen && (
										<div className="event-modal__dropdown-menu">
											<div className="event-modal__search-wrapper">
												<input
													ref={markerDropdown.searchInputRef}
													type="text"
													value={markerDropdown.search}
													onChange={(e) => markerDropdown.setSearch(e.target.value)}
													className="event-modal__search-input"
													placeholder="Поиск..."
												/>
											</div>
											<div className="event-modal__dropdown-list">
												{markerDropdown.filtered.length === 0 && (
													<div className="event-modal__no-results">Ничего не найдено</div>
												)}
												{markerDropdown.filtered.map((marker) => (
													<button
														key={marker.id}
														type="button"
														className={`event-modal__dropdown-option event-modal__dropdown-option--marker ${formData.marker === marker.id ? "event-modal__dropdown-option--selected" : ""}`}
														onClick={() => markerDropdown.handleSelect(marker.id)}
													>
														<span className="event-modal__marker-icon">
															{markerSvgs.get(marker.id) && (
																<span dangerouslySetInnerHTML={{ __html: markerSvgs.get(marker.id) }} />
															)}
														</span>
														<span>{marker.title}</span>
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>

						<div className="event-modal__field event-modal__field--full">
							<label className="event-modal__label">Дополнительная информация</label>
							<MarkdownEditor
								value={formData.info}
								onChange={(val) => setFormData((prev) => ({ ...prev, info: val }))}
								placeholder="Дополнительная информация"
								rows={4}
							/>
						</div>
						{renderGeoInputs()}
						<div className="event-modal__footer">
							<button type="button" className="event-modal__btn event-modal__btn--ghost" onClick={onClose}>Отмена</button>
							<button type="submit" className="event-modal__btn">Сохранить</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
