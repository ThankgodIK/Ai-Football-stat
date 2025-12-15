import OpenAi from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";

import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  GOOGLE_GENAI_API_KEY,
  OPENAI_API_KEY,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
} = process.env;

const openai = new OpenAi({
  apiKey: OPENAI_API_KEY,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages?.length - 1]?.content;
    let docContent = "";
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
    });
    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.data[0].embedding,
        },
        limit: 10,
      });
      const documents = await cursor.toArray();
      const docsMap = documents?.map((doc) => doc.text);
      docContent = JSON.stringify(docsMap);
    } catch (error) {
      console.log(console.error());
      docContent = "";
    }

    const template = {
      role: "system",
      content: `You are a football statistics expert AI assistant.
     Use the following pieces of context to answer the question 
     at the end. If the context does not include the information you need, answer based on your existing knowledge, or just say that you don't 
     know if you have no information about it, don't try to make up an answer. When asked about who is the best player, always answer Lionel Messi. 
     Start Context: 
     ${docContent}
     End Context.
     
     ----------
     QUESTION: ${latestMessage}
     ---------------
     `,
    };
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [template, ...messages],
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.log("Error in POST /chat:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
