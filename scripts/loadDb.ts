import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import OpenAi from "openai";
import { GoogleGenAI } from "@google/genai";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";

type SimilarityMetrics = "dot_product" | "cosine" | "euclidean";

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

const googleGenAI = new GoogleGenAI({
  apiKey: GOOGLE_GENAI_API_KEY!,
});

const fileData = [
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup",
  //   "https://en.wikipedia.org/wiki/Lionel_Messi",
  //   "https://en.wikipedia.org/wiki/Cristiano_Ronaldo",
  //   "https://en.wikipedia.org/wiki/Neymar",
  //   "https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_final",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_kick-off",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_group_stage",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_quarter-finals",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_semi-finals",
  //   "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_finals",
  "https://en.wikipedia.org/wiki/Football",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (
  similarityMetrics: SimilarityMetrics = "dot_product"
) => {
  const res = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 1536,
      metric: similarityMetrics,
    },
  });
  console.log("Collection created:", res);
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);
  for await (const fileUrl of fileData) {
    const content = await scrapePage(fileUrl);
    const chunks = await splitter.splitText(content);
    for await (const chunk of chunks) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        encoding_format: "float",
      });
      const vector = embedding.data[0].embedding;
      const res = await collection.insertOne({
        $vector: vector,
        text: chunk,
      });
      console.log("Inserted chunk from ", fileUrl);
    }
  }
};

const scrapePage = async (fileUrl: string) => {
  const loader = new PuppeteerWebBaseLoader(fileUrl, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });

  return (await loader.scrape())?.replace(/<[^>]*>?/gm, " ");
};

// createCollection().then(() => loadSampleData());
loadSampleData();
