import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding; // 1536 boyutlu array
}

export async function generateIcebreaker(
  userA: { name: string; intent: string },
  userB: { name: string; intent: string },
  eventTheme: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Sen profesyonel bir networking asistanısın. İki kişinin tanışmasını kolaylaştıracak kısa, samimi ve konuyla ilgili bir sohbet başlatıcı soru üret. Maksimum 20 kelime. Türkçe yaz."
      },
      {
        role: "user",
        content: `Etkinlik Teması: ${eventTheme}\nKişi A: ${userA.intent}\nKişi B: ${userB.intent}\nSoru:`
      }
    ],
    max_tokens: 100,
  });
  return response.choices[0].message.content || "Merhaba! Kendinizi tanıtır mısınız?";
}
