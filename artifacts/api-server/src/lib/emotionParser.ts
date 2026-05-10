export interface MessageSegment {
  type: 'text' | 'emotion';
  content: string;
}

export const parseZarithEmotions = (text: string): MessageSegment[] => {
  // Captura tags como [laugh], [sigh], [gasp], [cry]
  const emotionRegex = /(\[(?:laugh|sigh|gasp|cry|thinking)\])/g;
  
  return text.split(emotionRegex).map(segment => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      return { 
        type: 'emotion' as const, 
        content: segment.replace(/[\[\]]/g, '') 
      };
    }
    return { type: 'text' as const, content: segment };
  }).filter(s => s.content.trim() !== "");
};
