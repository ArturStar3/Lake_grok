import { useState } from 'react';

/** Открытие ленивых модалок и редакторов формуляра. */
export function useFormularEditorState() {
    const [usersAdminOpen, setUsersAdminOpen] = useState(false);
    const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
    const [addTargetDraft, setAddTargetDraft] = useState(null);
    const [formularEditorTarget, setFormularEditorTarget] = useState(null);
    const [editTargetId, setEditTargetId] = useState(null);
    const [editTargetFormPatch, setEditTargetFormPatch] = useState(null);
    const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editEventDrawMode, setEditEventDrawMode] = useState(null);
    const [editEventDrawPoints, setEditEventDrawPoints] = useState([]);
    const [isReferenceDataOpen, setReferenceDataOpen] = useState(false);
    const [isReportsOpen, setReportsOpen] = useState(false);
    const [isDataExchangeOpen, setDataExchangeOpen] = useState(false);
    const [referenceEquipmentId, setReferenceEquipmentId] = useState(null);

    return {
        usersAdminOpen,
        setUsersAdminOpen,
        isAddTargetModalOpen,
        setIsAddTargetModalOpen,
        addTargetDraft,
        setAddTargetDraft,
        formularEditorTarget,
        setFormularEditorTarget,
        editTargetId,
        setEditTargetId,
        editTargetFormPatch,
        setEditTargetFormPatch,
        isEditEventModalOpen,
        setIsEditEventModalOpen,
        editingEvent,
        setEditingEvent,
        editEventDrawMode,
        setEditEventDrawMode,
        editEventDrawPoints,
        setEditEventDrawPoints,
        isReferenceDataOpen,
        setReferenceDataOpen,
        isReportsOpen,
        setReportsOpen,
        isDataExchangeOpen,
        setDataExchangeOpen,
        referenceEquipmentId,
        setReferenceEquipmentId,
    };
}
