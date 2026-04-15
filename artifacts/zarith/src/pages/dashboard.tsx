// Interface para os segmentos que o backend envia
interface MessageSegment {
  type: 'text' | 'emotion';
  content: string;
}

const speak = (segments: MessageSegment[], onStart?: () => void, onEnd?: () => void) => {
  if (!window.speechSynthesis || !segments.length) return;
  
  window.speechSynthesis.cancel();
  if (onStart) onStart();

  let currentIndex = 0;

  const playNext = () => {
    if (currentIndex >= segments.length) {
      if (onEnd) onEnd();
      return;
    }

    const segment = segments[currentIndex];
    currentIndex++;

    if (segment.type === 'text') {
      const utterance = new SpeechSynthesisUtterance(segment.content);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.includes('Google Maria') || v.name.includes('Luciana'));
      if (femaleVoice) utterance.voice = femaleVoice;

      utterance.onend = playNext;
      window.speechSynthesis.speak(utterance);
    } else {
      // Aqui tratamos a emoção [laugh, sigh, etc]
      // Por enquanto, apenas um pequeno log, mas você pode tocar um áudio curto aqui
      console.log(`Zarith emotion: ${segment.content}`);
      setTimeout(playNext, 800); // Pausa dramática para a emoção
    }
  };

  playNext();
};
