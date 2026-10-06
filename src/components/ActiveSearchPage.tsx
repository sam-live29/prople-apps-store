import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, 
  ArrowLeft,
  Mic, 
  Search, 
  History, 
  ArrowUpLeft, 
  X, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useStoreConfig } from '../context/StoreConfigContext';
import { 
  getSearchHistory, 
  saveSearchQuery, 
  SearchHistoryItem 
} from '../utils/searchHistory';
import { useToast } from '../context/ToastContext';
import { playVoiceListeningStartSound, playVoiceRecognizedSound } from '../utils/soundEffects';
import { detectClientOS, sortAppsByDeviceCompatibility } from '../services/osDetectionService';
import { safeFetchJson } from '../utils/safeFetch';
import { requestBrowserMicrophonePermission } from '../utils/permissionUtils';

interface ActiveSearchPageProps {
  initialQuery?: string;
  autoStartVoice?: boolean;
  onClose: () => void;
  onSearch?: (query: string) => void;
}

// Buffer configuration
const DEBOUNCE_BUFFER_MS = 1800; // 1.8-second buffer after voice transcription before search execution
const MAX_VOICE_QUERY_LENGTH = 300; // Generous character limit for long speech threads: automatically triggers search if reached

/**
 * Normalizes tokens for string comparison (lowercase, stripping punctuation).
 */
function normalizeForComparison(word: string): string {
  return word.toLowerCase().replace(/[^\w]/g, '');
}

/**
 * Removes immediate consecutive duplicate words and repeated phrases (n-grams from 2 to 4 words).
 * Prevents Speech Recognition engine artifacts from repeating words that were not spoken repeatedly.
 * E.g. "Productivity Productivity" -> "Productivity"
 * E.g. "photo editor photo editor" -> "photo editor"
 */
function removeRepeatedTokens(text: string): string {
  if (!text) return '';
  const tokens = text.trim().split(/\s+/);
  if (tokens.length <= 1) return text.trim();

  // 1. Remove consecutive identical words
  const deduplicatedWords: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const prev = deduplicatedWords[deduplicatedWords.length - 1];
    const cleanCurr = normalizeForComparison(current);
    const cleanPrev = prev ? normalizeForComparison(prev) : '';

    if (cleanPrev && cleanCurr && cleanCurr === cleanPrev) {
      // Skip repeated word
      continue;
    }
    deduplicatedWords.push(current);
  }

  // 2. Remove consecutive repeated phrases (lengths 4, 3, 2)
  let result = deduplicatedWords;
  for (let phraseLen = 4; phraseLen >= 2; phraseLen--) {
    if (result.length < phraseLen * 2) continue;
    let i = 0;
    const newResult: string[] = [];
    while (i < result.length) {
      if (i + 2 * phraseLen <= result.length) {
        const phrase1 = result.slice(i, i + phraseLen).map(normalizeForComparison).join(' ');
        const phrase2 = result.slice(i + phraseLen, i + 2 * phraseLen).map(normalizeForComparison).join(' ');
        if (phrase1 && phrase1 === phrase2) {
          for (let k = 0; k < phraseLen; k++) {
            newResult.push(result[i + k]);
          }
          i += 2 * phraseLen;
          continue;
        }
      }
      newResult.push(result[i]);
      i++;
    }
    result = newResult;
  }

  return result.join(' ');
}

/**
 * Cleans and merges finalized text and interim transcript, ensuring no duplicated
 * overlapping words at the boundary or across segments (common in Web Speech API on mobile).
 */
