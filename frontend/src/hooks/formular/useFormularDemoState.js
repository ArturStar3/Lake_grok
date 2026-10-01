import { useRef, useState } from 'react';

/** Студия демонстрации и сессия правки текста на карте. */
export function useFormularDemoState() {
    const [demoStudioOpen, setDemoStudioOpen] = useState(false);
    const [demoStudioPreviewHide, setDemoStudioPreviewHide] = useState(null);
    const [demoContentCardId, setDemoContentCardId] = useState(null);
    const [formularInitialCardId, setFormularInitialCardId] = useState(null);
    const [demoTextEditSession, setDemoTextEditSession] = useState(null);
    const demoTextEditSessionRef = useRef(null);
    const demoTextMapApplyRef = useRef(null);

    return {
        demoStudioOpen,
        setDemoStudioOpen,
        demoStudioPreviewHide,
        setDemoStudioPreviewHide,
        demoContentCardId,
        setDemoContentCardId,
        formularInitialCardId,
        setFormularInitialCardId,
        demoTextEditSession,
        setDemoTextEditSession,
        demoTextEditSessionRef,
        demoTextMapApplyRef,
    };
}
