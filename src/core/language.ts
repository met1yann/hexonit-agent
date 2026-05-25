const TR_CHARS = /[ğüşıöçĞÜŞİÖÇ]/;
const TR_COMMON = /\b(ben|sen|bir|ve|bu|ile|ama|veya|için|gibi|kadar|çok|daha|yok|var|ne|mi|mı|de|da|olan|olarak|üzere|sonra|önce|şey|yer|zaman|nasıl|neden|kim|hangi|bana|sana|ona|bize|size|onlara|beni|seni|onu|bizi|sizi|onları|bizim|sizin|onların|kendi|tüm|her|bazı|hiç|çünkü|eğer|şu|o|böyle|şöyle|öyle|artık|henüz|hala|yine|gene|bile|ancak|sadece|yalnızca|acaba|belki|yani|gerçi|nasılsın|merhaba|selam|teşekkür|lütfen|tamam|peki|evet|hayır|yok|belki|nerede|neden|nasıl|kim|hangi)\b/i;

const EN_COMMON = /\b(the|is|are|was|were|have|has|do|does|did|can|could|will|would|shall|should|may|might|this|that|these|those|and|but|or|for|nor|yet|so|with|from|about|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|every|both|few|more|most|other|some|such|no|nor|not|only|own|same|than|too|very|just|because|also|if|then|else|what|which|who|whom|hello|hi|hey|thanks|thank|please|yes|no|okay|sure|help|can|make|need|want|know|think|look|see|find|give|tell|ask|try|leave|take|come|go|get|set|put|use|let|start|stop|run|do|be)\b/i;

export function detectLanguage(text: string): 'tr' | 'en' {
  if (TR_CHARS.test(text)) return 'tr';
  const words = text.split(/\s+/).filter(w => w.length > 2);
  let trScore = 0, enScore = 0;
  for (const w of words) {
    if (TR_COMMON.test(w)) trScore++;
    if (EN_COMMON.test(w)) enScore++;
  }
  if (trScore > enScore) return 'tr';
  return 'en';
}

export function getLanguageInstruction(lang: 'tr' | 'en'): string {
  if (lang === 'tr') {
    return `\n\n=== DIL KURALI ===
Kullanıcı Türkçe yazdığı için SEN DE TÜRKÇE yanıtla.
Asla İngilizce yanıt verme. Kod blokları, terimler ve değişken isimleri hariç tüm açıklamaların Türkçe olmalı.
Kullanıcı Türkçe sorduğunda İngilizce yanıt verirsen bu kural ihlali sayılır.`;
  }
  return `\n\n=== LANGUAGE RULE ===
The user wrote in English, so you MUST respond in English.
All explanations, reasoning, and comments should be in English.
Code blocks, technical terms, and variable names can stay in English.
Responding in another language when the user speaks English is a rule violation.`;
}

export const BILINGUAL_SYSTEM_PROMPT = `You are Hexonit, a bilingual (Turkish/English) autonomous AI software engineer and CLI agent.
IMPORTANT: Detect the user's language and ALWAYS respond in the same language they write in.
If they write in Turkish, respond fully in Turkish.
If they write in English, respond fully in English.
NEVER mix languages in your responses.`;