function cleanAndDeduplicateTranscript(finalText: string, interimText: string): string {
  const cleanFinal = removeRepeatedTokens(finalText || '');
  const cleanInterim = removeRepeatedTokens(interimText || '');

  if (!cleanFinal) return cleanInterim;
  if (!cleanInterim) return cleanFinal;

  const finalLower = cleanFinal.toLowerCase();
  const interimLower = cleanInterim.toLowerCase();

  // If interim already starts with the entirety of final text (Android Chrome WebSpeech quirk)
  if (interimLower.startsWith(finalLower)) {
    return cleanInterim;
  }

  // If final text already ends with interim text
  if (finalLower.endsWith(interimLower)) {
    return cleanFinal;
  }

  // Check for word-level suffix/prefix overlap
  const finalWords = cleanFinal.split(/\s+/);
  const interimWords = cleanInterim.split(/\s+/);
  const maxOverlap = Math.min(finalWords.length, interimWords.length);
  let overlapLen = 0;

  for (let len = maxOverlap; len >= 1; len--) {
    const finalSuffix = finalWords.slice(finalWords.length - len).map(normalizeForComparison).join(' ');
    const interimPrefix = interimWords.slice(0, len).map(normalizeForComparison).join(' ');
    if (finalSuffix && finalSuffix === interimPrefix) {
      overlapLen = len;
      break;
    }
  }

  let merged = '';
  if (overlapLen > 0) {
    const remainingInterim = interimWords.slice(overlapLen).join(' ');
    merged = remainingInterim ? `${cleanFinal} ${remainingInterim}` : cleanFinal;
  } else {
    merged = `${cleanFinal} ${cleanInterim}`;
  }

  return removeRepeatedTokens(merged);
}

