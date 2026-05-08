import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { hapticMedium, hapticError } from '../utils/haptics';

interface VoiceInputButtonProps {
    onResult: (text: string) => void;
    className?: string;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onResult, className = '' }) => {
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const reco = new SpeechRecognition();
            reco.continuous = false;
            reco.interimResults = false;
            reco.lang = 'ko-KR'; // 한국어 설정

            reco.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onResult(transcript);
                setIsListening(false);
                hapticMedium();
            };

            reco.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
                if (event.error !== 'no-speech') {
                    hapticError();
                    alert("음성 인식 중 오류가 발생했습니다. 권한을 확인해주세요.");
                }
            };

            reco.onend = () => {
                setIsListening(false);
            };

            setRecognition(reco);
        } else {
            setIsSupported(false);
        }
    }, [onResult]);

    const toggleListen = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!recognition) return;

        hapticMedium();
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                setIsListening(true);
            } catch (err) {
                console.error("Failed to start recognition", err);
            }
        }
    }, [isListening, recognition]);

    if (!isSupported) return null;

    return (
        <button
            type="button"
            onClick={toggleListen}
            className={`p-2 rounded-full transition-all flex items-center justify-center shadow-sm
                ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}
                ${className}
            `}
            title={isListening ? "듣는 중... (클릭 시 중지)" : "음성으로 입력하기"}
        >
            {isListening ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
        </button>
    );
};

export default VoiceInputButton;
