import { useEffect, useRef, useState } from 'react';

/** Рисование и модалка оперативной обстановки на главном экране. */
export function useFormularSituationState() {
    const [isSituationDrawActive, setIsSituationDrawActive] = useState(false);
    const [situationDrawPolygons, setSituationDrawPolygons] = useState([]);
    const [situationDrawPoints, setSituationDrawPoints] = useState([]);
    const [situationDrawTerritoryIndex, setSituationDrawTerritoryIndex] = useState(0);
    const situationDrawTerritoryIndexRef = useRef(0);
    const situationDrawPolygonsRef = useRef([]);
    const [situationModalOpen, setSituationModalOpen] = useState(false);
    const [situationModalMode, setSituationModalMode] = useState('create');
    const [situationModalTarget, setSituationModalTarget] = useState(null);
    const [situationModalRevisionId, setSituationModalRevisionId] = useState(null);
    const [detailSituation, setDetailSituation] = useState(null);
    const [situationRevisions, setSituationRevisions] = useState([]);
    const [focusedSituationId, setFocusedSituationId] = useState(null);
    const [timelineRevisionId, setTimelineRevisionId] = useState(null);
    const [highlightedSituationId, setHighlightedSituationId] = useState(null);

    useEffect(() => {
        situationDrawTerritoryIndexRef.current = situationDrawTerritoryIndex;
    }, [situationDrawTerritoryIndex]);

    useEffect(() => {
        situationDrawPolygonsRef.current = situationDrawPolygons;
    }, [situationDrawPolygons]);

    return {
        isSituationDrawActive,
        setIsSituationDrawActive,
        situationDrawPolygons,
        setSituationDrawPolygons,
        situationDrawPoints,
        setSituationDrawPoints,
        situationDrawTerritoryIndex,
        setSituationDrawTerritoryIndex,
        situationDrawTerritoryIndexRef,
        situationDrawPolygonsRef,
        situationModalOpen,
        setSituationModalOpen,
        situationModalMode,
        setSituationModalMode,
        situationModalTarget,
        setSituationModalTarget,
        situationModalRevisionId,
        setSituationModalRevisionId,
        detailSituation,
        setDetailSituation,
        situationRevisions,
        setSituationRevisions,
        focusedSituationId,
        setFocusedSituationId,
        timelineRevisionId,
        setTimelineRevisionId,
        highlightedSituationId,
        setHighlightedSituationId,
    };
}