export default function ActiveSearchPage({ 
  initialQuery = '', 
  autoStartVoice = false, 
  onClose, 
  onSearch 
}: ActiveSearchPageProps) {
  const { allAppListings } = useStoreConfig();
  const { showToast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [historyList, setHistoryList] = useState<SearchHistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Web Speech API State & Controls
  const recognitionRef = useRef<any>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const clearDebounceTimer = () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }
  };

  const executeVoiceSearchImmediately = (textToSearch?: string) => {
    clearDebounceTimer();
    const rawText = textToSearch !== undefined ? textToSearch : voiceTranscript;
    const deduplicated = removeRepeatedTokens(rawText || '');
    const trimmed = deduplicated.trim().slice(0, MAX_VOICE_QUERY_LENGTH);
    if (!trimmed) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
    setIsSpeechDetected(false);
    setShowVoiceModal(false);
    playVoiceRecognizedSound();
    handleExecuteSearch(trimmed);
  };

  const requestMicPermission = async (): Promise<boolean> => {
    const res = await requestBrowserMicrophonePermission();
    if (res === 'denied') return false;
    return true;
  };

  const startListening = async () => {
    clearDebounceTimer();

    // Prevent virtual keyboard from opening
    inputRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice search is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    setShowVoiceModal(true);
    setIsListening(true);
    isListeningRef.current = true;
    setIsSpeechDetected(false);
    setVoiceError(null);
    setVoiceTranscript('');

    // Pre-flight check: trigger browser's native microphone permission prompt if needed
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      setIsListening(false);
      isListeningRef.current = false;
      setIsSpeechDetected(false);
      setVoiceError('Microphone permission was denied. Please allow microphone access in your browser settings.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true; // Continuous speech gathering so inter-word pauses won't cut off abruptly
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setVoiceError(null);
        playVoiceListeningStartSound();
      };

      recognition.onaudiostart = () => {
        setIsSpeechDetected(true);
        clearDebounceTimer();
      };

      recognition.onsoundstart = () => {
        setIsSpeechDetected(true);
        clearDebounceTimer();
      };

      recognition.onspeechstart = () => {
        setIsSpeechDetected(true);
        clearDebounceTimer();
      };

      recognition.onspeechend = () => {
        setIsSpeechDetected(false);
      };

      recognition.onresult = (event: any) => {
        const finalSegments: string[] = [];
        const interimSegments: string[] = [];

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = (res[0]?.transcript || '').trim();
          if (!text) continue;

          if (res.isFinal) {
            const prev = finalSegments[finalSegments.length - 1];
            // Don't duplicate if engine emitted identical consecutive final segment
            if (!prev || normalizeForComparison(prev) !== normalizeForComparison(text)) {
              finalSegments.push(text);
            }
          } else {
            interimSegments.push(text);
          }
        }

        const finalText = finalSegments.join(' ');
        const interimText = interimSegments.join(' ');
        const currentText = cleanAndDeduplicateTranscript(finalText, interimText);

        if (!currentText) return;

        setVoiceTranscript(currentText);
        setQuery(currentText);

        // Character limit handling without showing counter:
        // If transcript length meets or crosses MAX_VOICE_QUERY_LENGTH, automatically trigger immediate search
        if (currentText.length >= MAX_VOICE_QUERY_LENGTH) {
          executeVoiceSearchImmediately(currentText);
          return;
        }

        // Debounce Search Execution Buffer:
        // Set a 1.8-second buffer after voice input. Fresh speech resets the countdown timer.
        clearDebounceTimer();
        searchDebounceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) {
            executeVoiceSearchImmediately(currentText);
          }
        }, DEBOUNCE_BUFFER_MS);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'aborted') {
          return;
        }

        // If user already transcribed words and engine triggers quiet timeout, let the pending search complete
        if (voiceTranscript.trim() && (event.error === 'no-speech' || event.error === 'network')) {
          if (searchDebounceTimerRef.current) {
            return;
          }
        }

        clearDebounceTimer();
        setIsListening(false);
        isListeningRef.current = false;
        setIsSpeechDetected(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setVoiceError("Didn't catch any speech. Tap the microphone to try again.");
        } else if (event.error === 'network') {
          setVoiceError('Network error connecting to speech recognition service.');
        } else if (event.error === 'audio-capture') {
          setVoiceError('No microphone detected. Please check your audio input hardware.');
        } else {
          setVoiceError(`Voice recognition error (${event.error}). Tap to retry.`);
        }
      };

      recognition.onend = () => {
        setIsSpeechDetected(false);
        // Only mark completely inactive if no pending debounced execution exists
        if (!searchDebounceTimerRef.current && !voiceTranscript.trim()) {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.start();
    } catch (err: any) {
      console.warn('Failed to start voice recognition:', err);
      clearDebounceTimer();
      setIsListening(false);
      isListeningRef.current = false;
      setIsSpeechDetected(false);
      setVoiceError('Could not initialize microphone. Please check permissions.');
    }
  };

  const stopListening = () => {
    clearDebounceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
    setIsSpeechDetected(false);
  };

  const cancelVoiceSearch = () => {
    clearDebounceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
    setIsSpeechDetected(false);
    setShowVoiceModal(false);
    setVoiceError(null);
    setVoiceTranscript('');
  };

  // Immediate microphone action inside the voice modal:
  // If user tapped mic while words are transcribed, execute search immediately without waiting for countdown
  const handleModalMicClick = () => {
    if (voiceError) {
      startListening();
      return;
    }
    if (voiceTranscript.trim().length > 0) {
      executeVoiceSearchImmediately(voiceTranscript);
      return;
    }
    if (isListening) {
      cancelVoiceSearch();
    } else {
      startListening();
    }
  };

  useEffect(() => {
    // Check/request native microphone permission seamlessly on search mount (same as notification permission)
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'microphone' as PermissionName })
          .then((status) => {
            if (status.state === 'prompt' && autoStartVoice) {
              requestBrowserMicrophonePermission().catch(() => {});
            }
          })
          .catch(() => {});
      }
    }
  }, [autoStartVoice]);

  useEffect(() => {
    if (autoStartVoice) {
      startListening();
    }
  }, [autoStartVoice]);

  // Prevent virtual keyboard from opening on voice search
  useEffect(() => {
    if (autoStartVoice || showVoiceModal || isListening) {
      inputRef.current?.blur();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } else {
      // Focus text input only when typing
      const timer = setTimeout(() => {
        if (!isListeningRef.current && !showVoiceModal) {
          inputRef.current?.focus({ preventScroll: true });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoStartVoice, showVoiceModal, isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    setHistoryList(getSearchHistory());
  }, []);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleExecuteSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const updatedHistory = saveSearchQuery(trimmed);
    setHistoryList(updatedHistory);
    onSearch?.(trimmed);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    clearDebounceTimer();
    if (showVoiceModal) {
      executeVoiceSearchImmediately(query);
    } else {
      handleExecuteSearch(query);
    }
  };

  useEffect(() => {
    return () => {
      clearDebounceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showVoiceModal) {
          cancelVoiceSearch();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVoiceModal, onClose]);

  const clientOS = useMemo(() => detectClientOS(), []);

  // Compile searchable terms separated by priority: App Names first, then Topics/Categories, then Publishers
  const appNamesDictionary = useMemo(() => {
    const names = new Set<string>();
    const prioritizedApps = sortAppsByDeviceCompatibility(allAppListings, clientOS);
    prioritizedApps.forEach(app => {
      if (app.name) names.add(app.name);
    });
    return Array.from(names);
  }, [allAppListings, clientOS]);

  const topicsDictionary = useMemo(() => {
    const topics = new Set<string>();
    allAppListings.forEach(app => {
      if (app.category) topics.add(app.category);
      if (app.tags && Array.isArray(app.tags)) {
        app.tags.forEach((t: string) => topics.add(t));
      }
    });
    topics.add('Games');
    topics.add('Productivity');
    topics.add('Utilities');
    topics.add('Entertainment');
    return Array.from(topics);
  }, [allAppListings]);

  const publishersDictionary = useMemo(() => {
    const pubs = new Set<string>();
    allAppListings.forEach(app => {
      if (app.developer) pubs.add(app.developer);
      const pName = (app as any).publisherName;
      if (pName) pubs.add(pName);
    });
    return Array.from(pubs);
  }, [allAppListings]);

  // Remote indexed suggestions from Meilisearch
  const [remoteSuggestions, setRemoteSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      safeFetchJson<{ success: boolean; hits: any[] }>(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=6&platform=${encodeURIComponent(clientOS)}`,
        { signal: controller.signal }
      )
        .then(({ ok, data }) => {
          if (ok && data?.success && Array.isArray(data.hits)) {
            const hitTitles = data.hits.map((h: any) => h.name).filter(Boolean);
            setRemoteSuggestions(hitTitles);
          }
        })
        .catch(() => {});
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, clientOS]);

  // Compute live search suggestions with App Names strictly prioritized over publishers
  const liveSuggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const suggestions: { text: string; isHistory: boolean }[] = [];

    // 1. Check matching search history
    historyList.slice(0, 4).forEach(item => {
      if (item.query.toLowerCase().includes(trimmed)) {
        suggestions.push({ text: item.query, isHistory: true });
      }
    });

    // 2. Add remote / server indexed app name hits
    remoteSuggestions.forEach(name => {
      if (!suggestions.some(s => s.text.toLowerCase() === name.toLowerCase())) {
        suggestions.push({ text: name, isHistory: false });
      }
    });

    // 3. Add local catalog App Names (Highest priority over publishers)
    appNamesDictionary.forEach(appName => {
      if (
        appName.toLowerCase().includes(trimmed) &&
        !suggestions.some(s => s.text.toLowerCase() === appName.toLowerCase())
      ) {
        suggestions.push({ text: appName, isHistory: false });
      }
    });

    // 4. Add topic / category / tag matching terms
    topicsDictionary.forEach(topic => {
      if (
        topic.toLowerCase().includes(trimmed) &&
        !suggestions.some(s => s.text.toLowerCase() === topic.toLowerCase())
      ) {
        suggestions.push({ text: topic, isHistory: false });
      }
    });

    // 5. Add publisher names only if user explicitly searches or room remains
    publishersDictionary.forEach(pub => {
      if (
        pub.toLowerCase().includes(trimmed) &&
        !suggestions.some(s => s.text.toLowerCase() === pub.toLowerCase())
      ) {
        suggestions.push({ text: pub, isHistory: false });
      }
    });

    // Always allow searching the raw query if not exact match
    if (!suggestions.some(s => s.text.toLowerCase() === trimmed)) {
      suggestions.unshift({ text: query.trim(), isHistory: false });
    }

    return suggestions.slice(0, 10);
  }, [query, historyList, appNamesDictionary, topicsDictionary, publishersDictionary, remoteSuggestions]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-theme-bg text-theme-text font-sans w-full shadow-none overflow-hidden selection:bg-blue-500/30">
      {/* Search Header mirroring Explore Page layout with mic in PFP position */}
      <header className="h-[60px] sm:h-[68px] flex items-center justify-between px-2.5 sm:px-4 md:px-6 bg-theme-bg shrink-0 gap-3 z-20 w-full border-0">
        {/* Left: Back button (matching menu button sizing) + Brand logo on desktop */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 -translate-x-[2px]">
          <button 
            type="button"
            id="search-header-back-button"
            onClick={onClose} 
            className="w-8 h-8 text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 rounded-full transition-colors cursor-pointer flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center">
            <BrandLogo size="md" showText={true} onClick={onClose} />
          </div>
        </div>

        {/* Center: Search input form matching Explore tab header position */}
        <div className="flex-1 min-w-0 max-w-full md:max-w-[539px] lg:max-w-[639px]">
          <form onSubmit={handleSubmit} className="w-full min-w-0 flex items-center bg-theme-hover md:bg-theme-bg md:border md:border-theme-border rounded-full h-[46px] px-4 transition-colors overflow-hidden m-0">
            <div className="flex items-center min-w-0 flex-1 gap-3">
              <Search className="w-4.5 h-4.5 text-theme-text-muted shrink-0" />
              <input 
                type="text" 
                ref={inputRef}
                placeholder="Search apps and games" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-0 w-full bg-transparent text-theme-text text-[15px] font-normal focus:outline-none placeholder:text-theme-text-muted"
              />
            </div>
            {query && (
              <button 
                type="button" 
                onClick={() => setQuery('')} 
                className="p-1 -mr-1 text-theme-text-muted hover:text-theme-text rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors" 
                aria-label="Clear query"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        {/* Right: Mic button matching PFP slot position and size */}
        <div className="flex items-center gap-2 shrink-0 -translate-x-[4px]">
          <button 
            type="button"
            id="search-header-mic-button"
            onClick={() => {
              inputRef.current?.blur();
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              if (isListening) {
                cancelVoiceSearch();
              } else {
                startListening();
              }
            }}
            className={`w-8 h-8 rounded-full ${isListening ? 'bg-blue-500 text-white' : 'bg-theme-hover hover:bg-theme-active text-theme-text'} flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity`}
            aria-label={isListening ? "Stop voice search" : "Start voice search"}
            title="Search with microphone"
          >
            <Mic className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

        {/* Main Content Area - Aligned directly with header bounds */}
        <div
          tabIndex={0}
          className="flex-1 overflow-y-auto px-2.5 sm:px-4 md:px-6 pb-8 w-full flex flex-col outline-none focus:outline-none overscroll-y-contain"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          <div className="w-full flex-1 flex flex-col">
            {query.trim().length > 0 ? (
              /* Live Search Suggestions (while typing) */
              <div className="pt-0 pb-2 flex flex-col w-full">
                {liveSuggestions.map((item, idx) => (
                  <div 
                    key={`suggestion-${idx}`}
                    onClick={() => handleExecuteSearch(item.text)}
                    className="flex items-center justify-between py-3 hover:bg-theme-hover/50 rounded-xl cursor-pointer transition-colors group w-full"
                  >
                    {/* Left Icon aligned directly with header back button */}
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center text-theme-text-muted">
                      {item.isHistory ? (
                        <History className="w-6 h-6 text-theme-text-muted" />
                      ) : (
                        <Search className="w-6 h-6 text-theme-text-muted" />
                      )}
                    </div>

                    {/* Normal website font size text-[15px] aligned with header search input */}
                    <div className="flex-1 min-w-0 px-3 flex items-center">
                      <span className="text-[15px] text-theme-text truncate font-normal">
                        {item.text}
                      </span>
                    </div>

                    {/* Right Arrow button aligned directly with header mic button */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuery(item.text);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-theme-text-muted hover:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors cursor-pointer"
                      title="Insert query"
                      aria-label="Insert query in search bar"
                    >
                      <ArrowUpLeft className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : historyList.length > 0 ? (
              /* Unified Recent Searches - Max 4 records, aligned identically with suggestions */
              <div className="pt-0 pb-2 flex flex-col w-full">
                {historyList.slice(0, 4).map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleExecuteSearch(item.query)}
                    className="flex items-center justify-between py-3 hover:bg-theme-hover/50 rounded-xl cursor-pointer transition-colors group w-full"
                  >
                    {/* Clock Icon aligned identically with suggestions and header back button */}
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center text-theme-text-muted">
                      <History className="w-6 h-6 text-theme-text-muted" />
                    </div>

                    {/* Normal website font size text-[15px] aligned with header search input */}
                    <div className="flex-1 min-w-0 px-3 flex items-center">
                      <span className="text-[15px] text-theme-text truncate font-normal">
                        {item.query}
                      </span>
                    </div>

                    {/* Arrow button aligned directly with header mic button */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuery(item.query);
                      }} 
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-theme-text-muted hover:text-theme-text hover:bg-theme-hover active:bg-theme-hover/80 transition-colors cursor-pointer"
                      title="Insert query"
                      aria-label="Insert query in search bar"
                    >
                      <ArrowUpLeft className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Clean state when no recent searches exist */
              <div className="flex flex-col items-center justify-center pt-16 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-theme-hover flex items-center justify-center text-theme-text-muted mb-4">
                  <Search className="w-7 h-7 stroke-[1.5]" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#0f172a] dark:text-[#f3f4f6] mb-1">
                  Search the App Store
                </h3>
                <p className="text-[14px] text-[#475569] dark:text-[#9aa0a6] max-w-[280px]">
                  Type to search for verified releases, games, productivity tools, and categories.
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Cloaktail Speech Services Style Voice Search Overlay */}
      {showVoiceModal && (
        <div 
          id="voice-search-modal-backdrop"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-2 sm:px-4 bg-black/75 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={cancelVoiceSearch}
        >
          {/* Main Centered Voice Card - uniformly scaled to edge-to-edge mobile width and proportional height */}
          <div 
            id="voice-search-modal-card"
            className="relative w-[96vw] max-w-[420px] sm:max-w-[440px] min-h-[330px] sm:min-h-[350px] bg-[#202124] text-white rounded-[6px] shadow-[0_16px_45px_rgba(0,0,0,0.85)] flex flex-col items-center justify-between text-center overflow-hidden px-6 py-7 sm:px-7 sm:py-8 gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cloaktail Wordmark Title */}
            <h2 className="text-[24px] sm:text-[25px] font-normal tracking-tight text-white select-none shrink-0">
              Cloaktail
            </h2>

            {/* Concentric Circle Mic Component (Uniformly scaled) */}
            <div className="relative my-1 flex items-center justify-center shrink-0">
              {/* Outer Slate/Navy Ring */}
              <div className="relative w-[126px] h-[126px] rounded-full bg-[#2a374b] flex items-center justify-center">
                {isListening && (
                  <>
                    <div 
                      className="absolute inset-0 rounded-full bg-[#8ab4f8]/20 animate-ping pointer-events-none" 
                      style={{ animationDuration: '2.4s' }} 
                    />
                    <div className="absolute inset-1 rounded-full bg-[#3d4f6a]/50 animate-pulse pointer-events-none" />
                  </>
                )}

                {/* Inner Bright Sky-Blue Button */}
                <button
                  type="button"
                  id="voice-modal-action-btn"
                  onClick={handleModalMicClick}
                  className={`relative z-10 w-[90px] h-[90px] rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
                    voiceError 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa]'
                  }`}
                  aria-label={voiceError ? "Retry voice search" : voiceTranscript.trim() ? "Search immediately" : isListening ? "Stop listening" : "Start listening"}
                  title={voiceError ? "Retry" : voiceTranscript.trim() ? "Tap to search now" : isListening ? "Tap to stop" : "Tap to speak"}
                >
                  {voiceError ? (
                    <RefreshCw className="w-[38px] h-[38px]" />
                  ) : (
                    <svg className={`w-[38px] h-[38px] text-[#131314] ${isListening ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Live Voice Transcript or Prompt Text */}
            <div className="w-full min-h-[54px] max-h-[130px] overflow-y-auto scrollbar-hide flex flex-col items-center justify-start px-2 my-0.5">
              <p className="text-[16px] sm:text-[17px] font-normal text-white text-center leading-snug break-words my-auto">
                {voiceError 
                  ? voiceError 
                  : voiceTranscript 
                    ? voiceTranscript 
                    : isListening 
                      ? "Listening..." 
                      : "Tap mic to speak"}
              </p>
              {voiceError && voiceError.toLowerCase().includes('permission') && (
                <button
                  type="button"
                  onClick={async () => {
                    setVoiceError(null);
                    await startListening();
                  }}
                  className="mt-2.5 px-4 py-1.5 bg-[#8ab4f8] text-[#131314] text-[13px] font-medium rounded-full hover:bg-[#a8c7fa] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Ask mic permission</span>
                </button>
              )}
            </div>

            {/* Language indicator at bottom of card */}
            <p className="text-[14px] sm:text-[15px] text-[#9aa0a6] font-normal tracking-wide select-none shrink-0">
              English (India)
            </p>
          </div>

          {/* Floating Bottom Toast Banner (Matched edge-to-edge width and scaled typography) */}
          <div 
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[96vw] max-w-[420px] sm:max-w-[440px] bg-[#202124] text-[#c4c7c5] px-5 py-3 rounded-[6px] shadow-2xl text-center text-[13.5px] leading-[1.4] select-none pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            Cloaktail speech services converts audio to text and shares the text with this app.
          </div>
        </div>
      )}
    </div>
  );
}
