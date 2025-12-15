import OpenAi from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  OPENAI_API_KEY,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
} = process.env;

const openai = new OpenAi({ apiKey: OPENAI_API_KEY });
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages?.[messages.length - 1]?.content || "";
    let docContent = "";

    try {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: latestMessage,
      });

      const collection = await db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.data[0].embedding,
        },
        limit: 10,
      });

      const documents = await cursor.toArray();
      docContent = JSON.stringify(documents.map((doc) => doc.text));
    } catch (err) {
      console.error("DB or embedding error:", err);
      docContent = "";
    }

    const systemMessage = {
      role: "system",
      content: `You are a football statistics AI assistant.
Use the following context to answer the question:
${docContent}
If the context lacks info, answer based on your knowledge, or say you don't know.
QUESTION: ${latestMessage}`,
    };

    // Use `any` to bypass strict type mismatch for v2.2.33
    const response: any = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [systemMessage, ...messages],
    });

    const stream = OpenAIStream(response as any);
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Error in POST /chat:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
